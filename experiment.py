import time

from stats import Dataset, simulate,wins,winrate,prince_suicides
from strategy import Strategy
from bots import Random_Strategy, No_Princess, No_Princess_Or_Suicide, Card_Counter


def main() -> None:
    players: dict[str, Strategy] = {
        "Alice": Card_Counter(),
        "Bob": No_Princess_Or_Suicide(),
        "Charlie": No_Princess_Or_Suicide(),
        "Diane": No_Princess_Or_Suicide(),
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
    ps = prince_suicides(ghs)
    print(ps)


if __name__ == "__main__":
    main()
