from game import *
from strategy import *

def main():
  players: dict[str, Strategy] = {
    "Alice": Random_Strategy(),
    "Bob": Random_Strategy(),
    "Charlie": Random_Strategy(),
    "Diane": Random_Strategy(),
    # "User": Player_Strategy(),
  }

  game = Game(players)
  game.play_game()

main()