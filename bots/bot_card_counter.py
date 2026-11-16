from __future__ import annotations

import random
from collections import Counter
from typing import TYPE_CHECKING

from cards import *
from deck import Deck
from strategy import Strategy

if TYPE_CHECKING:
    from player import Player
    from view import PlayerView

FULL = Counter(type(c) for c in Deck().cards)


def unseen(view: PlayerView) -> Counter[type[Card]]:
    counts = FULL.copy()
    for card in view.hand:
        counts[type(card)] -= 1
    for player in view.players:
        for card in player.discards:
            counts[type(card)] -= 1
    return counts


class Card_Counter(Strategy):
    def __init__(self) -> None:
        self.name = "Card Counter"

    def guard_guess(self, player, target):
        # Uses the public unseen counts in the turn-start view.
        view = player.view
        assert view is not None
        counts = unseen(view)
        pool = {
            card_type: counts[card_type]
            for card_type in (type(card) for card in guessable())
            if counts[card_type] > 0
        }
        if not pool:
            return random.choice(guessable())
        highest = max(pool.values())
        return random.choice(
            [card_type for card_type, count in pool.items() if count == highest]
        )()

    def choose_card(self, player, playable):
        # Uses the own hand and public unseen counts in the turn-start view.
        candidates = [c for c in playable if not isinstance(c, Princess)] or playable
        barons = [c for c in candidates if isinstance(c, Baron)]
        if barons and len(candidates) > len(barons):
            view = player.view
            assert view is not None
            kept = next(c for c in player.hand if c not in barons)
            counts = unseen(view)
            total = sum(counts.values())
            if total:
                p_win = sum(
                    count
                    for card_type, count in counts.items()
                    if card_type().value < kept.value
                ) / total
                p_lose = sum(
                    count
                    for card_type, count in counts.items()
                    if card_type().value > kept.value
                ) / total
                if p_win <= p_lose:
                    candidates = [c for c in candidates if not isinstance(c, Baron)]
        return random.choice(candidates)

    def choose_target(self, player, card, targets):
        # Uses public protection status and seat, plus own hand for Princess safety.
        view = player.view
        assert view is not None
        unprotected = {p.seat for p in view.players if not p.protected}
        candidates = [t for t in targets if t.seat in unprotected] or targets
        if isinstance(card, Prince) and isinstance(player.hand[0], Princess):
            candidates = [t for t in candidates if t.seat != player.seat] or targets
        return random.choice(candidates)
