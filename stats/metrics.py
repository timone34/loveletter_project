import pandas as pd

from .dataset import Dataset

from cards import Prince, Princess


def wilson(wins, n, z: float = 1.96):
    valid = n > 0
    safe_n = n.where(valid, 1) if isinstance(n, pd.Series) else max(n, 1)
    p = wins / safe_n
    denom = 1 + z**2 / safe_n
    centre = (p + z**2 / (2 * safe_n)) / denom
    half = z * ((p * (1 - p) / safe_n + z**2 / (4 * safe_n**2)) ** 0.5) / denom
    low, high = centre - half, centre + half
    if isinstance(valid, pd.Series):
        return low.where(valid), high.where(valid)
    return (low, high) if valid else (float("nan"), float("nan"))


def _rate(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    return numerator / denominator.where(denominator != 0)


# Outcome statistics


def wins(ds: Dataset) -> pd.DataFrame:
    if "player" not in ds.games.columns or "player" not in ds.rounds.columns:
        return pd.DataFrame(columns=["games", "g_played", "rounds", "r_played"])
    games_won = ds.games.groupby("player")["won"]
    rounds_won = ds.rounds.groupby("player")["won"]
    out = pd.DataFrame({"games": games_won.sum(), "g_played": games_won.count()})
    out["rounds"] = rounds_won.sum()
    out["r_played"] = rounds_won.count()
    return out


def winrate(ds: Dataset) -> pd.DataFrame:
    if not {"player", "won"}.issubset(ds.games.columns):
        return pd.DataFrame(columns=["wins", "games", "winrate", "ci_low", "ci_high"])
    won = ds.games.groupby("player")["won"]
    out = pd.DataFrame({"wins": won.sum(), "games": won.count()})
    out["winrate"] = _rate(out["wins"], out["games"])
    out["ci_low"], out["ci_high"] = wilson(out["wins"], out["games"])
    return out


def round_winrate(ds: Dataset) -> pd.DataFrame:
    if not {"player", "won"}.issubset(ds.rounds.columns):
        return pd.DataFrame(columns=["round_wins", "rounds", "winrate"])
    won = ds.rounds.groupby("player")["won"]
    out = pd.DataFrame({"round_wins": won.sum(), "rounds": won.count()})
    out["winrate"] = _rate(out["round_wins"], out["rounds"])
    return out


def rejection_stats(ds: Dataset, by: str = "cause") -> pd.DataFrame:
    """Count and share rejections by cause, cycle, attacker, victim, or self-infliction."""
    allowed = {"cause", "cycle", "attacker", "victim", "self_inflicted"}
    if by not in allowed:
        raise ValueError(f"'by' must be one of {', '.join(sorted(allowed))}.")
    if by not in ds.rejections.columns:
        return pd.DataFrame(columns=[by, "count", "share"])

    out = ds.rejections.groupby(by, dropna=False).size().rename("count").reset_index()
    total = out["count"].sum()
    out["share"] = out["count"] / total if total else 0.0
    return out.sort_values("count", ascending=False, ignore_index=True)


def showdown_results(ds: Dataset) -> pd.DataFrame:
    """Summarize each player's showdown wins, ties, losses, and outcome rates."""
    columns = [
        "player",
        "showdowns",
        "wins",
        "ties",
        "losses",
        "win_rate",
        "tie_rate",
        "loss_rate",
    ]
    if not {"player", "showdown_outcome"}.issubset(ds.rounds.columns):
        return pd.DataFrame(columns=columns)

    showdowns = ds.rounds.loc[
        ds.rounds["showdown_outcome"].isin(["WIN", "TIE", "LOSS"])
    ]
    if showdowns.empty:
        return pd.DataFrame(columns=columns)

    outcomes = (
        showdowns.groupby(["player", "showdown_outcome"])
        .size()
        .unstack(fill_value=0)
        .reindex(columns=["WIN", "TIE", "LOSS"], fill_value=0)
    )
    out = outcomes.rename(columns={"WIN": "wins", "TIE": "ties", "LOSS": "losses"})
    out.columns.name = None
    out["showdowns"] = out[["wins", "ties", "losses"]].sum(axis=1)
    for metric, rate in (
        ("wins", "win_rate"),
        ("ties", "tie_rate"),
        ("losses", "loss_rate"),
    ):
        out[rate] = _rate(out[metric], out["showdowns"])
    return out.reset_index()[columns]


def seat_winrates(ds: Dataset) -> pd.DataFrame:
    """Return round wins and win rates for each player at each seat."""
    columns = ["player", "seat", "round_wins", "rounds", "winrate"]
    if not {"player", "seat", "won"}.issubset(ds.rounds.columns):
        return pd.DataFrame(columns=columns)
    grouped = ds.rounds.groupby(["player", "seat"])["won"]
    out = pd.DataFrame({"round_wins": grouped.sum(), "rounds": grouped.count()})
    out["winrate"] = _rate(out["round_wins"], out["rounds"])
    return out.reset_index()[columns]


def dealer_winrates(ds: Dataset) -> pd.DataFrame:
    """Return each player's round win rate in rounds where they were dealer."""
    columns = ["player", "dealer_round_wins", "dealer_rounds", "winrate"]
    if not {"player", "dealer", "won"}.issubset(ds.rounds.columns):
        return pd.DataFrame(columns=columns)
    dealer_rounds = ds.rounds.loc[ds.rounds["dealer"]]
    if dealer_rounds.empty:
        return pd.DataFrame(columns=columns)
    grouped = dealer_rounds.groupby("player")["won"]
    out = pd.DataFrame(
        {"dealer_round_wins": grouped.sum(), "dealer_rounds": grouped.count()}
    )
    out["winrate"] = _rate(out["dealer_round_wins"], out["dealer_rounds"])
    return out.reset_index()[columns]


# Play statistics


def guard_accuracy(ds: Dataset) -> pd.DataFrame:
    """Summarize Guard guess accuracy by player; protected targets are not attempts."""
    columns = ["player", "attempts", "correct", "incorrect", "accuracy"]
    if not {"player", "played", "outcome"}.issubset(ds.turns.columns):
        return pd.DataFrame(columns=columns)

    guards = ds.turns.loc[
        (ds.turns["played"] == "Guard")
        & ds.turns["outcome"].isin(["CORRECT", "INCORRECT"])
    ]
    if guards.empty:
        return pd.DataFrame(columns=columns)

    grouped = guards.groupby("player")
    out = pd.DataFrame({"attempts": grouped.size()})
    out["correct"] = (
        guards.assign(correct=guards["outcome"] == "CORRECT")
        .groupby("player")["correct"]
        .sum()
    )
    out["incorrect"] = out["attempts"] - out["correct"]
    out["accuracy"] = _rate(out["correct"], out["attempts"])
    return out.reset_index()[columns]


def baron_results(ds: Dataset) -> pd.DataFrame:
    """Summarize each player's Baron wins, ties, losses, and outcome rates."""
    columns = ["player", "attempts", "wins", "ties", "losses", "win_rate", "tie_rate", "loss_rate"]
    if not {"player", "played", "outcome"}.issubset(ds.turns.columns):
        return pd.DataFrame(columns=columns)

    barons = ds.turns.loc[
        (ds.turns["played"] == "Baron")
        & ds.turns["outcome"].isin(["WIN", "DRAW", "LOSE"])
    ]
    if barons.empty:
        return pd.DataFrame(columns=columns)

    outcomes = (
        barons.groupby(["player", "outcome"])
        .size()
        .unstack(fill_value=0)
        .reindex(columns=["WIN", "DRAW", "LOSE"], fill_value=0)
    )
    out = outcomes.rename(columns={"WIN": "wins", "DRAW": "ties", "LOSE": "losses"})
    out.columns.name = None
    out["attempts"] = out[["wins", "ties", "losses"]].sum(axis=1)
    for metric, rate in (("wins", "win_rate"), ("ties", "tie_rate"), ("losses", "loss_rate")):
        out[rate] = _rate(out[metric], out["attempts"])
    return out.reset_index()[columns]


def card_usage(ds: Dataset, card_field: str = "played") -> pd.DataFrame:
    """Count card plays or draws and their share of all recorded actions."""
    if card_field not in {"played", "drawn"}:
        raise ValueError("'card_field' must be 'played' or 'drawn'.")
    if card_field not in ds.turns.columns:
        return pd.DataFrame(columns=["card", "count", "share"])

    counts = ds.turns[card_field].dropna().value_counts().rename_axis("card")
    out = counts.rename("count").reset_index()
    total = out["count"].sum()
    out["share"] = out["count"] / total if total else 0.0
    return out


def prince_suicides(histories):
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


# Context statistics


def winrate_history(ds: Dataset, interval: int = 2000) -> pd.DataFrame:
    """Return cumulative game win rates at regular game-count checkpoints."""
    columns = ["game_count", "player", "wins", "winrate"]
    if interval < 1:
        raise ValueError("'interval' must be a positive integer.")
    if not {"game", "player", "won"}.issubset(ds.games.columns) or ds.games.empty:
        return pd.DataFrame(columns=columns)

    by_game = ds.games.pivot_table(
        index="game", columns="player", values="won", aggfunc="max"
    ).sort_index()
    by_game = by_game.fillna(False).astype(int)
    counts = list(range(interval, len(by_game), interval)) + [len(by_game)]
    counts = sorted(set(counts))
    cumulative = by_game.cumsum()

    rows = []
    for game_count in counts:
        wins_at_checkpoint = cumulative.iloc[game_count - 1]
        for player, player_wins in wins_at_checkpoint.items():
            rows.append(
                {
                    "game_count": game_count,
                    "player": player,
                    "wins": int(player_wins),
                    "winrate": player_wins / game_count,
                }
            )
    return pd.DataFrame(rows, columns=columns)


def game_summary(ds: Dataset) -> dict[str, int]:
    """Return overall simulation totals suitable for Statistics-page summary cards."""
    games = ds.games["game"].nunique() if "game" in ds.games.columns else 0
    rounds = (
        ds.rounds[["game", "round"]].drop_duplicates().shape[0]
        if {"game", "round"}.issubset(ds.rounds.columns)
        else 0
    )
    guards = (
        ds.turns.loc[ds.turns["played"] == "Guard", "outcome"]
        if {"played", "outcome"}.issubset(ds.turns.columns)
        else pd.Series(dtype=object)
    )
    return {
        "games": games,
        "rounds": rounds,
        "turns": len(ds.turns),
        "rejections": len(ds.rejections),
        "guard_attempts": int(guards.isin(["CORRECT", "INCORRECT"]).sum()),
        "guard_correct": int((guards == "CORRECT").sum()),
    }
