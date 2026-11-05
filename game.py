from deck import Deck
from player import Player
from strategy import Strategy
from cards import *



class Game:
  def __init__(self, players: dict[str, Strategy]):
    # Game variables
    self.players = [Player(name, strategy) for name, strategy in players.items()]
    self.num_players = len(self.players)

    self.deck = Deck()
    self.burn_card: Card

    self.round: int = 1

    self.dealer_index = 0
    self.first_player_index = (self.dealer_index + 1) % self.num_players
    self.current_player_index = self.first_player_index

    self.target_round_wins: int = 3 # Number of round wins to win the game
    self.winner: Player | None = None

    # Diagnostics
    self.rounds_to_showdown: int = 0
    self.round_ties: int = 0
    self.game_tiebreaks: int = 0 



  # --- Core functions --- #
  def play_game(self) -> None:
    print("Starting Love Letter Game!\n")

    while self.winner is None:
      self.play_round()
      self.round += 1
      self.dealer_index = (self.dealer_index + 1) % self.num_players
      self.first_player_index = (self.dealer_index + 1) % self.num_players

      leaders = [p for p in self.players if p.round_wins >= self.target_round_wins]

      if len(leaders) == 1:
        self.winner = leaders[0]
      elif len(leaders) > 1:
        self.target_round_wins += 1
        self.game_tiebreaks += 1
        names = " and ".join(p.name for p in leaders)
        print(f"{names} have both reached {self.target_round_wins - 1} wins!"
              f"Target raised to  {self.target_round_wins} wins.\n")

    print(f"\n{self.winner.name} has {self.winner.round_wins} round wins and wins the game!\nGG!")
    return

  
  def play_round(self) -> None:
    self.log_round_start()
    self.reset_round()

    starting_player = self.players[self.first_player_index]
    self.deal_opening_hands(starting_player)
    self.current_player_index = self.first_player_index

    while self.are_multiple_players_left():
      player = self.players[self.current_player_index]
      self.play_turn(player)

      # move to next player
      self.current_player_index = (self.current_player_index + 1) % self.num_players

    winners = [p for p in self.players if not p.rejected]
    for w in winners:
      w.round_wins += 1
      print(f"{w.name} wins round {self.round} and has {w.round_wins} round wins. \n")
    
    return

  
  def play_turn(self, player: Player) -> None:
    print(f"\n{self.players[self.current_player_index].name}'s turn.")

    # First, check if player is rejected.
    if player.rejected:
      print(f"{player.name} is rejected. Skipping turn.")
      return

    # If player was protected by Handmaid, remove protection
    player.protected = False

    # Draw a second card
    if self.deck.cards_left() > 0:
      drawn_card = self.deck.draw_card()
      player.hand.append(drawn_card)
      print(f"{player.name} draws a card: {drawn_card.name}")

    # Choose a card to play
    chosen_card = player.strategy.choose_card(player)
    player.hand.remove(chosen_card)
    player.discard.append(chosen_card)
    print(f"{player.name} plays a {chosen_card.name}.")

    # Resolve chosen card's effect
    chosen_card.resolve(self, player)

    if self.are_multiple_players_left() and self.deck.cards_left() == 0:
      self.play_showdown()
    return


  def play_showdown(self) -> None:
        self.rounds_to_showdown += 1
        print("\nShowdown! Players still in the game reveal their cards:")
    
        active_players = [p for p in self.players if not p.rejected]
        for player in active_players:
          print(f"{player.name} has a {player.hand[0].name} ({player.hand[0].value}).")
  
        # 1st tiebreak level: highest card in hand
        best_value = max(p.hand[0].value for p in active_players)
        contenders = [p for p in active_players if p.hand[0].value == best_value]
  
        # 2nd tiebreak level: highest total discard value
        if len(contenders) > 1:
          print(f"\nTie on card value ({best_value}). Comparing discard piles:")
          for p in contenders:
            print(f"{p.name}'s discard total: {p.discard_total()}.")
          
          best_total = max(p.discard_total() for p in contenders)
          contenders = [p for p in contenders if p.discard_total() == best_total]
    
        winners = contenders
        if len(winners) == 1:
          print(f"\n{winners[0].name} wins the round!")
        else:
          print(f"\n{' and '.join(p.name for p in winners)} are still tied and share the round win!")
          self.round_ties += 1
        for player in active_players:
            if player not in winners:
                self.eliminate_player(player)



  # --- Helping functions --- #

  def are_multiple_players_left(self)  -> bool:
      active_players = [p for p in self.players if not p.rejected]
      if not active_players:
        raise RuntimeError("No players left in round. Something went wrong.")
  
      return len(active_players) > 1

  def deal_opening_hands(self, starting_player: Player) -> None:
      burn_card = self.deck.cards.pop()
      self.burn_card = burn_card
      print(f"\nDealing opening hands.")
      print(f"Burn card: {burn_card.name}\n")
  
      # deal cards starting from player after dealer.
      starting_index = self.players.index(starting_player)
  
      for i in range(len(self.players)):
        player = self.players[(starting_index + i) % len(self.players)]
        player_card = self.deck.cards.pop()
        player.hand.append(player_card)
        print(f"{player.name}'s card: {player_card.name}")

  def eliminate_player(self, player: Player) -> None:
      player.rejected = True
      player.discard.extend(player.hand)
      player.hand.clear()
      
      print(f"{player.name} is rejected, and therefore out of the round!")

  def get_valid_targets(self, player: Player, allow_self: bool = False) -> list[Player]:
      valid_targets: list[Player] = []
  
      for p in self.players:
        if p.rejected: continue                       # if player is dead, skip
        if p is player and not allow_self: continue   # if you aren't allowed to target yourself, skip
        valid_targets.append(p)
      
      return valid_targets

  def log_round_start(self) -> None:
    print(f"Starting round {self.round} with {self.num_players} players: ")
    for player in self.players:
      if self.players.index(player) == self.dealer_index:
        print(f"{player.name}, ({player.strategy.name}) - Dealer")
      else:
        print(f"{player.name}, ({player.strategy.name})")
            
  def reset_round(self):
    for player in self.players:
      player.reset_player()
    
    self.deck = Deck()
    self.deck.shuffle()
