"""stats.timing: the stopwatch around the bots, and the performance numbers in
Tally. Times differ every run, so these check what must hold whatever the
clock says: timing never changes a game, counts match the games, parts add
up to wholes, and a slow bot shows up as slow."""
import time

import pytest

from bots import CardCounter, NoPrincess, RandomChoice
from stats import Tally, iter_games
from stats.timing import BUCKETS_PER_DECADE, Timings, TimingsBy, TimingObserver, timed_lineup


def lineup():
    return {"Ann": CardCounter(), "Ben": RandomChoice(), "Cat": NoPrincess(), "Dan": RandomChoice()}


def timed_run(players, n, seed=3):
    timed = timed_lineup(players)
    clock = TimingObserver(timed)
    tally = Tally(expected_games=n)
    histories = []
    for gh in iter_games(n, timed, seed=seed, obs=clock):
        tally.add(gh, clock.last)
        histories.append(gh)
    return histories, tally.to_json()


def without_timing(stats: dict) -> dict:
    stats = {k: v for k, v in stats.items() if k != "performance"}
    for group in ("players", "bots", "seats"):
        stats[group] = [{k: v for k, v in line.items() if k != "think"} for line in stats[group]]
    return stats


@pytest.fixture(scope="module")
def run():
    return timed_run(lineup(), 300)


def test_timing_never_changes_a_game(run):
    _, timed = run
    plain = Tally(expected_games=300)
    for gh in iter_games(300, lineup(), seed=3):
        plain.add(gh)
    untimed = plain.to_json()
    assert untimed["performance"] is None
    assert all(line["think"] is None for line in untimed["players"])
    assert without_timing(timed) == without_timing(untimed)


def test_counts_match_the_games(run):
    histories, stats = run
    for seat_line in stats["seats"]:
        seat = seat_line["seat"]
        turns = [t for gh in histories for rh in gh.rounds for t in rh.turns if t.seat == seat and t.drawn is not None]
        think = seat_line["think"]
        assert think["turn"]["n"] == len(turns)  # skipped turns don't count
        assert think["decision"]["card"]["n"] == len(turns)
        assert think["decision"]["target"]["n"] == sum(t.target is not None for t in turns)
        assert think["decision"]["guess"]["n"] == sum(t.guess is not None for t in turns)
        assert sum(c["n"] for c in think["byCycle"]) == len(turns)
        assert sum(r["n"] for r in think["byRound"]) == len(turns)
        assert sum(c["n"] for c in think["byCard"].values()) == len(turns)
    perf = stats["performance"]
    assert perf["games"] == 300 and perf["gameTime"]["n"] == 300
    assert sum(k for _, _, k in perf["gameHistogram"]) == 300


def test_parts_add_up(run):
    _, stats = run
    perf = stats["performance"]
    rounds = stats["rounds"]
    assert perf["perRound"] * rounds == pytest.approx(perf["total"], rel=1e-3)
    assert 0 < perf["think"] < perf["total"]  # the bots are part of the game's time
    for group in ("players", "bots", "seats"):
        lines = [line["think"] for line in stats[group]]
        assert sum(t["turn"]["total"] for t in lines) == pytest.approx(perf["think"], rel=1e-3)
        for t in lines:
            turn = t["turn"]
            # the per-cycle means, weighted by their turns, give back the overall mean
            assert sum(c["mean"] * c["n"] for c in t["byCycle"]) / turn["n"] == pytest.approx(turn["mean"], rel=1e-3)
            assert turn["lo"] <= turn["mean"] <= turn["hi"] and turn["median"] <= turn["max"]
    # the over-time windows, weighted by their games, give back the mean game time
    points = perf["overTime"]
    assert points[-1]["games"] == stats["games"]
    sizes = [b["games"] - a["games"] for a, b in zip([{"games": 0}] + points, points)]
    assert sum(p["gameTime"] * k for p, k in zip(points, sizes)) / 300 == pytest.approx(perf["gameTime"]["mean"], rel=1e-3)


class Sleepy(RandomChoice):
    def __init__(self) -> None:
        super().__init__()
        self.id = "Sleepy"

    def choose_card(self, player, playable):
        time.sleep(0.002)
        return super().choose_card(player, playable)


def test_a_slow_bot_shows_up():
    _, stats = timed_run({"Ann": Sleepy(), "Ben": RandomChoice(), "Cat": RandomChoice(), "Dan": RandomChoice()}, 5)
    slow, *others = stats["players"]
    assert slow["think"]["decision"]["card"]["median"] >= 0.0018
    assert all(o["think"]["turn"]["median"] < 0.001 for o in others)
    assert stats["performance"]["think"] / stats["performance"]["total"] > 0.5


def test_bots_keep_their_names_when_wrapped():
    timed = timed_lineup(lineup())
    assert [b.id for b in timed.values()] == ["CardCounter", "RandomChoice", "NoPrincess", "RandomChoice"]
    assert timed["Ann"].name == "Card Counter Bot"
    assert timed["Ann"].debug is False  # anything else comes from the bot


def test_timings_summary_and_merge():
    durations = [1000 * (i % 97 + 1) for i in range(5000)]  # 1-97 µs
    whole, a, b = Timings(), Timings(), Timings()
    for i, ns in enumerate(durations):
        whole.add(ns)
        (a if i % 2 else b).add(ns)
    a_before = a.copy()
    merged = a.copy()
    merged += b
    assert merged == whole and a == a_before  # += leaves the other one alone

    s = whole.to_json()
    assert s is not None and s["n"] == 5000
    assert s["mean"] == pytest.approx(sum(durations) / 5000 * 1e-9, rel=1e-3)
    assert s["max"] == pytest.approx(97e-6)
    true_median = sorted(durations)[2500] * 1e-9
    half_bucket = 10 ** (0.5 / BUCKETS_PER_DECADE)  # ~12%
    assert true_median / half_bucket <= s["median"] <= true_median * half_bucket
    assert Timings().to_json() is None


def test_timings_by_never_shares():
    one, two = TimingsBy(), TimingsBy()
    two.add(1, 500)
    one += two
    one.add(1, 700)
    assert two[1].n == 1 and one[1].n == 2
