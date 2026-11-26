from __future__ import annotations

import functools
import itertools
import random
from collections import Counter
from dataclasses import dataclass
from typing import TYPE_CHECKING

from bots import NoPrincess
from bots.knowledge import Knowledge
from engine.cards import *
from engine.deck import Deck
from engine.strategy import Strategy

if TYPE_CHECKING:
    from engine.player import Player
    from engine.view import PlayerView


FULL = Counter(type(c) for c in Deck().cards)

def unseen(view: PlayerView) -> Counter[type[Card]]:
    counts = FULL.copy()
    for card in view.hand:
        counts[type(card)] -= 1
    for player in view.players:
        for card in player.discards:
            counts[type(card)] -= 1
    return counts

def opponent_seats(view: PlayerView) -> list[int]:
    return [p.seat for p in view.players if p.seat != view.seat and not p.rejected]

class CardCounter(NoPrincess):
    def __init__(self) -> None:
        self.id = "CardCounter"
        self.name = "Card Counter Bot"
        self.description = "This bot keeps track of how many cards are still unknown to it."
        self.debug = False

    def hand_odds(self, view: PlayerView) -> dict[int, dict[type[Card], float]]:
        unseen_cards = unseen(view)
        pool = {
            card_type: unseen_cards[card_type]
            for card_type in CARD_TYPES if unseen_cards[card_type] > 0
        }
        number_unseen_cards = sum(pool.values()) # including Guard cards, so true odds
        odds: dict[type[Card], float] = {
            card_type: count / number_unseen_cards for card_type, count in pool.items()
        }

        if self.debug:
            print("----- DEBUG -----")
            if not pool:
                print("    ERROR: no pool counted, odds are empty")
            print(f"    There are {number_unseen_cards} unseen cards left.")
            print(f"    distribution: {unseen_cards}")
            print(f"\n    The odds per (guessable) card type are:")
            print(f"    {odds}")
            print(f"----- /DEBUG -----")

        return {s: dict(odds) for s in opponent_seats(view)}

    def guard_guess(self, player, target):
        assert player.view is not None

        odds = {
            card_type: p
            for card_type, p in self.hand_odds(player.view)[target.seat].items()
            if card_type is not Guard and p > 0
        }
        if not odds: return random.choice(GUESSABLE_TYPES)()

        highest_odds = max(odds.values())
        most_likely_types = [card_type for card_type, p in odds.items() if p == highest_odds]
        guess = random.choice(most_likely_types)

        if self.debug:
            print(f"    {most_likely_types} are most likely, picking randomly")
            print(f"    guess: {guess}")

        return guess()


class CardCounterV2(CardCounter):
    def __init__(self) -> None:
        self.id = "CardCounterV2"
        self.name = "Card Counter Bot v2"
        self.description = "It still chooses the most likely card when guessing with the Guard, just in a different way."
        self.debug = False

    def possible_cards(self, view: PlayerView) -> dict[int, set[type[Card]]]:
        return {seat: set(CARD_TYPES) for seat in opponent_seats(view)}

    def hand_odds(self, view: PlayerView) -> dict[int, dict[type[Card], float]]:
        possible = self.possible_cards(view)
        seats = list(possible)
        unseen_cards = unseen(view)

        totals: dict[int, Counter[type[Card]]] = {s: Counter() for s in seats}
        total_weight = 0
        
        for combination in itertools.product(*(sorted(possible[s], key=lambda t: t.value) for s in seats)):
            remaining = unseen_cards.copy()
            weight = 1
            for card_type in combination:
                weight *= max(remaining[card_type], 0)
                remaining[card_type] -= 1
            if weight == 0:
                continue
            total_weight += weight
            for seat, card_type in zip(seats, combination):
                totals[seat][card_type] += weight

        if total_weight == 0:
            return {seat: {} for seat in seats}
        return {
            seat: {card_type: w / total_weight 
                   for card_type, w in totals[seat].items()
                   }
            for seat in seats
        }


