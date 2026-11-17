from __future__ import annotations

from typing import TYPE_CHECKING

from history import Outcome

if TYPE_CHECKING:
    from game import Round, Turn
    from player import Player


class Card:
    value: int
    name: str
    targeted: bool = False  # does the card need a target?
    self_target: bool = False  # may the player target themself?

    def resolve(self, player: Player, rnd: Round, turn: Turn) -> None:
        # The card does not require a target
        if not self.targeted:
            self.apply(player, player, rnd, turn)
            return

        # The card does require a target
        targets = rnd.get_valid_targets(player, allow_self=self.self_target)

        # # ... but can't find one
        # if not targets:
        #   turn.history.outcome = Outcome.NO_TARGET
        #   return

        # ... and finds targets
        target = player.strategy.choose_target(player, self, targets)
        if target not in targets:
            raise ValueError(
                f"{player.strategy.name} chose an illegal target for the {self.name}"
            )
        turn.history.target = target.seat

        # verify target protection
        if target.protected:
            turn.history.outcome = Outcome.PROTECTED
            return

        # if all is in order, apply effect to target
        self.apply(player, target, rnd, turn)

    def apply(self, player: Player, target: Player, rnd: Round, turn: Turn) -> None:
        pass


class Guard(Card):
    value, name, targeted, self_target = 1, "Guard", True, False

    def apply(self, player, target, rnd, turn):
        guess = player.strategy.guard_guess(player, target)
        if isinstance(guess, Guard):
            raise TypeError("Guard cannot guess Guard.")
        turn.history.guess = guess

        if target.hand[0].value == guess.value:
            rnd.eliminate(target, turn)
            turn.history.outcome = Outcome.CORRECT
            return
        else:
            turn.history.outcome = Outcome.INCORRECT


class Priest(Card):
    value, name, targeted, self_target = 2, "Priest", True, False

    def apply(self, player, target, rnd, turn):
        turn.history.seen = target.hand[0]


class Baron(Card):
    value, name, targeted, self_target = 3, "Baron", True, False

    def apply(self, player, target, rnd, turn):
        mine, theirs = player.hand[0].value, target.hand[0].value

        if mine > theirs:
            turn.history.outcome = Outcome.WIN
            rnd.eliminate(target, turn)
        if mine < theirs:
            turn.history.outcome = Outcome.LOSE
            rnd.eliminate(player, turn)
        if mine == theirs:
            turn.history.outcome = Outcome.DRAW


class Handmaid(Card):
    value, name, targeted, self_target = 4, "Handmaid", False, False

    def apply(self, player, target, rnd, turn):
        player.protected = True


class Prince(Card):
    value, name, targeted, self_target = 5, "Prince", True, True

    def apply(self, player, target, rnd, turn):
        discarded = target.hand.pop()
        target.discard.append(discarded)
        turn.history.discarded = discarded

        if isinstance(discarded, Princess):
            rnd.eliminate(target, turn)
            return

        redrawn = rnd.draw_replacement()
        target.hand.append(redrawn)
        turn.history.redrawn = redrawn


class King(Card):
    value, name, targeted, self_target = 6, "King", True, False

    def apply(self, player, target, rnd, turn):
        player.hand, target.hand = target.hand, player.hand
        turn.history.received = player.hand[0]


class Countess(Card):
    value, name, targeted, self_target = 7, "Countess", False, False


class Princess(Card):
    value, name, targeted, self_target = 8, "Princess", False, False

    def apply(self, player, target, rnd, turn):
        rnd.eliminate(player, turn)


def guessable() -> list[Card]:
    return [Priest(), Baron(), Handmaid(), Prince(), King(), Countess(), Princess()]
