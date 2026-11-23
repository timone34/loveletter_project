import asyncio
import dataclasses
import queue
import random
import threading
import traceback
from enum import Enum
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from bots import available_bots
from engine import Card, Game, Observer, Strategy, TurnHistory, guessable
from engine.view import redact_turn

app = FastAPI()

# seconds to wait after each kind of message, before sending the next one
# (at normal speed; TableConfig.speed scales these)
PACE = {
    "game_start": 0.5,
    "round_start": 1.5,
    "turn_start": 2,
    "turn_end": 2,
    "turn_skipped": 0.75,
    "showdown": 2.5,
    "round_end": 2.5,
}
PACE_YOUR_TURN_START = 0.3
SPEEDS = {"slow": 1.6, "normal": 1.0, "fast": 0.4}  # multiplier on PACE


# --- Table settings, sent by the setup page with "new_game" --- #

@dataclasses.dataclass
class TableConfig:
    name: str = "The Royal Court"
    you: str = "You"
    seat: int | None = 3  # your seat, 0-3; None = random
    opponents: list[tuple[str, str]] = dataclasses.field(  # (name, bot id), in seat order
        default_factory=lambda: [("Alice", "NoPrincess"), ("Bob", "RandomChoice"), ("Charlie", "RandomChoice")]
    )
    target_round_wins: int = 3
    speed: str = "normal"
    deck_seed: str | None = None  # same seed = same deals, round for round
    visibility: str = "private"  # for multiplayer later; no effect yet

    @classmethod
    def from_json(cls, data: dict | None) -> "TableConfig":
        """Validate settings from the browser. Raises ValueError with a readable message."""
        if not data:
            return cls()

        def text(key: str, default: str, limit: int = 24) -> str:
            value = str(data.get(key) or "").strip()[:limit]
            return value or default

        bots = available_bots()
        raw = data.get("opponents")
        if not isinstance(raw, list) or len(raw) != 3:
            raise ValueError("Pick exactly three opponents.")
        opponents = []
        for i, opp in enumerate(raw):
            if not isinstance(opp, dict) or opp.get("bot") not in bots:
                raise ValueError(f"Unknown bot for opponent {i + 1}: {opp!r}")
            name = str(opp.get("name") or "").strip()[:24] or f"Bot {i + 1}"
            opponents.append((name, opp["bot"]))

        you = text("you", "You")
        names = [you] + [n for n, _ in opponents]
        if len({n.casefold() for n in names}) < len(names):
            raise ValueError("Every player needs a different name.")

        seat = data.get("seat")
        if seat is not None and seat not in range(4):
            raise ValueError("Your seat must be 1 to 4, or random.")

        target = data.get("targetRoundWins", 3)
        if not isinstance(target, int) or not 1 <= target <= 9:
            raise ValueError("Round wins to win must be between 1 and 9.")

        speed = data.get("speed", "normal")
        if speed not in SPEEDS:
            raise ValueError(f"Unknown speed: {speed!r}")

        visibility = data.get("visibility", "private")
        if visibility not in ("private", "public"):
            raise ValueError(f"Unknown visibility: {visibility!r}")

        return cls(
            name=text("name", "The Royal Court", 40),
            you=you,
            seat=seat,
            opponents=opponents,
            target_round_wins=target,
            speed=speed,
            deck_seed=str(data.get("deckSeed") or "").strip()[:40] or None,
            visibility=visibility,
        )


def lineup(config: TableConfig, session: "Session") -> dict[str, Strategy]:
    """Players in seat order, with the browser's seat where the config puts it."""
    bots = available_bots()
    players: list[tuple[str, Strategy]] = [(name, bots[bot]()) for name, bot in config.opponents]
    seat = config.seat if config.seat is not None else random.randrange(4)
    players.insert(seat, (config.you, Web_Strategy(session)))
    return dict(players)


# --- Engine objects -> JSON --- #

