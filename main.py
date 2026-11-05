import time

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

start = time.perf_counter()

main()

end = time.perf_counter()

print(f"Executed in {(end - start) * 1000:.1f} ms.")