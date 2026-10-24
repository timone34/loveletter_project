from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from game import Game
    from player import Player



class Card:
    def __init__(self, value: int, name: str):
        self.value = value
        self.name = name
    
    def resolve(self, game, player) -> None:
        pass


class Guard(Card):
    def __init__(self):
        super().__init__(1, "Guard")
      
    def resolve(self, game: Game, player: Player) -> None:
      targets = game.get_valid_targets(player, allow_self=False)
      target = player.strategy.choose_guard_target(player, targets)
      guess = player.strategy.guard_guess(game, player, target)

      if target.hand[0].value == guess.value:
        game.eliminate_player(target)

        print(f"\nCorrect! {target.name} is eliminated.")
        return
      
      print(f"\nIncorrect!")



class Priest(Card):
    def __init__(self):
        super().__init__(2, "Priest")

    def resolve(self, game, player) -> None:
      targets = game.get_valid_targets(player, allow_self=False)
      target = player.strategy.choose_priest_target(player, targets)

      print(f"{target.name} has a {target.hand[0].name}.")


class Baron(Card):
    def __init__(self):
        super().__init__(3, "Baron")

    def resolve(self, game, player) -> None:
      targets = game.get_valid_targets(player, allow_self=False)
      target = player.strategy.choose_baron_target(player, targets)


class Handmaid(Card):
    def __init__(self):
        super().__init__(4, "Handmaid")

    def resolve(self, game, player) -> None:
        player.protected = True
        print(f"{player.name} is now protected.")


class Prince(Card):
    def __init__(self):
        super().__init__(5, "Prince")

    def resolve(self, game, player) -> None:
        pass


class King(Card):
    def __init__(self):
        super().__init__(6, "King")

    def resolve(self, game, player) -> None:
        pass


class Countess(Card):
    def __init__(self):
        super().__init__(7, "Countess")

    def resolve(self, game, player) -> None:
        pass


class Princess(Card):
    def __init__(self):
        super().__init__(8, "Princess")

    def resolve(self, game, player) -> None:
        pass