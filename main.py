import time

from bots import RandomChoice, CardCounter
from game import Game
from observers import ConsoleLogger, LLNWriter
from strategy import TerminalPlayer, Strategy


def main():
    players: dict[str, Strategy] = {
        "Alice": CardCounter(),
        "Bob": RandomChoice(),
        "Charlie": RandomChoice(),
        "Diane": RandomChoice()
    }

    observers = LLNWriter()

    game = Game(players=players, target_round_wins=3, observers=observers)
    game.play()


if __name__ == "__main__":

    start = time.perf_counter()
    main()
    end = time.perf_counter()

    print(f"\nExecuted in {(end - start) * 1000:.1f} ms.")
