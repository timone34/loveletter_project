import time

from game import Game
from strategy import Strategy, Random_Strategy, Player_Strategy

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


if __name__ == "__main__":
  start = time.perf_counter()
  
  main()
  
  end = time.perf_counter()
  
  print(f"\nExecuted in {(end - start) * 1000:.1f} ms.")

