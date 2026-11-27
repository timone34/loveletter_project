from __future__ import annotations

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
        self.family, self.version = "Card Counter", "v1"
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
        self.family, self.version = "Card Counter", "v2 (slow)"
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


class FastCardCounterV2(CardCounter):
    def __init__(self) -> None:
        self.id = "FastCardCounterV2"
        self.family, self.version = "Card Counter", "v2"
        self.name = "Fast Card Counter Bot v2"
        self.description = "Card Counter Bot v2 with the same odds, computed much faster."
        self.debug = False

    def possible_cards(self, view: PlayerView) -> dict[int, set[type[Card]]]:
        return {seat: set(CARD_TYPES) for seat in opponent_seats(view)}

    def hand_odds(self, view: PlayerView) -> dict[int, dict[type[Card], float]]:
        possible = self.possible_cards(view)

        # someone's hand narrowed down (by a subclass that knows more): the loop
        if any(len(types) != len(CARD_TYPES) for types in possible.values()):
            return self.narrowed_hand_odds(view, possible)

        # nobody narrowed down: everyone holds a random one of the unseen cards
        unseen_cards = unseen(view)
        number_unseen_cards = sum(unseen_cards.values())
        odds = {
            card_type: unseen_cards[card_type] / number_unseen_cards
            for card_type in CARD_TYPES if unseen_cards[card_type] > 0
        }
        return {seat: dict(odds) for seat in possible}

    def narrowed_hand_odds(self, view: PlayerView, possible: dict[int, set[type[Card]]]) -> dict[int, dict[type[Card], float]]:
        """CardCounterV2.hand_odds: every combination of cards the opponents could
        hold, weighted by how many ways the unseen cards allow it."""
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
        # in CARD_TYPES order, like hand_odds (the order decides ties in guard_guess)
        return {
            seat: {card_type: totals[seat][card_type] / total_weight for card_type in CARD_TYPES if totals[seat][card_type] > 0}
            for seat in seats
        }
