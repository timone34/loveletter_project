import random

from .cards import *


class Deck:
    def __init__(self):
        self.cards: list[Card] = [
            Guard(),
            Guard(),
            Guard(),
            Guard(),
            Guard(),
            Priest(),
            Priest(),
            Baron(),
            Baron(),
            Handmaid(),
            Handmaid(),
            Prince(),
            Prince(),
            King(),
            Countess(),
            Princess(),
        ]

    def shuffle(self) -> None:
        random.shuffle(self.cards)

    def draw_card(self) -> Card:
        if self.cards:
            return self.cards.pop(0)

        raise RuntimeError("Cannot draw from an empty deck.")

    @property
    def cards_left(self) -> int:
        return len(self.cards)
