import asyncio
import copy
import importlib
import inspect
import queue
import random
import threading
import time
import traceback
from pkgutil import iter_modules

import pandas as pd
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

import bots
from bots import Random_Strategy, No_Princess, No_Princess_Or_Suicide, Card_Counter
from cards import Card, guessable
from game import Game
from observers import Observer
from stats import (
    Dataset,
    baron_results,
    card_usage,
    dealer_winrates,
    game_summary,
    guard_accuracy,
    prince_suicides,
    rejection_stats,
    round_winrate,
    seat_winrates,
    simulate,
    showdown_results,
    winrate,
    winrate_history,
)
from strategy import Strategy

app = FastAPI()

SIMULATION_LOCK = threading.Lock()


def available_bots() -> dict[str, tuple[type[Strategy], str]]:
    """Discover strategy classes declared in modules in the bots package."""
    found = {}
    for module_info in iter_modules(bots.__path__):
        module = importlib.import_module(f"{bots.__name__}.{module_info.name}")
        for _, bot_class in inspect.getmembers(module, inspect.isclass):
            if (
                bot_class.__module__ == module.__name__
                and issubclass(bot_class, Strategy)
                and bot_class is not Strategy
            ):
                bot_id = bot_class.__name__.lower().replace("_", "-")
                label = bot_class().name
                found[bot_id] = (bot_class, label)
    return found


class SimulationPlayer(BaseModel):
    bot: str
    name: str = Field(min_length=1, max_length=32)


class SimulationRequest(BaseModel):
    games: int = Field(ge=1, le=50_000)
    players: list[SimulationPlayer]
    targetRoundWins: int = Field(default=3, ge=1, le=7)
    rotateSeats: bool = True
    seed: int | None = Field(default=None, ge=0, le=2_147_483_647)


def dataframe_records(frame: pd.DataFrame) -> list[dict]:
    records = []
    for row in frame.to_dict(orient="records"):
        records.append({
            key: (
                None
                if pd.isna(value)
                else value.item()
                if hasattr(value, "item")
                else value
            )
            for key, value in row.items()
        })
    return records


@app.get("/api/bots")
def list_bots() -> list[dict[str, str]]:
    return [
        {
            "id": bot_id,
            "name": label,
            "description": inspect.getdoc(bot_class) or f"{label} strategy",
        }
        for bot_id, (bot_class, label) in sorted(available_bots().items())
    ]


