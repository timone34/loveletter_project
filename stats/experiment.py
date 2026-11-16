import time

from stats import *
from strategy import Card_Counter, No_Princess, Random_Strategy, Strategy


def main() -> None:
    players: dict[str, Strategy] = {
        "Alice": Card_Counter(),
        "Bob": Random_Strategy(),
        "Charlie": Random_Strategy(),
        "Diane": Random_Strategy(),
    }

    n = 1000
    start = time.perf_counter()
    ghs = simulate(n, players, rotate_seats=True)
    sim_end = time.perf_counter()
    ds = Dataset.from_histories(ghs)
    construct_ds = time.perf_counter()

    print(f"Simulating {n} games took: {((sim_end - start) * 1000):.1f} ms.")
    print(f"Constructing dataset took: {((construct_ds - sim_end) * 1000):.1f} ms.")
    print(f"Total elapsed time: {((construct_ds - start) * 1000):.1f} ms.")

    w = wins(ds)
    print(w)


if __name__ == "__main__":
    main()
