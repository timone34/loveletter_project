"""Walk through a recorded round turn by turn, knowing what everyone held.

A RoundHistory records every move, but not every hand at every moment (a
Baron's loser discards a card the turn doesn't name, for example). walk()
rebuilds that from the starting hands and the moves, so stats can ask
"what did the table look like when this decision was made?".

    for turn, state in walk(rh):
        state.hands[seat]      # the one card a player holds between turns (None = out)
        state.discards[seat]   # their face-up discard pile so far
        state.protected        # seats behind a Handmaid right now

`state` is the table just *before* `turn` was played, and it's the same object
every time (updated in place), so read what you need inside the loop.
"""
from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from engine.cards import Handmaid, King, Prince
from engine.history import Outcome

if TYPE_CHECKING:
    from engine.cards import Card
    from engine.history import RoundHistory, TurnHistory


@dataclass
class TableState:
    hands: dict[int, Card | None]
    discards: dict[int, list[Card]] = field(default_factory=dict)
    protected: set[int] = field(default_factory=set)


def kept_card(turn: TurnHistory) -> Card:
    """The card left in hand after playing (the one of held/drawn that wasn't played)."""
    assert turn.held is not None and turn.drawn is not None
    return turn.drawn if turn.played is turn.held else turn.held


def walk(rh: RoundHistory) -> Iterator[tuple[TurnHistory, TableState]]:
    """Every played turn of the round (skipped turns left out), with the table before it."""
    state = TableState(
        hands=dict(rh.starting_hands),
        discards={seat: [] for seat in rh.starting_hands},
    )
    for turn in rh.turns:
        if turn.played is None:  # a player who's already out
            continue
        yield turn, state

        me, target = turn.seat, turn.target
        state.protected.discard(me)  # protection lasts until your next turn
        state.hands[me] = kept_card(turn)
        state.discards[me].append(turn.played)

        affected = target is not None and turn.outcome is not Outcome.PROTECTED
        if isinstance(turn.played, Handmaid):
            state.protected.add(me)
        elif isinstance(turn.played, Prince) and affected and turn.discarded is not None:
            assert target is not None
            state.discards[target].append(turn.discarded)
            state.hands[target] = turn.redrawn  # None when the Princess went
        elif isinstance(turn.played, King) and affected:
            assert target is not None
            state.hands[me], state.hands[target] = state.hands[target], state.hands[me]

        for victim in turn.rejected:  # a knocked-out player's card goes face up
            assert turn.revealed is state.hands[victim]
            if turn.revealed is not None:
                state.discards[victim].append(turn.revealed)
            state.hands[victim] = None
