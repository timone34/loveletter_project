from game import *
from strategy import *

def main():
  players: dict[str, Strategy] = {
    "Alice": Random_Strategy(name="Alice"),
    "Bob": Random_Strategy(name="Bob"),
    "Player": Player_Strategy(name="Player")
  }

  game = Game(players)
  game.start_game()

main()