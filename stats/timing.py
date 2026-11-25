"""How long bots take to decide, measured without touching the engine.

    timed = timed_lineup({"Ann": CardCounter(), "Ben": RandomChoice(), ...})
    clock = TimingObserver(timed)
    for gh in iter_games(1000, timed, obs=clock):
        tally.add(gh, clock.last)  # clock.last: this game's GameTiming

TimedStrategy wraps a bot and stopwatches the three calls the engine makes to
it on a turn: choose_card, then (from inside the card's effect) choose_target
and guard_guess. Everything else is passed straight through, so the bot plays
exactly as it would unwrapped: same decisions, same random numbers, same games
for the same seed. Only the clock readings differ between runs.

TimingObserver collects those readings per turn (with the turn's cycle, round
number and card played) and times each whole game, from on_game_start to
on_game_end. "Think time" is the time spent inside the bot's own methods;
the rest of a game's time is the engine (dealing, resolving, history,
observers) plus the stopwatch itself, a few hundred nanoseconds a turn.

Durations are kept as Timings: counts in log-spaced buckets, so a run of any
length takes the same memory while medians and p95s can still be read off
(to within about 12%, the half-width of a bucket). Means and maxima are exact.

Clock readings are wall time (time.perf_counter_ns): they depend on the
machine and on whatever else it's doing, and differ a little every run, even
with the same seed. Compare bots within one run, or runs on the same machine.
"""
from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass, field
from time import perf_counter_ns
from typing import TYPE_CHECKING, Any

from engine.observer import Observer
from engine.strategy import Strategy

if TYPE_CHECKING:
    from engine.cards import Card
    from engine.history import GameHistory, RoundHistory, TurnHistory
    from engine.player import Player

BUCKETS_PER_DECADE = 10  # bucket b holds durations in [10^(b/10), 10^((b+1)/10)) ns


@dataclass
class Timings:
    """A set of durations (in ns), summarised without keeping them all."""

    n: int = 0
    total: int = 0  # ns
    total_sq: float = 0.0  # sum of squares, ns², for the interval around the mean
    max: int = 0
    buckets: Counter[int] = field(default_factory=Counter)

    def add(self, ns: int) -> None:
        self.n += 1
        self.total += ns
        self.total_sq += float(ns) * ns
        self.max = max(self.max, ns)
        self.buckets[bucket_of(ns)] += 1

    def __iadd__(self, other: Timings) -> Timings:
        """Merge other into this one, in place (other is left as it was)."""
        self.n += other.n
        self.total += other.total
        self.total_sq += other.total_sq
        self.max = max(self.max, other.max)
        for b, k in other.buckets.items():
            self.buckets[b] += k
        return self

    def copy(self) -> Timings:
        return Timings(self.n, self.total, self.total_sq, self.max, self.buckets.copy())

    @property
    def mean(self) -> float | None:
        return self.total / self.n if self.n else None

    def quantile(self, q: float) -> float | None:
        """The duration below which a share q of them fall, in ns: the middle of
        the bucket it lands in (never above the largest one seen)."""
        if not self.n:
            return None
        rank = q * self.n
        seen = 0
        for b in sorted(self.buckets):
            seen += self.buckets[b]
            if seen >= rank:
                return min(10 ** ((b + 0.5) / BUCKETS_PER_DECADE), float(self.max))
        return float(self.max)

    def to_json(self) -> dict[str, Any] | None:
        """Seconds. mean with a 95% interval (normal approximation; fine for the
        hundreds of turns behind every number shown), median, p95 and max."""
        if not self.n:
            return None
        mean = self.total / self.n
        var = max(0.0, self.total_sq / self.n - mean**2) * self.n / max(1, self.n - 1)
        half = 1.96 * math.sqrt(var / self.n)
        return {
            "n": self.n,
            "total": sec(self.total),
            "mean": sec(mean),
            "lo": sec(max(0.0, mean - half)),
            "hi": sec(mean + half),
            "median": sec(self.quantile(0.5) or 0),
            "p95": sec(self.quantile(0.95) or 0),
            "max": sec(self.max),
        }

    def histogram(self) -> list[list[float]]:
        """[[from, to, count], ...] in seconds, one entry per bucket from the
        lowest to the highest one used (empty buckets in between included)."""
        if not self.buckets:
            return []
        lo, hi = min(self.buckets), max(self.buckets)
        return [
            [sec(10 ** (b / BUCKETS_PER_DECADE)), sec(10 ** ((b + 1) / BUCKETS_PER_DECADE)), self.buckets[b]]
            for b in range(lo, hi + 1)
        ]


