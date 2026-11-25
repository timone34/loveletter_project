from __future__ import annotations

import functools
import itertools
import random
from collections import Counter
from typing import TYPE_CHECKING

from bots import NoPrincess
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
        seats = list(possible)
        unseen_cards = unseen(view)

        counts = tuple(max(unseen_cards[t], 0) for t in CARD_TYPES)
        options = tuple(frozenset(_INDEX[t] for t in possible[s]) for s in seats)
        rows = _joint_odds(counts, options)
        return {
            seat: {CARD_TYPES[i]: p for i, p in enumerate(row) if p > 0}
            for seat, row in zip(seats, rows)
        }


_INDEX: dict[type[Card], int] = {t: i for i, t in enumerate(CARD_TYPES)}
_ALL_TYPES = frozenset(range(len(CARD_TYPES)))

@functools.lru_cache(maxsize=1 << 16)
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
            _joint_odds(counts, (_ALL_TYPES,) * opponents)
    _prefilled = True