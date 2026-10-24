from deck import Deck
from player import Player
from strategy import Strategy
from cards import *



class Game:
  def __init__(self, players: dict[str, Strategy]):
    self.players = [Player(name, strategy) for name, strategy in players.items()]
    self.num_players = len(self.players)

    self.deck = Deck()
    self.discarded_cards: list[Card] = []

    self.round: int = 1

    self.dealer_index = 0
    self.current_player_index = self.dealer_index

    self.target_round_wins: int = 3 # Number of round wins to win the game

  
  
  def start_game(self) -> None:
    while True:
      self.play_round()

  
  def play_round(self) -> None:
    self.setup_round()

    while not self.is_round_over():
        self.play_turn()

    winner = self.determine_round_winner()
    self.end_round(winner)
  
  
  def setup_round(self) -> None:
    self.log_round_start()
    self.reset_round()
    self.deal_opening_hands()

  def log_round_start(self) -> None:
    print(f"\nStarting round with players: ")
    for player in self.players:
      print(f"{player.name}, ({player.strategy.name})")
    
  def reset_round(self):
    for player in self.players:
      player.reset_player()
    
    self.deck = Deck()
    self.deck.shuffle()
  
  def deal_opening_hands(self):
    discard_card = self.deck.cards.pop()
    self.discarded_cards.append(discard_card)
    print(f"Discarded card: {discard_card.name}")

    for player in self.players:
      player_card = self.deck.cards.pop()
      player.hand.append(player_card)
      print(f"{player.name}'s card: {player_card.name}")
  

  def play_turn(self) -> None:
    player = self.current_player
    self.begin_turn(player)
    card = self.choose_card(player)
    self.play_card(player, card)
    self.end_turn()
  
  
  def play_card(self, player, card) -> None:
    pass

  
  def eliminate_player(self, player) -> None:
    player.eliminated = True
    print(f"{player.name} is eliminated!")
  
  
  def get_valid_targets(self, player: Player, allow_self: bool = False) -> list[Player]:
    valid_targets: list[Player] = []

    for p in self.players:
      if p.eliminated: continue                     # if player is dead, skip
      if p is player and not allow_self: continue   # if you aren't allowed to target yourself, skip
      if p.protected: continue                      # if handmaid protects target, skip
      valid_targets.append(p)
    
    return valid_targets

