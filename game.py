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
    self.first_player_index = self.dealer_index + 1 % self.num_players

    self.target_round_wins: int = 3 # Number of round wins to win the game

  
  
  def start_game(self) -> None:
    self.play_round()

  
  def play_round(self) -> None:
    self.log_round_start()
    self.reset_round()
    self.deal_opening_hands()

    first_player = self.players[self.first_player_index]
    self.play_turn(first_player) 
  


  def play_turn(self, player: Player) -> None:
    if player.rejected:
      print(f"{player.name} is rejected. Skipping turn.")

    # drawing a card
    if self.deck.cards_left() > 0:
      drawn_card = self.deck.draw_card()
      player.hand.append(drawn_card)
      print(f"{player.name} draws a card: {drawn_card.name}")
    else:
      print("The deck is empty. On to showdown!")
      self.trigger_showdown()
  
  
  def play_card(self, player, card) -> None:
    pass



  def trigger_showdown(self) -> None:
    print("\nShowdown! Players still in the game reveal their cards:")

    for player in self.players:
      if not player.rejected:
        print(f"{player.name} has a {player.hand[0].name} ({player.hand[0].value}).")



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

  
  def eliminate_player(self, player) -> None:
    player.rejected = True
    print(f"{player.name} is rejected, and therefore out of the round!")
  

  
  def get_valid_targets(self, player: Player, allow_self: bool = False) -> list[Player]:
    valid_targets: list[Player] = []

    for p in self.players:
      if p.rejected: continue                       # if player is dead, skip
      if p is player and not allow_self: continue   # if you aren't allowed to target yourself, skip
      if p.protected: continue                      # if handmaid protects target, skip
      valid_targets.append(p)

    if not valid_targets:
      print(f"No valid targets for {player.name}.")
    
    return valid_targets

