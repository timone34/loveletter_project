from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from .cards import Baron, Card, Guard, King, Priest, Prince

if TYPE_CHECKING:
    from .player import Player
    from .view import PlayerView


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


@dataclass(frozen=True)
class Action:
    card: type[Card]
    target: int | None = None        # seat
    guess: type[Card] | None = None


class PlanningStrategy(Strategy):  # bots write only decide(); the engine's questions are answered from its plan
    plan: Action | None = None

    def decide(self, view: PlayerView) -> Action:
        raise NotImplementedError("PlanningStrategy should not be instanced")

    def choose_card(self, player: Player, playable: list[Card]) -> Card:
        assert player.view is not None
        self.plan = self.decide(player.view)
        for card in playable:
            if type(card) is self.plan.card:
                return card
        raise ValueError(f"{self.name} planned to play a {self.plan.card.name} it can't play")

    def choose_target(self, player: Player, card: Card, targets: list[Player]) -> Player:
        assert self.plan is not None
        for target in targets:
            if target.seat == self.plan.target:
                return target
        raise ValueError(f"{self.name} planned an illegal target for the {card.name}")

    def guard_guess(self, player: Player, target: Player) -> Card:
        assert self.plan is not None and self.plan.guess is not None, f"{self.name} planned a Guard without a guess"
        return self.plan.guess()
