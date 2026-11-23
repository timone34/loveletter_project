from __future__ import annotations

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


class CardCounter(NoPrincess):
    def __init__(self) -> None:
        self.name = "Card Counter Bot"
        self.description = "This bot keeps track of how many cards are still unknown to it."
        self.debug = False

    # def choose_card(self, player, playable):
    #     return random.choice(playable)
            

    # def choose_target(self, player, card, targets):
    #     return random.choice(targets)
        

    def guard_guess(self, player, target):
        assert player.view is not None
        unseen_cards = unseen(player.view)
        pool = {
            card_type: unseen_cards[card_type]
            for card_type in (type(card) for card in guessable()) if unseen_cards[card_type] > 0
        }
        if not pool:
            if self.debug:
                print("----- DEBUG -----")
                print("    ERROR: no pool counted, returning random guess")
            return random.choice(guessable())

        number_unseen_cards = sum(pool.values())
        odds: dict[type[Card], float] = {}
        
        for card_type in pool.keys():
            odds[card_type] = pool[card_type] / number_unseen_cards

        highest_odds = max(odds.values())
        most_likely_types = [
            card_type 
            for card_type, type_odds in odds.items() 
            if type_odds == highest_odds
            ]

        guess = random.choice(most_likely_types)

        if self.debug:
            print("----- DEBUG -----")
            print(f"    There are {number_unseen_cards} unseen cards left.")
            print(f"    distribution: {unseen_cards}")
            print(f"\n    The odds per (guessable) card type are:")
            print(f"    {odds}")
            print(f"\n    {[type for type in most_likely_types]} are most likely, picking randomly")
            print(f"    guess: {guess}")
            print(f"----- /DEBUG -----")


        return guess()

