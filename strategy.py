from __future__ import annotations

import random
from typing import TYPE_CHECKING

from cards import *

if TYPE_CHECKING:
    from player import Player


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
    def __init__(self):
        self.id = "Strategy"
        self.name = "Base Strategy"
        self.description = "This Strategy forms the base of all strategies."

    def choose_card(self, player: Player, playable: list[Card]) -> Card:
        raise NotImplementedError("Base Strategy should not be instanced")

    # router: Card.resolve calls this, bots usually override the hooks below instead
    def choose_target(self, player: Player, card: Card, targets: list[Player]) -> Player:
        if isinstance(card, Guard):  return self.choose_guard_target(player, targets)
        if isinstance(card, Priest): return self.choose_priest_target(player, targets)
        if isinstance(card, Baron):  return self.choose_baron_target(player, targets)
        if isinstance(card, Prince): return self.choose_prince_target(player, targets)
        if isinstance(card, King):   return self.choose_king_target(player, targets)
        raise NotImplementedError("Base Strategy should not be instanced")

    def choose_guard_target(self, player: Player, targets: list[Player]) -> Player:  raise NotImplementedError("Base Strategy should not be instanced")
    def choose_priest_target(self, player: Player, targets: list[Player]) -> Player: raise NotImplementedError("Base Strategy should not be instanced")
    def choose_baron_target(self, player: Player, targets: list[Player]) -> Player:  raise NotImplementedError("Base Strategy should not be instanced")
    def choose_prince_target(self, player: Player, targets: list[Player]) -> Player: raise NotImplementedError("Base Strategy should not be instanced")
    def choose_king_target(self, player: Player, targets: list[Player]) -> Player:   raise NotImplementedError("Base Strategy should not be instanced")

    def guard_guess(self, player: Player, target: Player) -> Card:
        raise NotImplementedError("Base Strategy should not be instanced")


class TerminalPlayer(Strategy):  # asks for user input regarding all actions.
    def __init__(self) -> None:
        self.id = "TerminalPlayer"
        self.name = "Player Input"
        self.description = "This Strategy asks the user for input through the python terminal."

    def choose_card(self, player, playable):
        if len(playable) < len(player.hand):
            print(f"{player.name} must play Countess.")

        chosen_idx = _choose_from_menu(
            f"{player.name}, choose a card to play:",
            [f"{c.name} ({c.value})" for c in playable],
        )
        return playable[chosen_idx]

    def choose_target(self, player, card, targets):
        chosen_idx = _choose_from_menu(
            f"{player.name}, choose a player to target with your {card.name}:",
            [t.name for t in targets],
        )
        return targets[chosen_idx]

    def guard_guess(self, player, target):
        options = guessable()
        chosen_idx = _choose_from_menu(
            f"{player.name}, guess {target.name}'s card:",
            [card.name for card in options],
        )
        return options[chosen_idx]