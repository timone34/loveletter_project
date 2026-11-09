import asyncio

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from game import Game
from observers import Observer
from strategy import Random_Strategy, Strategy

app = FastAPI()


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
