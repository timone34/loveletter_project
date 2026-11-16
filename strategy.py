from __future__ import annotations

import random
from collections import Counter
from typing import TYPE_CHECKING

from cards import *
from deck import Deck

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


def _choose_from_menu(title: str, options: list[str]) -> int:
    while True:
        print(f"\n{title}\n")

        for i, option in enumerate(options, start=1):
            print(f"{i}. {option}")

        try:
            choice = int(input("> "))

            if 1 <= choice <= len(options):
                return choice - 1

        except ValueError:
            pass

        print("Invalid choice.\n")


class Strategy:
    def __init__(self) -> None:
        self.name = "Base Strategy"

    # --- Decisions every bot must make --- #
    def choose_card(self, player: Player, playable: list[Card]) -> Card:
        return random.choice(playable)

    def choose_target(
        self, player: Player, card: Card, targets: list[Player]
    ) -> Player:
        return random.choice(targets)

    def guard_guess(self, player: Player, target: Player) -> Card:
        return random.choice(guessable())


class Player_Strategy(Strategy):  # asks for user input regarding all actions.
    def __init__(self) -> None:
        self.name = "Player Input"

    def choose_card(self, player: Player, playable: list[Card]) -> Card:
        if len(playable) < len(player.hand):
            print(f"{player.name} must play Countess.")

        chosen_idx = _choose_from_menu(
            f"{player.name}, choose a card to play:",
            [f"{c.name} ({c.value})" for c in playable],
        )
        return playable[chosen_idx]

    def choose_target(
        self, player: Player, card: Card, targets: list[Player]
    ) -> Player:
        chosen_idx = _choose_from_menu(
            f"{player.name}, choose a player to target with your {card.name}:",
            [t.name for t in targets],
        )
        return targets[chosen_idx]

    def guard_guess(self, player: Player, target: Player) -> Card:
        options = guessable()
        chosen_idx = _choose_from_menu(
            f"{player.name}, guess {target.name}'s card:",
            [card.name for card in options],
        )
        return options[chosen_idx]


class Random_Strategy(Strategy):  # picks a random target regarding all actions.
    def __init__(self) -> None:
        self.name = "Random Strategy"

    def choose_card(self, player: Player, playable: list[Card]) -> Card:
        return random.choice(playable)

    def choose_target(
        self, player: Player, card: Card, targets: list[Player]
    ) -> Player:
        return random.choice(targets)

    def guard_guess(self, player: Player, target: Player) -> Card:
        return random.choice(guessable())


class No_Princess(Strategy):
    def __init__(self) -> None:
        self.name = "No Princess"

    def choose_card(self, player, playable):
        candidates = [c for c in playable if not isinstance(c, Princess)] or playable
        return random.choice(candidates)

    def choose_target(self, player, card, targets):
        return random.choice(targets)

    def guard_guess(self, player, target):
        return random.choice(guessable())


class Card_Counter(Strategy):
    def __init__(self) -> None:
        self.name = "Card Counter"

    def guard_guess(self, player: Player, target: Player) -> Card:
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

    def choose_card(self, player: Player, playable: list[Card]) -> Card:
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

    def choose_target(
        self, player: Player, card: Card, targets: list[Player]
    ) -> Player:
        # Uses public protection status and seat, plus own hand for Princess safety.
        view = player.view
        assert view is not None
        unprotected = {p.seat for p in view.players if not p.protected}
        candidates = [t for t in targets if t.seat in unprotected] or targets
        if isinstance(card, Prince) and isinstance(player.hand[0], Princess):
            candidates = [t for t in candidates if t.seat != player.seat] or targets
        return random.choice(candidates)
