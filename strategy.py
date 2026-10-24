from __future__ import annotations
from typing import TYPE_CHECKING

import random
from cards import *
if TYPE_CHECKING:
  from game import Game
  from player import Player



@staticmethod
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
  def __init__(self, name: str) -> None:
    self.name = name

  def choose_card(self, player: Player):
    raise NotImplementedError


  def choose_guard_target(self, player: Player, targets: list[Player]) -> Player:
    raise NotImplementedError

  def choose_priest_target(self, player: Player, targets: list[Player]) -> Player:
    raise NotImplementedError

  def choose_baron_target(self, player: Player, targets: list[Player]) -> Player:
    raise NotImplementedError

  def choose_prince_target(self, player: Player, targets: list[Player]) -> Player:
    raise NotImplementedError

  def choose_king_target(self, player: Player, targets: list[Player]) -> Player:
    raise NotImplementedError

  
  def guard_guess(self, game: Game, player: Player, target: Player) -> Card:
    raise NotImplementedError



class Player_Strategy(Strategy): # asks for user input regarding all actions.
  def __init__(self, name: str) -> None:
    super().__init__("Player Input")


  def choose_card(self, player: Player) -> Card:
    options = [f"{card.name} ({card.value})" for card in player.hand]
    chosen_idx = _choose_from_menu(f"{player.name}, choose a card to play:", options)
    chosen_card = player.hand[chosen_idx]
    
    return chosen_card


  def choose_guard_target(self, player: Player, targets: list[Player]) -> Player:
    options = [f"{target.name}" for target in targets]
    chosen_idx = _choose_from_menu(f"{player.name}, choose a player to target with your Guard:", options)
    chosen_target = targets[chosen_idx]
    return chosen_target

  def choose_priest_target(self, player: Player, targets: list[Player]) -> Player:
    options = [f"{target.name}" for target in targets]
    chosen_idx = _choose_from_menu(f"{player.name}, choose a player to target with your Priest:", options)
    chosen_target = targets[chosen_idx]
    return chosen_target

  def choose_baron_target(self, player: Player, targets: list[Player]) -> Player:
    options = [f"{target.name}" for target in targets]
    chosen_idx = _choose_from_menu(f"{player.name}, choose a player to target with your Baron:", options)
    chosen_target = targets[chosen_idx]
    return chosen_target

  def choose_prince_target(self, player: Player, targets: list[Player]) -> Player:
    options = [f"{target.name}" for target in targets]
    chosen_idx = _choose_from_menu(f"{player.name}, choose a player to target with your Prince:", options)
    chosen_target = targets[chosen_idx]
    return chosen_target

  def choose_king_target(self, player: Player, targets: list[Player]) -> Player:
    options = [f"{target.name}" for target in targets]
    chosen_idx = _choose_from_menu(f"{player.name}, choose a player to target with your King:", options)
    chosen_target = targets[chosen_idx]
    return chosen_target

  
  def guard_guess(self, game: Game, player: Player, target: Player) -> Card:
    options = [Guard(), Priest(), Baron(), Handmaid(), Prince(), King(), Countess(), Princess()]
    chosen_idx = _choose_from_menu(
      f"{player.name}, guess {target.name}'s card:", 
      [card.name for card in options]
      )
    chosen_card = options[chosen_idx]
    return chosen_card



class Random_Strategy(Strategy): # picks a random target regarding all actions.
  def __init__(self, name: str) -> None:
    super().__init__("Random Choice")

  def choose_card(self, player: Player) -> Card:
    return random.choice(player.hand)


  def choose_guard_target(self, player: Player, targets: list[Player]) -> Player:
    return random.choice(targets)

  def choose_priest_target(self, player: Player, targets: list[Player]) -> Player:
    return random.choice(targets)

  def choose_baron_target(self, player: Player, targets: list[Player]) -> Player:
    return random.choice(targets)

  def choose_prince_target(self, player: Player, targets: list[Player]) -> Player:
    return random.choice(targets)

  def choose_king_target(self, player: Player, targets: list[Player]) -> Player:
    return random.choice(targets)

  
  def guard_guess(self, game: Game, player: Player, target: Player) -> Card:
    chosen_card = random.choice([Guard(), Priest(), Baron(), Handmaid(), Prince(), King(), Countess(), Princess()])
    return chosen_card