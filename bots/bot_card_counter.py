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
    """CardCounterV2 with the exact same odds, computed much faster.

    Two things make it fast:
    1. Opponents we know nothing about aren't looped over (see _joint_odds).
    2. The odds only depend on the unseen counts and what we know about each
       opponent, so each situation is computed once and then looked up (lru_cache).
    """
    def __init__(self) -> None:
        self.id = "FastCardCounterV2"
        self.name = "Fast Card Counter Bot v2"
        self.description = "Card Counter Bot v2 with the same odds, computed much faster."
        self.debug = False
        self._prefill_cache()

    def hand_odds(self, view: PlayerView) -> dict[int, dict[type[Card], float]]:
        possible = self.possible_cards(view)
        seats = list(possible)
        unseen_cards = unseen(view)

        # tuples and frozensets, so the situation can be a key in the cache
        counts = tuple(max(unseen_cards[card_type], 0) for card_type in CARD_TYPES)
        options = tuple(frozenset(possible[seat]) for seat in seats)

        odds = self._joint_odds(counts, options)
        return {seat: dict(odds[i]) for i, seat in enumerate(seats)}  # copies, so the cached dicts stay untouched

    @staticmethod
    @functools.lru_cache(maxsize=1 << 16)  # under @staticmethod: one cache for every instance, without self in the key
    def _joint_odds(counts: tuple[int, ...], options: tuple[frozenset[type[Card]], ...]) -> tuple[dict[type[Card], float], ...]:
        """CardCounterV2.hand_odds, one dict per opponent (in the order of `options`).

        counts:  how many of each card type are unseen, in CARD_TYPES order
        options: per opponent, the card types they could be holding

        Like CardCounterV2, it loops over every combination of cards the opponents
        could hold, weighted by how many ways the unseen cards allow it. But only the
        opponents we know something about are looped over ("known"). An opponent who
        could hold anything just holds one of the cards left after the known opponents
        took theirs, so their odds are those leftover cards, counted over all combinations.
        """
        unseen_cards = Counter({card_type: count for card_type, count in zip(CARD_TYPES, counts)})
        known = [i for i, types in enumerate(options) if types != ALL_TYPES]
        unknown = [i for i in range(len(options)) if i not in known]

        known_totals: dict[int, Counter[type[Card]]] = {i: Counter() for i in known}
        leftover_totals: Counter[type[Card]] = Counter()  # the cards left over, summed over all combinations
        total_weight = 0

        for combination in itertools.product(*(sorted(options[i], key=lambda t: t.value) for i in known)):
            remaining = unseen_cards.copy()
            weight = 1
            for card_type in combination:
                weight *= max(remaining[card_type], 0)
                remaining[card_type] -= 1
            if weight == 0:
                continue
            total_weight += weight
            for i, card_type in zip(known, combination):
                known_totals[i][card_type] += weight
            for card_type, count in remaining.items():
                leftover_totals[card_type] += weight * count

        cards_left = sum(counts) - len(known)  # the same for every combination
        if total_weight == 0 or cards_left < len(unknown):
            return tuple({} for _ in options)

        odds: list[dict[type[Card], float]] = []
        for i in range(len(options)):
            if i in known:
                weights, total = known_totals[i], total_weight
            else:
                weights, total = leftover_totals, total_weight * cards_left
            # in CARD_TYPES order and without zeros, like before (the order decides ties in guard_guess)
            odds.append({card_type: weights[card_type] / total for card_type in CARD_TYPES if weights[card_type] > 0})
        return tuple(odds)

    @staticmethod
    def _prefill_cache() -> None:
        """Fill the cache for every situation where we know nothing about anyone
        (~12k situations, ~0.1 s), so the first games aren't slower than the rest.
        Only done once per process."""
        if FastCardCounterV2._joint_odds.cache_info().currsize > 0:
            return
        for counts in itertools.product(*(range(FULL[card_type] + 1) for card_type in CARD_TYPES)):
            for opponents in (1, 2, 3):
                FastCardCounterV2._joint_odds(counts, (ALL_TYPES,) * opponents)