def card_id(card: Card | None) -> str | None:
    """Card -> the id the frontend uses ("Guard" -> "guard")."""
    return card.name.lower() if card is not None else None


def to_json(obj: Any) -> Any:
    """Engine objects -> JSON-able values. Cards become ids, enums their name,
    dataclasses (TurnHistory, ShowdownHistory, ...) dicts of all their fields,
    so a field added to the engine reaches the browser without touching this file."""
    if isinstance(obj, Card):
        return card_id(obj)
    if isinstance(obj, Enum):
        return obj.name
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        return {f.name: to_json(getattr(obj, f.name)) for f in dataclasses.fields(obj)}
    if isinstance(obj, dict):
        return {k: to_json(v) for k, v in obj.items()}  # int keys become strings in JSON
    if isinstance(obj, (list, tuple)):
        return [to_json(v) for v in obj]
    return obj


def snapshot(turn: TurnHistory) -> TurnHistory:
    """A copy of turn as it is now. The engine keeps filling in the original
    after on_turn_start, but the browser sees the message later."""
    return dataclasses.replace(turn, rejected=list(turn.rejected))


# --- The browser's seat --- #

class GameAborted(Exception):
    """Raised inside the game thread to unwind a game nobody is watching anymore."""

class Web_Strategy(Strategy):
    """The browser's seat. Each decision becomes a prompt, and the game thread
    waits for the answer. The connection only forwards valid answers."""

    def __init__(self, session: "Session") -> None:
        self.id = "WebPlayer"
        self.name = "Player Input"
        self.session = session

    def choose_card(self, player, playable):
        # answer = index into the hand, so two Guards stay distinguishable
        allowed = [any(card is p for p in playable) for card in player.hand]
        i = self.session.ask(
            "card",
            [card_id(c) for c in player.hand],
            playable=allowed,
            forced=len(playable) < len(player.hand),  # Countess rule
        )
        return player.hand[i]

    def choose_target(self, player, card, targets):
        i = self.session.ask("target", [t.seat for t in targets], card=card_id(card))
        return targets[i]

    def guard_guess(self, player, target):
        options = guessable()
        i = self.session.ask("guess", [card_id(c) for c in options], target=target.seat)
        return options[i]

class TableObserver(Observer):
    """Sends every game event to the session, with a full snapshot of the table.

    Everything is captured here, on the game thread, at the moment of the event,
    so it stays correct even though the browser sees it later. Messages hold
    everything; redact() decides what the human may see when it's sent."""

    def __init__(self, session: "Session") -> None:
        self.session = session
        self.active: int | None = None
        self.showdown = False  # hands are face up from showdown until the next deal

    def table(self) -> dict:
        game = self.session.game
        rnd = game.current_round
        return {
            "round": game.round,
            "dealer": rnd.dealer if rnd else game.dealer,
            "deckCount": rnd.deck.cards_left if rnd else 0,
            "burn": card_id(getattr(rnd, "burn_card", None)),
            "winsNeeded": game.target_round_wins,
            "name": self.session.config.name,
            "visibility": self.session.config.visibility,
            "youSeat": self.session.you,
            "showdown": self.showdown,
            "players": [
                {
                    "seat": p.seat,
                    "name": p.name,
                    "strategy": p.strategy.name,
                    "roundWins": p.round_wins,
                    "hand": [card_id(c) for c in p.hand],
                    "discards": [card_id(c) for c in p.discard],
                    "active": p.seat == self.active,
                    "protected": p.protected,
                    "rejected": p.rejected,
                }
                for p in game.players
            ],
        }

    def _emit(self, type_: str, **data) -> None:
        self.session.emit({"type": type_, **data, "table": self.table()})

    def on_game_start(self, game):
        self._emit("game_start", players=game.players, strategies=game.strategies)

    def on_round_start(self, game, rnd):
        self.active, self.showdown = None, False
        self._emit("round_start", number=rnd.number, dealer=rnd.dealer)

    def on_turn_start(self, game, rnd, turn):
        self.active = turn.seat
        self._emit("turn_start", turn=snapshot(turn))

    def on_turn_end(self, game, rnd, turn):
        self._emit("turn_end", turn=snapshot(turn))

    def on_turn_skipped(self, game, rnd, turn):
        self.active = turn.seat
        self._emit("turn_skipped", turn=snapshot(turn))

    def on_showdown(self, game, rnd, showdown):
        self.active, self.showdown = None, True
        self._emit("showdown", **to_json(showdown))

    def on_round_end(self, game, rnd):
        self.active = None
        self._emit("round_end", number=rnd.number, winners=rnd.winners)

    def on_game_end(self, game):
        self._emit("game_end", winner=game.winner, scores=game.scores)

