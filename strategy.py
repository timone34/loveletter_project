from __future__ import annotations
from typing import TYPE_CHECKING

import random
from cards import *
if TYPE_CHECKING:
  from game import Game
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
  def __init__(self) -> None:
    self.name = "Base Strategy"

  def choose_card(self, player: Player) -> Card:
    raise NotImplementedError

  def countess_check(self, player:Player) -> bool:
    # check if player has countess and either king or prince in hand
    has_countess = any(isinstance(card, Countess) for card in player.hand)
    has_king_or_prince = any(isinstance(card, King) or isinstance(card, Prince) for card in player.hand)

    return has_countess and has_king_or_prince

  def _choose_card(self, player: Player) -> Card:
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
  def __init__(self) -> None:
    self.name = "Player Input"


  def choose_card(self, player: Player) -> Card:
    playable = list(player.hand)
    if self.countess_check(player):
      print(f"{player.name} must play Countess.")
      playable = [c for c in player.hand if isinstance(c, Countess)]

    chosen_idx = _choose_from_menu(f"{player.name}, choose a card to play:", [f"{c.name} ({c.value})" for c in playable])
    chosen_card = playable[chosen_idx]
    
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
    options = [Priest(), Baron(), Handmaid(), Prince(), King(), Countess(), Princess()]
    chosen_idx = _choose_from_menu(
      f"{player.name}, guess {target.name}'s card:", 
      [card.name for card in options]
      )
    chosen_card = options[chosen_idx]
    return chosen_card



class Random_Strategy(Strategy): # picks a random target regarding all actions.
  def __init__(self) -> None:
    self.name = "Random Strategy"

  def choose_card(self, player: Player) -> Card:
    playable = list(player.hand)
    if self.countess_check(player):
      print(f"{player.name} must play Countess.")
      playable = [c for c in player.hand if isinstance(c, Countess)]

    return random.choice(playable)


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
    chosen_card = random.choice([Priest(), Baron(), Handmaid(), Prince(), King(), Countess(), Princess()])
    return chosen_card