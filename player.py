from __future__ import annotations

from typing import TYPE_CHECKING

from cards import Card, Countess, King, Prince
from strategy import Strategy

if TYPE_CHECKING:
    from view import PlayerView


class Player:
    def __init__(self, seat: int, name: str, strategy: Strategy):
        self.seat = seat
        self.name = name
        self.strategy = strategy

        self.hand: list[Card] = []
        self.discard: list[Card] = []

        self.protected: bool = False
        self.rejected: bool = False
        self.view: PlayerView | None = None

        self.round_wins: int = 0

    def reset_player(self) -> None:
        self.hand.clear()
        self.discard.clear()
        self.protected = False
        self.rejected = False
        self.view = None

    @property
    def discard_total(self) -> int:
        return sum(card.value for card in self.discard)

    @property
    def playable_cards(self) -> list[Card]:
        countess: list[Card] = [c for c in self.hand if isinstance(c, Countess)]
        prince = [c for c in self.hand if isinstance(c, Prince)]
        king = [c for c in self.hand if isinstance(c, King)]
        if countess and (prince or king):
            return countess
        return list(self.hand)
