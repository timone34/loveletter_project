import random

from engine.cards import *
from bots import RandomChoice

class NoPrincessDumb(RandomChoice):
    def __init__(self) -> None:
        self.id = "NoPrincessDumb"
        self.family, self.version = "No Princess", "v1 (dumb)"
        self.name = "No Princess Bot (dumb)"
        self.description = "This bot never plays the Princess, but everything else is random."

    def choose_card(self, player, playable):
        candidates = [c for c in playable if not isinstance(c, Princess)] or playable
        return random.choice(candidates)


class NoPrincess(NoPrincessDumb):
    def __init__(self) -> None:
            self.id = "NoPrincess"
            self.family, self.version = "No Princess", "v2"
            self.name = "No Princess Bot"
            self.description = "This bot never plays or discards the Princess voluntarily. Everything else is random."

    def choose_prince_target(self, player, targets):
        if isinstance(player.hand[0], Princess):
            others = [t for t in targets if t is not player]
            return random.choice(others or targets)
        return random.choice(targets)
        