class Session:
    """One game, and the bridge between its thread and the event loop."""

    def __init__(self, loop: asyncio.AbstractEventLoop, config: TableConfig) -> None:
        self.loop = loop
        self.config = config
        self.outbox: asyncio.Queue[dict] = asyncio.Queue()  # game thread -> browser
        self.answers: queue.Queue[int | None] = queue.Queue()  # browser -> game thread
        self.aborted = threading.Event()

        self.observer = TableObserver(self)
        players = lineup(config, self)
        self.you = next(
            seat for seat, s in enumerate(players.values()) if isinstance(s, Web_Strategy)
        )
        self.game = Game(
            players,
            target_round_wins=config.target_round_wins,
            observers=self.observer,
            deck_seed=config.deck_seed,
        )
        self.thread = threading.Thread(target=self._run, daemon=True)

    def start(self) -> None:
        self.thread.start()

    # --- called on the game thread --- #

    def emit(self, msg: dict) -> None:
        if self.aborted.is_set():
            raise GameAborted  # stops an abandoned game at its next event
        try:
            self.loop.call_soon_threadsafe(self.outbox.put_nowait, msg)
        except RuntimeError:  # event loop closed: the server is shutting down
            raise GameAborted

    def ask(self, kind: str, options: list, **context) -> int:
        self.emit(
            {
                "type": "prompt",
                "prompt": {"kind": kind, "options": options, **context},
                "table": self.observer.table(),
            }
        )
        answer = self.answers.get()  # blocks this thread, not the server
        if answer is None:
            raise GameAborted
        return answer

    def _run(self) -> None:
        try:
            self.game.play()
        except GameAborted:
            pass
        except Exception as exc:
            traceback.print_exc()
            try:
                self.emit({"type": "error", "message": f"{type(exc).__name__}: {exc}"})
            except GameAborted:
                pass

    # --- called on the event loop --- #

    def abort(self) -> None:
        self.aborted.set()
        self.answers.put(None)  # wake the thread if it's waiting on a prompt


def redact(msg: dict) -> dict:
    """Return a copy of msg with everything the human seat can't know removed.

    Turns go through the engine's redact_turn, the same rules bots get.
    Only the table snapshot, which the engine doesn't have, is handled here."""
    if "table" not in msg:
        return msg
    table = msg["table"]
    you = table["youSeat"]

    players = [
        p if table["showdown"] or p["seat"] == you
        else {**p, "hand": [None] * len(p["hand"])}
        for p in table["players"]
    ]
    msg = {**msg, "table": {**table, "burn": None, "players": players}}
    if "turn" in msg:
        msg["turn"] = redact_turn(msg["turn"], you)
    return msg


def wire(msg: dict) -> dict:
    """The JSON the browser gets: the turn's fields flattened into the message."""
    msg = dict(msg)
    turn = msg.pop("turn", None)
    if turn is not None:
        msg.update(to_json(turn))
    return to_json(msg)


