from __future__ import annotations
from typing import TYPE_CHECKING

import random
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
  def __init__(self) -> None:
    self.name = "Base Strategy"
  
  # --- Decisions every bot must make --- #
  def choose_card(self, player: Player, playable: list[Card]) -> Card:
    raise NotImplementedError

  def guard_guess(self, player: Player, target: Player) -> Card:
    raise NotImplementedError

  # --- Per-card targeting hooks: override the ones you care about --- #
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

  # --- Called by Card.resolve(). Routes to the hook for the card being played. --- #
  def choose_target(self, player: Player, card: Card, targets: list[Player]) -> Player:
    if isinstance(card, Guard):  return self.choose_guard_target(player, targets)
    if isinstance(card, Priest): return self.choose_priest_target(player, targets)
    if isinstance(card, Baron):  return self.choose_baron_target(player, targets)
    if isinstance(card, Prince): return self.choose_prince_target(player, targets)
    if isinstance(card, King):   return self.choose_king_target(player, targets)
    raise ValueError(f"{card.name} does not take a target.")



class Player_Strategy(Strategy): # asks for user input regarding all actions.
  def __init__(self) -> None:
    self.name = "Player Input"


  def choose_card(self, player: Player, playable: list[Card]) -> Card:
    if len(playable) < len(player.hand):
      print(f"{player.name} must play Countess.")

    chosen_idx = _choose_from_menu(
      f"{player.name}, choose a card to play:",
      [f"{c.name} ({c.value})" for c in playable]
      )
    return playable[chosen_idx]

  def choose_target(self, player: Player, card: Card, targets: list[Player]) -> Player:
    chosen_idx = _choose_from_menu(
      f"{player.name}, choose a player to target with your {card.name}:",
      [t.name for t in targets]
      )
    return targets[chosen_idx]

  def guard_guess(self, player: Player, target: Player) -> Card:
    options = guessable()
    chosen_idx = _choose_from_menu(
      f"{player.name}, guess {target.name}'s card:",
      [card.name for card in options]
      )
    return options[chosen_idx]
  

class Random_Strategy(Strategy): # picks a random target regarding all actions.
  def __init__(self) -> None:
    self.name = "Random Strategy"

  def choose_card(self, player: Player, playable: list[Card]) -> Card:
    return random.choice(playable)

  def choose_target(self, player: Player, card: Card, targets: list[Player]) -> Player:
    return random.choice(targets)

  def guard_guess(self, player: Player, target: Player) -> Card:
    return random.choice(guessable())
  
  