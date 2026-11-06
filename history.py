from dataclasses import dataclass, field

from cards import Card
from player import Player

@dataclass
class TurnHistory:
  cycle: int
  seat: int
  drawn: Card | None = None
  played: Card | None = None    # None = skipped turn (player rejected)
  target: Player | None = None
  guess: Card | None = None     # Guard only
  outcome: str = ""             # e.g. "no_target", "protected", "correct", "incorrect", "win", "lose", "draw"
  rejected: list[Player] = field(default_factory=list)


@dataclass
class RoundHistory:
  number: int
  dealer: int
  burn: Card | None = None
  deck_order: list[Card] = field(default_factory=list)
  turns: list[TurnHistory] = field(default_factory=list)
  winners: list[Player] = field(default_factory=list)

@dataclass
class GameHistory:
  players: list[Player] = field(default_factory=list)
  rounds: list[RoundHistory] = field(default_factory=list)
  winner: Player | None = None