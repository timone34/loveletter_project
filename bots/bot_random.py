import random
from typing import TYPE_CHECKING

from cards import *
from strategy import Strategy

if TYPE_CHECKING:
    from player import Player

class Random_Strategy(Strategy):  # picks a random target regarding all actions.
    def __init__(self) -> None:
        self.name = "Random Strategy"

    def choose_card(self, player, playable):
        return random.choice(playable)

    def choose_target(self, player, card, targets):
        return random.choice(targets)

    def guard_guess(self, player, target):
        return random.choice(guessable())