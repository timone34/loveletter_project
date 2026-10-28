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
        raise RuntimeError("Card class should not be instantiated and thus can't be resolved.")


class Guard(Card):
    def __init__(self):
        super().__init__(1, "Guard")
      
    def resolve(self, game: Game, player: Player) -> None:
      targets = game.get_valid_targets(player, allow_self=False)
      target = player.strategy.choose_guard_target(player, targets)
      guess = player.strategy.guard_guess(game, player, target)
      print(f"{player.name} guesses that {target.name} has a {guess.name}.")

      if target.hand[0].value == guess.value:
        game.eliminate_player(target)

        print(f"\nCorrect! {target.name} is eliminated.")
        return
      
      print(f"\nIncorrect!")

      return



class Priest(Card):
    def __init__(self):
        super().__init__(2, "Priest")

    def resolve(self, game, player) -> None:
      targets = game.get_valid_targets(player, allow_self=False)
      target = player.strategy.choose_priest_target(player, targets)
      print(f"{player.name} targets {target.name} with a Priest.")

      print(f"{target.name} has a {target.hand[0].name}.")

      return


class Baron(Card):
    def __init__(self):
        super().__init__(3, "Baron")

    def resolve(self, game, player) -> None:
      targets = game.get_valid_targets(player, allow_self=False)
      target = player.strategy.choose_baron_target(player, targets)
      print(f"{player.name} targets {target.name} with a Baron.")

      player_card_value = player.hand[0].value
      target_card_value = target.hand[0].value

      # determine winner
      if player_card_value > target_card_value:
          winner = player
          loser = target
      elif player_card_value < target_card_value:
          winner = target
          loser = player
      elif player_card_value == target_card_value:
          print(f"The comparison between {player.name} and {target.name} ended in a draw...")
          return
      else:
          raise RuntimeError("Baron comparison failed. Something went wrong.")
      
      # eliminate loser
      print(f"The winner is {winner.name}! {loser.name} is rejected!")
      game.eliminate_player(loser)

      return


class Handmaid(Card):
    def __init__(self):
        super().__init__(4, "Handmaid")

    def resolve(self, game, player) -> None:
        player.protected = True
        print(f"{player.name} is now protected.")

        return


class Prince(Card):
    def __init__(self):
        super().__init__(5, "Prince")

    def resolve(self, game, player) -> None:
        targets = game.get_valid_targets(player, allow_self=True)
        target = player.strategy.choose_prince_target(player, targets)
        print(f"{player.name} targets {target.name} with a Prince.")

        discarded_card = target.hand.pop()
        target.discard.append(discarded_card)
        print(f"{player.name}'s Prince makes {target.name} discard a {discarded_card.name}")

        # check if discarded card was Princess and eliminate accordingly
        if isinstance(discarded_card, Princess):
            print(f"{player.name}'s Prince makes {target.name} discard the Princess. {target.name} is rejected!")
            game.eliminate_player(target)
            return

        # draw new card for target
        if game.deck.cards_left() > 0:
            drawn_card = game.deck.draw_card()
            target.hand.append(drawn_card)
            print(f"{target.name} draws a card: {drawn_card.name}")
        else:
            print(f"The deck is empty. {target.name} draws the discarded card: {game.discarded_card.name}")
            target.hand.append(game.discarded_card)

        return


class King(Card):
    def __init__(self):
        super().__init__(6, "King")

    def resolve(self, game, player) -> None:
        targets = game.get_valid_targets(player, allow_self=False)
        target = player.strategy.choose_king_target(player, targets)
        print(f"{player.name} targets {target.name} with a King.")

        # swap hands
        player.hand, target.hand = target.hand, player.hand
        print(f"{player.name} and {target.name} swap hands.")

        # debug
        # print(f"{player.name}'s hand: {[card.name for card in player.hand]}")
        # print(f"{target.name}'s hand: {[card.name for card in target.hand]}")

        return


class Countess(Card):
    def __init__(self):
        super().__init__(7, "Countess")

    def resolve(self, game, player) -> None:
        pass


class Princess(Card):
    def __init__(self):
        super().__init__(8, "Princess")

    def resolve(self, game, player) -> None:
        print(f"If you see this, you're an idiot.")
        return