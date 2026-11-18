import random
from typing import TYPE_CHECKING

from cards import *
from strategy import Strategy

if TYPE_CHECKING:
    from player import Player

class RandomChoice(Strategy):  # picks a random target regarding all actions.
    def __init__(self) -> None:
        self.id = "RandomChoice"
        self.name = "Random Bot"
        self.description = "This bot picks cards, targets and guesses at random."

    def choose_card(self, player: Player, playable: list[Card]) -> Card:
        return random.choice(playable)

    def choose_guard_target(self, player: Player, targets: list[Player]) -> Player:  return random.choice(targets)
    def choose_priest_target(self, player: Player, targets: list[Player]) -> Player: return random.choice(targets)
    def choose_baron_target(self, player: Player, targets: list[Player]) -> Player:  return random.choice(targets)
    def choose_prince_target(self, player: Player, targets: list[Player]) -> Player: return random.choice(targets)
    def choose_king_target(self, player: Player, targets: list[Player]) -> Player:   return random.choice(targets)

    def guard_guess(self, player: Player, target: Player) -> Card:
        return random.choice(guessable())