@app.post("/api/simulations")
def create_simulation(request: SimulationRequest) -> dict:
    bot_classes = available_bots()
    if not 2 <= len(request.players) <= 4:
        raise HTTPException(status_code=422, detail="Choose between 2 and 4 players.")
    if len({player.name.strip() for player in request.players}) != len(request.players):
        raise HTTPException(status_code=422, detail="Player names must be unique.")
    if any(not player.name.strip() for player in request.players):
        raise HTTPException(status_code=422, detail="Player names cannot be blank.")
    if request.targetRoundWins not in (1, 3, 5, 7):
        raise HTTPException(status_code=422, detail="Round-win target must be 1, 3, 5, or 7.")

    unknown_bots = sorted({player.bot for player in request.players} - bot_classes.keys())
    if unknown_bots:
        raise HTTPException(status_code=422, detail=f"Unknown bot selection: {', '.join(unknown_bots)}.")

    players = {
        player.name.strip(): bot_classes[player.bot][0]()
        for player in request.players
    }
    lineup = [
        {
            "seat": seat + 1,
            "name": player.name.strip(),
            "botId": player.bot,
            "botName": bot_classes[player.bot][1],
        }
        for seat, player in enumerate(request.players)
    ]

    started = time.perf_counter()
    with SIMULATION_LOCK:
        prior_random_state = random.getstate() if request.seed is not None else None
        try:
            if request.seed is not None:
                random.seed(request.seed)
            histories = simulate(
                request.games,
                players,
                rotate_seats=request.rotateSeats,
                target_round_wins=request.targetRoundWins,
            )
        finally:
            if prior_random_state is not None:
                random.setstate(prior_random_state)
    duration_ms = (time.perf_counter() - started) * 1000

    dataset = Dataset.from_histories(histories)
    game_wins = winrate(dataset)
    round_wins = round_winrate(dataset)
    summary = game_summary(dataset)

    leaderboard = []
    for row in dataframe_records(game_wins.reset_index()):
        round_row = round_wins.loc[row["player"]]
        rounds_played = int(round_row["rounds"])
        leaderboard.append({
            "player": row["player"],
            "wins": row["wins"],
            "games": row["games"],
            "winrate": row["winrate"],
            "ciLow": row["ci_low"],
            "ciHigh": row["ci_high"],
            "roundWins": int(round_row["round_wins"]),
            "rounds": rounds_played,
            "roundWinrate": (
                float(round_row["winrate"]) if rounds_played else None
            ),
        })
    leaderboard.sort(key=lambda row: row["winrate"], reverse=True)
    suicide_counts = prince_suicides(histories)

    return {
        "run": {
            "games": request.games,
            "targetRoundWins": request.targetRoundWins,
            "rotateSeats": request.rotateSeats,
            "seed": request.seed,
            "durationMs": duration_ms,
            "players": lineup,
        },
        "summary": {
            "games": summary["games"],
            "rounds": summary["rounds"],
            "turns": summary["turns"],
            "rejections": summary["rejections"],
            "guardAttempts": summary["guard_attempts"],
            "guardCorrect": summary["guard_correct"],
        },
        "leaderboard": leaderboard,
        "rejections": {
            "byCause": [
                {"category": row["cause"], "count": row["count"], "share": row["share"]}
                for row in dataframe_records(rejection_stats(dataset))
            ],
            "byCycle": dataframe_records(rejection_stats(dataset, "cycle")),
            "byAttacker": dataframe_records(rejection_stats(dataset, "attacker")),
            "byVictim": dataframe_records(rejection_stats(dataset, "victim")),
            "selfInflicted": dataframe_records(rejection_stats(dataset, "self_inflicted")),
        },
        "guards": dataframe_records(guard_accuracy(dataset)),
        "barons": dataframe_records(baron_results(dataset)),
        "showdowns": dataframe_records(showdown_results(dataset)),
        "princeSuicides": [
            {"player": player["name"], "count": suicide_counts.get(player["name"], 0)}
            for player in lineup
        ],
        "cardUsage": [
            {"card": row["card"], "count": row["count"], "share": row["share"]}
            for row in dataframe_records(card_usage(dataset))
        ],
        "cardsDrawn": [
            {"card": row["card"], "count": row["count"], "share": row["share"]}
            for row in dataframe_records(card_usage(dataset, "drawn"))
        ],
        "seatWinrates": dataframe_records(seat_winrates(dataset)),
        "dealerWinrates": dataframe_records(dealer_winrates(dataset)),
        "winrateHistory": [
            {
                "gameCount": row["game_count"],
                "player": row["player"],
                "wins": row["wins"],
                "winrate": row["winrate"],
            }
            for row in dataframe_records(
                winrate_history(dataset, interval=max(1, (request.games + 9) // 10))
            )
        ],
    }


def turn_dict(turn) -> dict:
    name = lambda c: c.name if c is not None else None
    return {
        "cycle": turn.cycle,
        "seat": turn.seat,
        "held": name(turn.held),
        "drawn": name(turn.drawn),
        "played": name(turn.played),
        "target": turn.target,
        "guess": name(turn.guess),
        "outcome": turn.outcome.name,
        "seen": name(turn.seen),
        "discarded": name(turn.discarded),
        "redrawn": name(turn.redrawn),
        "rejected": turn.rejected,
    }


class QueueObserver(Observer):
    """Turns game events into JSON-able dicts and puts them on a queue."""

    def __init__(self, loop: asyncio.AbstractEventLoop, queue: asyncio.Queue):
        self.loop, self.queue = loop, queue

    def _emit(self, type_: str, **data) -> None:
        # the game runs in another thread, so hand over safely
        self.loop.call_soon_threadsafe(self.queue.put_nowait, {"type": type_, **data})

    def on_game_start(self, game):
        self._emit("game_start", players=game.players, strategies=game.strategies)

    def on_round_start(self, game, rnd):
        self._emit(
            "round_start",
            number=rnd.number,
            dealer=rnd.dealer,
            burn=rnd.burn.name if rnd.burn else None,
            starting_hands={s: c.name for s, c in rnd.starting_hands.items()},
        )

    def on_turn_start(self, game, rnd, turn):
        self._emit("turn_start", **turn_dict(turn))

    def on_turn_end(self, game, rnd, turn):
        self._emit("turn_end", **turn_dict(turn))

    def on_turn_skipped(self, game, rnd, turn):
        self._emit("turn_skipped", cycle=turn.cycle, seat=turn.seat)

    def on_showdown(self, game, rnd, showdown):
        self._emit(
            "showdown",
            hands={s: c.name for s, c in showdown.contender_hands.items()},
            discard_totals=showdown.discard_totals,
            winners=showdown.winners,
        )

    def on_round_end(self, game, rnd):
        self._emit("round_end", number=rnd.number, winners=rnd.winners)

    def on_game_end(self, game):
        self._emit("game_end", winner=game.winner, scores=game.scores)


@app.websocket("/ws/spectate")
async def spectate(ws: WebSocket):
    await ws.accept()
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    players: dict[str, Strategy] = {
        n: Random_Strategy() for n in ["Alice", "Bob", "Charlie", "Diane"]
    }
    game = Game(players, target_round_wins=3, observers=QueueObserver(loop, queue))
    asyncio.create_task(asyncio.to_thread(game.play))  # game runs instantly in a thread

    try:
        while True:
            msg = await queue.get()
            await ws.send_json(msg)
            if msg["type"] == "game_end":
                break
            await asyncio.sleep(0.8)  # pacing lives here, not in the game
        await ws.close()
    except WebSocketDisconnect:
        pass


TARGET_ROUND_WINS = 3
DEFAULT_BOT_NAMES = ["The Oracle", "The Regent", "The Scribe"]
DEFAULT_TABLE_NAME = "The Royal Court"

# seconds to wait after each kind of message, before sending the next one
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

def card_id(card: Card | None) -> str | None:
    """Card -> the id the frontend uses ("Guard" -> "guard")."""
    return card.name.lower() if card is not None else None

def lineup(
    session: "Session",
    bots: list[str],
    bot_names: list[str],
) -> dict[str, Strategy]:
    strategies: dict[str, type[Strategy]] = {
        "random": Random_Strategy,
        "no-princess": No_Princess,
    }
    return {
        **{
            name: strategies[bot]()
            for bot, name in zip(bots, bot_names)
        },
        "You": Web_Strategy(session),
    }

class GameAborted(Exception):
    """Raised inside the game thread to unwind a game nobody is watching anymore."""

class Web_Strategy(Strategy):
    """The browser's seat. Each decision becomes a prompt, and the game thread
    waits for the answer. The connection only forwards valid answers."""

    def __init__(self, session: "Session") -> None:
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

    The snapshot is taken here, on the game thread, at the moment of the event,
    so it stays correct even though the browser sees it later. It holds
    everything; redact() decides what the human may see when it's sent."""

    def __init__(self, session: "Session") -> None:
        self.session = session
        self.active: int | None = None
        self.showdown = False  # hands are face up from showdown until the next deal

    def table(self) -> dict:
        game = self.session.game
        rnd = game.current_round
        return {
            "name": self.session.table_name,
            "round": game.round,
            "dealer": rnd.dealer if rnd else game.dealer,
            "deckCount": rnd.deck.cards_left if rnd else 0,
            "burn": card_id(getattr(rnd, "burn_card", None)),
            "winsNeeded": game.target_round_wins,
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
        self._emit(
            "round_start",
            number=rnd.number,
            dealer=rnd.dealer,
            burn=rnd.burn.name if rnd.burn else None,
            starting_hands={s: c.name for s, c in rnd.starting_hands.items()},
        )

    def on_turn_start(self, game, rnd, turn):
        self.active = turn.seat
        self._emit("turn_start", **turn_dict(turn))

    def on_turn_end(self, game, rnd, turn):
        self._emit("turn_end", **turn_dict(turn))

    def on_turn_skipped(self, game, rnd, turn):
        self.active = turn.seat
        self._emit("turn_skipped", cycle=turn.cycle, seat=turn.seat)

    def on_showdown(self, game, rnd, showdown):
        self.active, self.showdown = None, True
        self._emit(
            "showdown",
            hands={s: c.name for s, c in showdown.contender_hands.items()},
            discard_totals=showdown.discard_totals,
            winners=showdown.winners,
        )

    def on_round_end(self, game, rnd):
        self.active = None
        self._emit("round_end", number=rnd.number, winners=rnd.winners)

    def on_game_end(self, game):
        self._emit("game_end", winner=game.winner, scores=game.scores)

class Session:
    """One game, and the bridge between its thread and the event loop."""

    def __init__(
        self,
        loop: asyncio.AbstractEventLoop,
        bots: list[str],
        bot_names: list[str],
        target_round_wins: int,
        table_name: str,
    ) -> None:
        self.loop = loop
        self.table_name = table_name
        self.outbox: asyncio.Queue[dict] = asyncio.Queue()  # game thread -> browser
        self.answers: queue.Queue[int | None] = queue.Queue()  # browser -> game thread
        self.aborted = threading.Event()

        self.observer = TableObserver(self)
        players = lineup(self, bots, bot_names)
        self.you = next(
            seat for seat, s in enumerate(players.values()) if isinstance(s, Web_Strategy)
        )
        self.game = Game(players, target_round_wins=target_round_wins, observers=self.observer)
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

def redact(msg: dict, reveal_hands: bool, reveal_burn: bool) -> dict:
    """Return a copy of msg with everything the human seat can't know removed."""
    if "table" not in msg:
        return msg
    msg = copy.deepcopy(msg)
    table = msg["table"]
    you = table["youSeat"]

    if not reveal_burn:
        table["burn"] = None
    if not reveal_hands and not table["showdown"]:
        for p in table["players"]:
            if p["seat"] != you:
                p["hand"] = [None] * len(p["hand"])

    kind = msg["type"]
    if kind == "round_start":
        if not reveal_burn:
            msg["burn"] = None
        if not reveal_hands:
            msg["starting_hands"] = {s: c for s, c in msg["starting_hands"].items() if s == you}
    elif not reveal_hands and kind in ("turn_start", "turn_end"):
        if msg["seat"] != you:
            msg["held"] = msg["drawn"] = msg["seen"] = None
        if msg["target"] != you:
            msg["redrawn"] = None  # a Prince's redraw is only seen by its target
    return msg

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
        self.reveal_hands = False
        self.reveal_burn = False

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
            bots = msg.get("bots", ["no-princess", "random", "random"])
            bot_names = msg.get(
                "botNames",
                DEFAULT_BOT_NAMES[:len(bots)] if isinstance(bots, list) else [],
            )
            target_round_wins = msg.get("targetRoundWins", TARGET_ROUND_WINS)
            reveal_hands = msg.get("revealHands", False)
            reveal_burn = msg.get("revealBurn", False)
            table_name = msg.get("tableName", DEFAULT_TABLE_NAME)
            if (
                not isinstance(bots, list)
                or not 1 <= len(bots) <= 3
                or any(
                    not isinstance(bot, str) or bot not in ("random", "no-princess")
                    for bot in bots
                )
            ):
                await self.send({"type": "error", "message": "Choose between 1 and 3 supported bots."})
                return
            if (
                not isinstance(bot_names, list)
                or len(bot_names) != len(bots)
                or any(
                    not isinstance(name, str) or not name.strip() or len(name.strip()) > 32
                    for name in bot_names
                )
            ):
                await self.send({"type": "error", "message": "Each bot needs a name of 1 to 32 characters."})
                return
            if type(target_round_wins) is not int or target_round_wins not in (1, 3, 5, 7):
                await self.send({"type": "error", "message": "Choose a round-win target of 1, 3, 5, or 7."})
                return
            if not isinstance(table_name, str) or not table_name.strip() or len(table_name.strip()) > 48:
                await self.send({"type": "error", "message": "The table name must be 1 to 48 characters."})
                return
            if not isinstance(reveal_hands, bool) or not isinstance(reveal_burn, bool):
                await self.send({"type": "error", "message": "Developer visibility settings must be on or off."})
                return
            self.reveal_hands = reveal_hands
            self.reveal_burn = reveal_burn
            self.start_game(
                bots,
                [name.strip() for name in bot_names],
                target_round_wins,
                table_name.strip(),
            )
            await self.send_status()
        elif kind == "pause":
            self.unpaused.clear()
            await self.send_status()
        elif kind == "resume":
            self.unpaused.set()
            await self.send_status()
        elif kind in ("reveal", "visibility"):
            reveal_hands = msg.get("on") if kind == "reveal" else msg.get("hands", self.reveal_hands)
            reveal_burn = self.reveal_burn if kind == "reveal" else msg.get("burn", self.reveal_burn)
            if not isinstance(reveal_hands, bool) or not isinstance(reveal_burn, bool):
                await self.send({"type": "error", "message": "Developer visibility settings must be on or off."})
                return
            self.reveal_hands = reveal_hands
            self.reveal_burn = reveal_burn
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

    def start_game(
        self,
        bots: list[str],
        bot_names: list[str],
        target_round_wins: int,
        table_name: str,
    ) -> None:
        self.stop_game()
        self.last_table = None
        self.session = Session(self.loop, bots, bot_names, target_round_wins, table_name)
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

                if msg["type"] == "turn_start" and msg["seat"] == session.you:
                    await asyncio.sleep(PACE_YOUR_TURN_START)
                else:
                    await asyncio.sleep(PACE.get(msg["type"], 0.0))
        except (WebSocketDisconnect, RuntimeError):
            pass  # the socket closed mid-send; serve() cleans up

    async def send(self, msg: dict) -> None:
        msg = redact(msg, self.reveal_hands, self.reveal_burn)
        async with self.send_lock:
            await self.ws.send_json(msg)

    async def send_status(self) -> None:
        await self.send(
            {
                "type": "status",
                "running": self.running,
                "paused": not self.unpaused.is_set(),
                "revealHands": self.reveal_hands,
                "revealBurn": self.reveal_burn,
            }
        )

@app.websocket("/ws/play")
async def play(ws: WebSocket):
    await ws.accept()
    await Connection(ws).serve()