class Connection:
    """One browser tab. Owns at most one running Session at a time."""

    def __init__(self, ws: WebSocket) -> None:
        self.ws = ws
        self.loop = asyncio.get_running_loop()
        self.send_lock = asyncio.Lock()

        self.session: Session | None = None
        self.pump_task: asyncio.Task | None = None
        self.running = False
        self.unpaused = asyncio.Event()
        self.unpaused.set()
        self.reveal = False

        self.prompt: dict | None = None  # the prompt the browser is answering
        self.last_table: dict | None = None  # unredacted, for resending on reveal

    async def serve(self) -> None:
        try:
            await self.send_status()
            while True:
                await self.handle(await self.ws.receive_json())
        except WebSocketDisconnect:
            pass
        finally:
            self.stop_game()

    async def handle(self, msg: dict) -> None:
        kind = msg.get("type")
        if kind == "new_game":
            try:
                config = TableConfig.from_json(msg.get("config"))
            except ValueError as exc:
                await self.send({"type": "error", "message": f"Invalid table settings: {exc}"})
                return
            self.start_game(config)
            await self.send_status()
        elif kind == "pause":
            self.unpaused.clear()
            await self.send_status()
        elif kind == "resume":
            self.unpaused.set()
            await self.send_status()
        elif kind == "reveal":
            self.reveal = bool(msg.get("on"))
            await self.send_status()
            if self.last_table is not None:
                await self.send({"type": "table", "table": self.last_table})
        elif kind == "choice":
            self.answer(msg.get("index"))

    def answer(self, index) -> None:
        session = self.session
        prompt = self.prompt["prompt"] if self.prompt else None
        if prompt is None or session is None:
            return
        if not isinstance(index, int) or not 0 <= index < len(prompt["options"]):
            return
        if prompt["kind"] == "card" and not prompt["playable"][index]:
            return
        self.prompt = None  # one answer per prompt, so double clicks do nothing
        session.answers.put(index)

    def start_game(self, config: TableConfig) -> None:
        self.stop_game()
        self.session = Session(self.loop, config)
        self.running = True
        self.unpaused.set()
        self.pump_task = asyncio.create_task(self.pump(self.session))
        self.session.start()

    def stop_game(self) -> None:
        if self.session is not None:
            self.session.abort()
            self.session = None
        if self.pump_task is not None:
            self.pump_task.cancel()
            self.pump_task = None
        self.prompt = None
        self.running = False

    async def pump(self, session: Session) -> None:
        """Move messages from the game to the browser, at a watchable speed."""
        try:
            while True:
                msg = await session.outbox.get()
                await self.unpaused.wait()

                self.last_table = msg.get("table", self.last_table)
                if msg["type"] == "prompt":
                    self.prompt = msg
                await self.send(msg)

                if msg["type"] in ("game_end", "error"):
                    self.running = False
                    await self.send_status()
                    return

                if msg["type"] == "turn_start" and msg["turn"].seat == session.you:
                    pace = PACE_YOUR_TURN_START
                else:
                    pace = PACE.get(msg["type"], 0.0)
                await asyncio.sleep(pace * SPEEDS[session.config.speed])
        except (WebSocketDisconnect, RuntimeError):
            pass  # the socket closed mid-send; serve() cleans up

    async def send(self, msg: dict) -> None:
        if not self.reveal:
            msg = redact(msg)
        async with self.send_lock:
            await self.ws.send_json(wire(msg))

    async def send_status(self) -> None:
        await self.send(
            {
                "type": "status",
                "running": self.running,
                "paused": not self.unpaused.is_set(),
                "reveal": self.reveal,
            }
        )

@app.get("/api/bots")
def list_bots() -> list[dict]:
    """The bots the setup page can seat at the table."""
    bots = [cls() for cls in available_bots().values()]
    return [{"id": b.id, "name": b.name, "description": b.description} for b in bots]


@app.websocket("/ws/play")
async def play(ws: WebSocket):
    await ws.accept()
    await Connection(ws).serve()
