from __future__ import annotations

import random
from collections import deque
from collections.abc import Iterator
from typing import TYPE_CHECKING

from engine.game import Game
from engine.observer import Observer
from engine.strategy import Strategy

if TYPE_CHECKING:
    from engine.history import GameHistory


def iter_games(
    n: int,
    players: dict[str, Strategy],
    rotate_seats: bool = True,
    obs: Observer | None = None,
    seed: int | str | None = None,
    target_round_wins: int = 3,
) -> Iterator[GameHistory]:
    """Play n games, yielding each history as soon as its game ends.

    Same games as simulate() with the same arguments; use this one to show
    progress, stop early, or tally huge runs without keeping every history.

    seed: makes the run reproducible and gives every lineup the same decks.
    Round r of game i always gets the same deck for a given seed, whatever the
    bots do, so two lineups run with the same seed (and the same n and number
    of players) face exactly the same deck strings. The bots' own random choices
    are seeded too, so running the same lineup again gives identical games.
    (This reseeds Python's global `random` module, so anything else using it
    at the same time, e.g. another simulation, breaks the reproducibility.)
    """
    if seed is not None:
        random.seed(seed)

    player_order = deque(players.items())

    for i in range(n):
        game = Game(
            players=dict(player_order),
            target_round_wins=target_round_wins,
            observers=obs,
            deck_seed=None if seed is None else f"{seed}:{i}",
        )
        game.play()
        yield game.history

        if rotate_seats:
            player_order.rotate(-1)


def simulate(
    n: int,
    players: dict[str, Strategy],
    rotate_seats: bool = True,
    obs: Observer | None = None,
    seed: int | str | None = None,
    target_round_wins: int = 3,
) -> list[GameHistory]:
    """Play n games and return their histories. See iter_games() for `seed`."""
    return list(iter_games(n, players, rotate_seats, obs, seed, target_round_wins))
