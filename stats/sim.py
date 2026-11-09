from __future__ import annotations
from typing import TYPE_CHECKING

from collections import deque

from game import Game
from strategy import Strategy
from observers import Observer

if TYPE_CHECKING:
  from history import GameHistory


def simulate(n: int, 
             players: dict[str, Strategy], 
             rotate_seats: bool = True,
             obs: Observer | None = None,
  ) -> list[GameHistory]:

  player_order = deque(players.items())
  game_histories: list[GameHistory] = []

  for i in range(n):
    rotated_players = dict(player_order)

    game = Game(players=rotated_players, target_round_wins=3, observers=obs)
    game.play()

    game_history = game.history
    game_histories.append(game_history)

    if rotate_seats:
      player_order.rotate(-1)

  return game_histories