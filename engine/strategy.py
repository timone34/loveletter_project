from __future__ import annotations

from typing import TYPE_CHECKING

from .cards import Baron, Card, Guard, King, Priest, Prince

if TYPE_CHECKING:
    from .player import Player


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
