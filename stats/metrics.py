import pandas as pd

from engine.cards import Prince, Princess
from engine.history import GameHistory

from .dataset import Dataset


def wilson(wins, n, z: float = 1.96):
    p = wins / n
    denom = 1 + z**2 / n
    centre = (p + z**2 / (2 * n)) / denom
    half = z * ((p * (1 - p) / n + z**2 / (4 * n**2)) ** 0.5) / denom
    return centre - half, centre + half


def wins(ds: Dataset) -> pd.DataFrame:
    games_won = ds.games.groupby("player")["won"]
    rounds_won = ds.rounds.groupby("player")["won"]
    out = pd.DataFrame({"games": games_won.sum(), "g_played": games_won.count()})
    out["rounds"] = rounds_won.sum()
    out["r_played"] = rounds_won.count()
    return out


def winrate(ds: Dataset) -> pd.DataFrame:
    won = ds.games.groupby("player")["won"]
    out = pd.DataFrame({"wins": won.sum(), "games": won.count()})
    out["winrate"] = out["wins"] / out["games"]
    out["ci_low"], out["ci_high"] = wilson(out["wins"], out["games"])
    return out


def prince_suicides(histories: list[GameHistory]):
    counts = {}
    for g in histories:
        for r in g.rounds:
            for t in r.turns:
                if (
                    isinstance(t.played, Prince)
                    and t.target == t.seat
                    and isinstance(t.discarded, Princess)
                ):
                    name = g.players[t.seat]
                    counts[name] = counts.get(name, 0) + 1
    return counts

def guard_accuracy(ds: Dataset):
    guards_played = ds.turns[ds.turns["played"] == "Guard"]

    result = (
        guards_played.assign(correct=guards_played["outcome"] == "CORRECT")
        .groupby("player")
        .agg(
            guards_played=("played", "count"),
            correct_guesses=("correct", "sum"),
        )
    )

    result["accuracy"] = result["correct_guesses"] / result["guards_played"]

    return result.sort_values("accuracy", ascending=False)