class FastCardCounterV2(CardCounterV2):
    """CardCounterV2 with the same odds, computed faster. Ties come in card-value order."""
    def __init__(self) -> None:
        self.id = "FastCardCounterV2"
        self.name = "Fast Card Counter Bot v2"
        self.description = "Card Counter Bot v2 with the same odds, computed much faster."
        self.debug = False
        _prefill_cache()

    def hand_odds(self, view: PlayerView) -> dict[int, dict[type[Card], float]]:
        possible = self.possible_cards(view)
        options = tuple(
            _ALL_TYPES if len(types) == len(CARD_TYPES) else frozenset(_INDEX[t] for t in types)
            for types in possible.values()
        )
        rows = _typed_odds(_unseen_counts(view), options)
        return {seat: dict(row) for seat, row in zip(possible, rows)}  # copies: the cached rows stay untouched


_INDEX: dict[type[Card], int] = {t: i for i, t in enumerate(CARD_TYPES)}
_ALL_TYPES = frozenset(range(len(CARD_TYPES)))
_FULL_COUNTS = [FULL[t] for t in CARD_TYPES]

def _unseen_counts(view: PlayerView) -> tuple[int, ...]:
    """unseen(view) as a tuple in CARD_TYPES order, without building a Counter."""
    counts = _FULL_COUNTS.copy()
    for card in view.hand:
        counts[_INDEX[type(card)]] -= 1
    for player in view.players:
        for card in player.discards:
            counts[_INDEX[type(card)]] -= 1
    return tuple(c if c > 0 else 0 for c in counts)

@functools.lru_cache(maxsize=1 << 16)
def _typed_odds(counts: tuple[int, ...], options: tuple[frozenset[int], ...]) -> tuple[dict[type[Card], float], ...]:
    """_joint_odds as {card type: probability} per opponent, zeros left out. Cached."""
    return tuple(
        {CARD_TYPES[i]: p for i, p in enumerate(row) if p > 0}
        for row in _joint_odds(counts, options)
    )

def _joint_odds(counts: tuple[int, ...], options: tuple[frozenset[int], ...]) -> tuple[tuple[float, ...], ...]:
    """Same odds as CardCounterV2.hand_odds, one row per opponent, columns in CARD_TYPES order.

    Opponents who can hold any type are left out of the enumeration (they only add a constant
    factor); their odds are the expected leftover counts divided by the cards left.
    """
    n = len(counts)
    constrained = [k for k, opts in enumerate(options) if not opts >= _ALL_TYPES]
    branches = [sorted(options[k]) for k in constrained]
    remaining = list(counts)
    picked = [0] * len(constrained)
    seat_weight = [[0] * n for _ in options]
    leftover_weight = [0] * n
    total = 0

    def visit(depth: int, weight: int) -> None:
        nonlocal total
        if depth == len(constrained):
            total += weight
            for k, i in zip(constrained, picked):
                seat_weight[k][i] += weight
            for i in range(n):
                leftover_weight[i] += weight * remaining[i]
            return
        for i in branches[depth]:
            c = remaining[i]
            if c <= 0:
                continue
            remaining[i] = c - 1
            picked[depth] = i
            visit(depth + 1, weight * c)
            remaining[i] = c

    visit(0, 1)
    cards_left = sum(counts) - len(constrained)
    if total == 0 or cards_left < len(options) - len(constrained):
        return tuple((0.0,) * n for _ in options)

    rows: list[tuple[float, ...]] = []
    for k in range(len(options)):
        if k in constrained:
            rows.append(tuple(w / total for w in seat_weight[k]))
        else:
            rows.append(tuple(w / (total * cards_left) for w in leftover_weight))
    return tuple(rows)


_prefilled = False

def _prefill_cache() -> None:
    """Fill the cache for every unconstrained case (~12k entries, ~60 ms), once per process."""
    global _prefilled
    if _prefilled:
        return
    for counts in itertools.product(*(range(FULL[t] + 1) for t in CARD_TYPES)):
        for opponents in (1, 2, 3):
            _typed_odds(counts, (_ALL_TYPES,) * opponents)
    _prefilled = True

