from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum, auto
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .cards import Card


class Outcome(Enum):
    NONE = auto()
    # NO_TARGET = auto()
    PROTECTED = auto()  # Target protected
    CORRECT = auto()  # Guard
    INCORRECT = auto()  # Guard
    WIN = auto()  # Baron, from the player's perspective
    LOSE = auto()  # Baron
    DRAW = auto()  # Baron


@dataclass
class TurnHistory:
    cycle: int
    seat: int
    held: Card | None = None
    drawn: Card | None = None  # None = skipped turn (player rejected)
    played: Card | None = None
    target: int | None = None  # seat
    guess: Card | None = None  # Guard
    outcome: Outcome = Outcome.NONE
    seen: Card | None = None  # Priest
    discarded: Card | None = None  # Prince
    redrawn: Card | None = None  # Prince
    received: Card | None = None  # King
    rejected: list[int] = field(default_factory=list)  # seats


@dataclass
class ShowdownHistory:
    contender_hands: dict[int, Card]
    discard_totals: dict[int, int] = field(default_factory=dict)
    winners: list[int] = field(default_factory=list)


@dataclass
class RoundHistory:
    number: int
    dealer: int
    deck_order: list[Card]
    burn: Card | None = None
    starting_hands: dict[int, Card] = field(default_factory=dict)
    turns: list[TurnHistory] = field(default_factory=list)
    showdown: ShowdownHistory | None = None
    winners: list[int] = field(default_factory=list)


@dataclass
class GameHistory:
    players: list[str]
    strategies: list[str]
    rounds: list[RoundHistory] = field(default_factory=list)
    winner: int | None = None
    scores: dict[int, int] = field(default_factory=dict)
    target_round_wins: int = 3  # as configured at the start (Game raises it on ties)
