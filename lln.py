from pathlib import Path
from enum import Enum

from cards import Card, Guard, Priest, Baron, Handmaid, Prince, King, Countess, Princess
from deck import Deck
from player import Player


# Configuration
LLN_VERSION = "LLN 1.0"

PROJECT_ROOT = Path(__file__).parent
GAMES_DIRECTORY = PROJECT_ROOT / "games"

# Definitions
CARD_TO_LLN: dict[type[Card], str] = {
    Guard: "g",
    Priest: "p",
    Baron: "B",
    Handmaid: "H",
    Prince: "P",
    King: "K",
    Countess: "C",
    Princess: "Q",
}
LLN_TO_CARD: dict[str, type[Card]] = {
    "g": Guard,
    "p": Priest,
    "B": Baron,
    "H": Handmaid,
    "P": Prince,
    "K": King,
    "C": Countess,
    "Q": Princess,
}

MARKERS: dict[str, str] = {
  "PLAYER_ELIMINATED": "-",
  "TARGET_ELIMINATED": "#",
  "BARON_TARGET_ELIMINATED": "+",
  "BARON_PLAYER_ELIMINATED": "-",
  "BARON_DRAW": "=",
  "HANDMAID_PROTECTED": "?"

}


class LLNRecorder:
  def __init__(self, players: list[str]):
    self.players = players
    self.lines: list[str] = [
      f"[Version: {LLN_VERSION}]",
      f"[Players: {" ".join(f"{name!r}" for name in players)}]"
    ]

  # Saving functions
  def save_round_start(self, round_number: int, dealer: str, deck: str) -> None:
    self.lines.extend([
      f"[Round {round_number}]",
      f"[Dealer: {dealer}]",
      f"[Deck: {deck}]",
      ""
    ])
    return

  def save_turn(self, turn_number: str, notation: str, comment: str = "") -> None:
    if comment != "":
      self.lines.append(f"{turn_number} {notation} // {comment}")
      return
    self.lines.append(f"{turn_number} {notation}")
    return

  def save_round_end(self, winner_number: int) -> None:
    self.lines.extend([f"W{winner_number}", ""])
    return

  def save_game(self, filename: str) -> None:
    GAMES_DIRECTORY.mkdir(parents=True, exist_ok=True)
    path = GAMES_DIRECTORY / filename
    path.write_text("\n".join(self.lines), encoding="utf-8")
    return

  # Translating functions
  def card_to_lln(self, card: Card) -> str:
    return CARD_TO_LLN[type(card)]

  def deck_to_lln(self, shuffled_deck: Deck) -> str:
    return "".join(self.card_to_lln(card) for card in reversed(shuffled_deck.cards))
    
  def player_to_lln(self, player: Player) -> int:
    return 1 #placeholder