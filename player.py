from __future__ import annotations

from strategy import Strategy
from cards import Card


class Player:
  def __init__(self, name: str, strategy: Strategy):
    self.name = name
    self.strategy = strategy

    self.hand: list[Card] = []
    self.discard: list[Card] = []

    self.protected: bool = False
    self.rejected: bool = False

    self.round_wins: int = 0
  
  def reset_player(self) -> None:
    self.hand.clear()
    self.discard.clear()
    self.protected = False
    self.rejected = False