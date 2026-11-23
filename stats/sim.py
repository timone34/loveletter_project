from __future__ import annotations

import random
from collections import deque
from typing import TYPE_CHECKING

from engine.game import Game
from engine.observer import Observer
from engine.strategy import Strategy

if TYPE_CHECKING:
    from engine.history import GameHistory


def simulate(
    n: int,
    players: dict[str, Strategy],
    rotate_seats: bool = True,
    obs: Observer | None = None,
    seed: int | None = None,
) -> list[GameHistory]:
    """Play n games and return their histories.

    seed: makes the run reproducible and gives every lineup the same decks.
    Round r of game i always gets the same deck for a given seed, whatever the
    bots do, so two lineups run with the same seed (and the same n and number
    of players) face exactly the same deck strings. The bots' own random choices
    are seeded too, so running the same lineup again gives identical games.
    (This reseeds Python's global `random` module.)
    """
    if seed is not None:
        random.seed(seed)

    player_order = deque(players.items())
    game_histories: list[GameHistory] = []

    for i in range(n):
        rotated_players = dict(player_order)

        game = Game(
            players=rotated_players,
            target_round_wins=3,
            observers=obs,
            deck_seed=None if seed is None else f"{seed}:{i}",
        )
        game.play()

        game_history = game.history
        game_histories.append(game_history)

        if rotate_seats:
            player_order.rotate(-1)

    return game_histories
