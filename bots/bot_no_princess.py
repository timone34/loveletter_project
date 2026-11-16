import random

from cards import *
from strategy import Strategy

class No_Princess(Strategy):
    def __init__(self) -> None:
        self.name = "No Princess"

    def choose_card(self, player, playable):
        candidates = [c for c in playable if not isinstance(c, Princess)] or playable
        return random.choice(candidates)


class No_Princess_Or_Suicide(No_Princess):
    def choose_prince_target(self, player, targets):
        if isinstance(player.hand[0], Princess):
            others = [t for t in targets if t is not player]
            return random.choice(others or targets)
        return random.choice(targets)
        