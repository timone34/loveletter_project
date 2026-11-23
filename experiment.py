import time

from stats import *
from engine.strategy import Strategy
from bots import RandomChoice, NoPrincess, CardCounter
from lln import save_lln


def main() -> None:
    players: dict[str, Strategy] = {
        "Alice": CardCounter(),
        "Bob": RandomChoice(),
        "Charlie": RandomChoice(),
        "Diane": RandomChoice(),
    }

    n = 1000
    start = time.perf_counter()
    print("starting")
    ghs = simulate(n, players, rotate_seats=True)
    sim_end = time.perf_counter()
    ds = Dataset.from_histories(ghs)
    construct_ds = time.perf_counter()

    print(f"Simulating {n} games took: {((sim_end - start) * 1000):.1f} ms.")
    print(f"Constructing dataset took: {((construct_ds - sim_end) * 1000):.1f} ms.")
    print(f"Total elapsed time: {((construct_ds - start) * 1000):.1f} ms.")

    wr = winrate(ds)
    print(wr)

    ga = guard_accuracy(ds)
    print(ga)

    save_lln(ghs)


if __name__ == "__main__":
    main()