@dataclass
class Plan:
    """A whole turn, decided at once in choose_card."""
    card: Card
    target: int | None = None  # seat, for targeted cards
    guess: type[Card] | None = None  # for a Guard


class CardCounterV3(FastCardCounterV2):
    """FastCardCounterV2's decisions, restructured: the turn is planned in one go.

    choose_card works out what the bot knows (`knowledge`, see bots/knowledge.py)
    and the odds on every opponent's hand, then `plan_turn` picks the card, the
    target and the guess together. The engine's later questions (target, guess)
    just read the plan. Subclasses override plan_turn, and switch on more kinds of
    knowledge with the class flags.

    This step only uses the face-up cards, like V2, so it should win exactly as
    often as FastCardCounterV2 (not the same games: the random calls come in a
    different order).
    """
    private_knowledge = False  # my Priest looks, my King swaps
    missed_guesses = False  # wrong Guard guesses rule a type out

    def __init__(self) -> None:
        super().__init__()
        self.id = "CardCounterV3"
        self.name = "Card Counter Bot v3"
        self.description = "Card Counter Bot v2, but it plans the whole turn at once from what it knows."
        self.plan: Plan | None = None
        self._knowledge: tuple[PlayerView, Knowledge] | None = None

    # ----- what I know -----

    def knowledge(self, view: PlayerView) -> Knowledge:
        """Knowledge for this view, worked out once per turn."""
        if self._knowledge is None or self._knowledge[0] is not view:
            k = Knowledge.from_view(view, private=self.private_knowledge, missed_guesses=self.missed_guesses)
            self._knowledge = (view, k)
        return self._knowledge[1]

    def possible_cards(self, view: PlayerView) -> dict[int, set[type[Card]]]:
        return {seat: set(types) for seat, types in self.knowledge(view).possible.items()}

    # ----- the plan -----

    def plan_turn(self, view: PlayerView, playable: list[Card]) -> Plan:
        """V2's choices: a random card (never the Princess), then plan_for."""
        card = random.choice([c for c in playable if not isinstance(c, Princess)] or playable)
        return self.plan_for(view, card)

    def plan_for(self, view: PlayerView, card: Card) -> Plan:
        """V2's target and guess for a chosen card: a random target (not myself with
        a Prince while I keep the Princess), and the likeliest card for a Guard."""
        if not card.targeted:
            return Plan(card)
        others = opponents(view)
        if isinstance(card, Prince):
            keeps_princess = isinstance(kept(view, card), Princess)
            target = random.choice(others or [view.seat]) if keeps_princess else random.choice([*others, view.seat])
        else:
            target = random.choice(others)
        return Plan(card, target, self.best_guess(view, target) if isinstance(card, Guard) else None)

    def best_guess(self, view: PlayerView, seat: int) -> type[Card]:
        """The likeliest guessable card in `seat`'s hand (a random one of the ties)."""
        odds = {t: p for t, p in self.hand_odds(view)[seat].items() if t is not Guard}
        if not odds:
            return random.choice(GUESSABLE_TYPES)
        best = max(odds.values())
        return random.choice([t for t, p in odds.items() if p == best])

    # ----- the engine's questions -----

    def choose_card(self, player: Player, playable: list[Card]) -> Card:
        assert player.view is not None
        self.plan = self.plan_turn(player.view, playable)
        return self.plan.card

    def choose_target(self, player: Player, card: Card, targets: list[Player]) -> Player:
        assert self.plan is not None and self.plan.card is card
        for target in targets:
            if target.seat == self.plan.target:
                return target
        raise ValueError(f"{self.name} planned an illegal target: seat {self.plan.target}")

    def guard_guess(self, player: Player, target: Player) -> Card:
        assert self.plan is not None and self.plan.guess is not None
        return self.plan.guess()


def opponents(view: PlayerView) -> list[int]:
    """Seats I could target, other than myself: everyone still in (protected ones too)."""
    return [p.seat for p in view.players if p.seat != view.seat and not p.rejected]


def kept(view: PlayerView, card: Card) -> Card:
    """The card left in my hand if I play `card`."""
    return next(c for c in view.hand if c is not card)
