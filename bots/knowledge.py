"""What a bot knows about each opponent's hand, rebuilt from its own view.

    knowledge = Knowledge.from_view(view, private=True)
    knowledge.possible[seat]  # the card types that seat could be holding

Every opponent still in starts at ALL_TYPES (could be holding anything). The round's
log is replayed turn by turn, and each turn is turned into a few primitives:

    learn(seat, types)  they hold one of these (replaces what was known)
    exclude(seat, t)    they don't hold this type
    forget(seat)        what was known is no longer reliable: back to ALL_TYPES
    swap(a, b)          a King: the info on a is now on b, and the other way round
    out(seat)           knocked out, no hand to know about

plus one rule for every play (`played`): a player who draws and plays card X
still holds their old card if X can't have been it, otherwise the card they
kept might be the one they just drew, so the info is forgotten.

Which turns give knowledge (switched on per bot, so each step can be measured):

    always          Prince redraws, King swaps between two others, knock-outs
    private         my Priest looks, my own King swaps (I know what I gave or got)
    missed_guesses  a Guard that guessed wrong: the target doesn't hold that type

`possible` says which types are *possible*, not how likely they are: the odds
come from combining it with the unseen card counts (FastCardCounterV2.hand_odds).
"""
from __future__ import annotations

from collections.abc import Iterable
from typing import TYPE_CHECKING

from engine.cards import ALL_TYPES, Card, Guard, King, Priest, Prince
from engine.history import Outcome

if TYPE_CHECKING:
    from engine.history import TurnHistory
    from engine.view import PlayerView


class Knowledge:
    def __init__(self, viewer: int, seats: Iterable[int], *, private: bool = False, missed_guesses: bool = False) -> None:
        self.viewer = viewer
        self.private = private
        self.missed_guesses = missed_guesses
        self.possible: dict[int, frozenset[type[Card]]] = {s: ALL_TYPES for s in seats if s != viewer}

    @classmethod
    def from_view(cls, view: PlayerView, *, private: bool = False, missed_guesses: bool = False) -> Knowledge:
        """Everything the player of `view` knows, from the start of the round up to now."""
        knowledge = cls(view.seat, (p.seat for p in view.players), private=private, missed_guesses=missed_guesses)
        for turn in view.log:
            knowledge.apply(turn)
        return knowledge

    # ----- primitives -----

    def learn(self, seat: int, types: Iterable[type[Card]]) -> None:
        if seat in self.possible:
            self.possible[seat] = frozenset(types)

    def exclude(self, seat: int, card_type: type[Card]) -> None:
        if seat in self.possible:
            self.possible[seat] = self.possible[seat] - {card_type}

    def forget(self, seat: int) -> None:
        if seat in self.possible:
            self.possible[seat] = ALL_TYPES

    def swap(self, a: int, b: int) -> None:
        info_a, info_b = self.possible.get(a, ALL_TYPES), self.possible.get(b, ALL_TYPES)
        if a in self.possible:
            self.possible[a] = info_b
        if b in self.possible:
            self.possible[b] = info_a

    def out(self, seat: int) -> None:
        self.possible.pop(seat, None)

    def played(self, seat: int, card_type: type[Card]) -> None:
        """`seat` drew a card and played one of type `card_type`."""
        if card_type in self.possible.get(seat, ()):
            self.forget(seat)  # maybe the old card went, and they now hold the one they drew

    # ----- turns -----

    def apply(self, turn: TurnHistory) -> None:
        """One turn of the (redacted) log, as primitives."""
        if turn.played is None:  # skipped turn of a rejected player
            return
        seat, card, target = turn.seat, type(turn.played), turn.target
        self.played(seat, card)

        if target is not None and turn.outcome is not Outcome.PROTECTED:
            if card is Priest and turn.seen is not None:  # only ever my own look (redacted otherwise)
                if self.private:
                    self.learn(target, {type(turn.seen)})
            elif card is Guard and turn.outcome is Outcome.INCORRECT:
                if self.missed_guesses:
                    assert turn.guess is not None
                    self.exclude(target, type(turn.guess))
            elif card is Prince and turn.discarded is not None:
                self.forget(target)  # discarded and redrew (or was out, if it was the Princess)
            elif card is King and target != seat:
                if self.private and seat == self.viewer and turn.given is not None:
                    self.learn(target, {type(turn.given)})  # they now hold what I gave them
                elif self.private and target == self.viewer and turn.received is not None:
                    self.learn(seat, {type(turn.received)})  # they now hold what I had
                else:
                    self.swap(seat, target)

        for victim in turn.rejected:
            self.out(victim)