def sec(ns: float) -> float:
    """ns -> seconds, to 4 significant digits (the clock isn't better than that)."""
    return float(f"{ns * 1e-9:.4g}")


def bucket_of(ns: int) -> int:
    return math.floor(math.log10(ns) * BUCKETS_PER_DECADE) if ns >= 1 else 0


class TimingsBy(dict[Any, Timings]):
    """Timings per key (a cycle, a round number, a card name), mergeable with +=."""

    def add(self, key: Any, ns: int) -> None:
        if key not in self:
            self[key] = Timings()
        self[key].add(ns)

    def __iadd__(self, other: TimingsBy) -> TimingsBy:  # type: ignore[override,misc]
        for k, v in other.items():
            if k in self:
                self[k] += v
            else:
                self[k] = v.copy()  # never share: this one gets added to later
        return self


class TimedStrategy(Strategy):
    """A bot with a stopwatch around each decision. Plays exactly like the bot."""

    def __init__(self, bot: Strategy) -> None:
        # no super().__init__(): the wrapper takes the bot's id and names
        self.bot = bot
        self.id = bot.id
        self.name = bot.name
        self.description = bot.description
        self.reset()

    def reset(self) -> None:
        """Start a new turn's readings."""
        self.card_ns = 0
        self.target_ns: int | None = None  # None: not asked this turn
        self.guess_ns: int | None = None

    def __getattr__(self, attr: str) -> Any:
        # anything else (a bot's own settings, `human`, ...) is the bot's
        return getattr(self.__dict__["bot"], attr)

    def choose_card(self, player: Player, playable: list[Card]) -> Card:
        start = perf_counter_ns()
        card = self.bot.choose_card(player, playable)
        self.card_ns += perf_counter_ns() - start
        return card

    def choose_target(self, player: Player, card: Card, targets: list[Player]) -> Player:
        start = perf_counter_ns()
        target = self.bot.choose_target(player, card, targets)
        self.target_ns = (self.target_ns or 0) + perf_counter_ns() - start
        return target

    def guard_guess(self, player: Player, target: Player) -> Card:
        start = perf_counter_ns()
        guess = self.bot.guard_guess(player, target)
        self.guess_ns = (self.guess_ns or 0) + perf_counter_ns() - start
        return guess


def timed_lineup(players: dict[str, Strategy]) -> dict[str, TimedStrategy]:
    """The same lineup with every bot wrapped in a stopwatch."""
    return {name: TimedStrategy(bot) for name, bot in players.items()}


@dataclass
class TurnTiming:
    seat: int
    cycle: int
    round: int  # round number in the game, from 1
    card: str  # the card played
    card_ns: int  # choose_card
    target_ns: int | None  # choose_target, None when the card has no target
    guess_ns: int | None  # guard_guess, None unless a Guard was played

    @property
    def total_ns(self) -> int:
        return self.card_ns + (self.target_ns or 0) + (self.guess_ns or 0)


@dataclass
class GameTiming:
    ns: int = 0  # the whole game, start to end
    turns: list[TurnTiming] = field(default_factory=list)  # turns played (not skipped)


class TimingObserver(Observer):
    """Reads the stopwatches after every turn; `last` is the latest finished game."""

    def __init__(self, timed: dict[str, TimedStrategy]) -> None:
        self.timed = timed
        self.last: GameTiming | None = None
        self._game = GameTiming()
        self._by_seat: list[TimedStrategy] = []
        self._start = 0

    def on_game_start(self, game: GameHistory) -> None:
        self._game = GameTiming()
        self._by_seat = [self.timed[name] for name in game.players]
        self._start = perf_counter_ns()

    def on_turn_start(self, game: GameHistory, rnd: RoundHistory, turn: TurnHistory) -> None:
        self._by_seat[turn.seat].reset()

    def on_turn_end(self, game: GameHistory, rnd: RoundHistory, turn: TurnHistory) -> None:
        bot = self._by_seat[turn.seat]
        assert turn.played is not None
        self._game.turns.append(TurnTiming(
            seat=turn.seat, cycle=turn.cycle, round=rnd.number, card=turn.played.name,
            card_ns=bot.card_ns, target_ns=bot.target_ns, guess_ns=bot.guess_ns,
        ))

    def on_game_end(self, game: GameHistory) -> None:
        self._game.ns = perf_counter_ns() - self._start
        self.last = self._game
