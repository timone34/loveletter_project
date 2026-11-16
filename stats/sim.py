from __future__ import annotations

from collections import deque
from typing import TYPE_CHECKING

from game import Game
from observers import Observer
from strategy import Strategy

if TYPE_CHECKING:
    from history import GameHistory


def simulate(
    n: int,
    players: dict[str, Strategy],
    rotate_seats: bool = True,
    obs: Observer | None = None,
    target_round_wins: int = 3,
) -> list[GameHistory]:

    player_order = deque(players.items())
    game_histories: list[GameHistory] = []

    for i in range(n):
        rotated_players = dict(player_order)

        game = Game(
            players=rotated_players,
            target_round_wins=target_round_wins,
            observers=obs,
        )
        game.play()

        game_history = game.history
        game_histories.append(game_history)

        if rotate_seats:
            player_order.rotate(-1)

    return game_histories
