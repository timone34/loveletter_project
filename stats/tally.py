"""Running totals for a simulation: feed it games one at a time, read the stats.

    tally = Tally(expected_games=1000)
    for gh in iter_games(1000, players, seed=1):
        tally.add(gh)
    tally.to_json()  # what the Stats page shows

Only counts are stored while games come in, so a run of any size takes the
same memory. Every rate is worked out from those counts in to_json(), in one
place, so the definitions below are the only ones.

Definitions (all from GameHistory, nothing a bot couldn't be credited for):

  game win rate   games won / games played, with a 95% Wilson interval.
  round win rate  rounds won / rounds played. A tied showdown counts as a win
                  for every tied player, so round win rates can sum to a bit
                  over 100% (tiedRounds says how often that happened).
  guard accuracy  correct guesses / guesses that were checked. A Guard on a
                  Handmaid-protected player checks nothing, so it's counted
                  separately (protected) and left out of the accuracy.
  baron           the outcomes of the Barons a player played themselves:
                  won (target out), lost (player out), tied, protected.
  losses          how each lost round was lost, from the loser's side: out
                  to a Guard, an opponent's Baron, their own Baron, an
                  opponent's Prince (made to discard the Princess), their own
                  Prince, playing the Princess, or still in at the showdown
                  but beaten there. These add up to rounds - round wins.

Players are grouped by (name, strategy); `bots` sums the players that use the
same strategy. A bot's "games" then counts seats, so 3 RandomChoice players in
1000 games are 3000 games, and its win rate is per seat (fair share 1/4 at a
4-player table, whatever the number of seats). `seats` groups the same counts
by seat number instead (seat 1 deals the first round of every game, seat 2
starts it), whoever sat there.

  start card      round win rate by the card a player was dealt: how much of
                  a round the deal decides (the luck baseline).
  guard odds      every checked Guard guess, held against the cards its player
                  couldn't see at that moment: the deck minus their own two
                  cards and every face-up discard (what CardCounter counts).
                  Assuming the target's card is any of those unseen cards with
                  equal chance: `expected` is the average chance its guesses
                  had, `countingBest` the chance of always naming the likeliest
                  card, `pickedBest` how often it did. Expected is accuracy
                  without the luck. countingBest is the best a pure card
                  counter can do, not a ceiling: it ignores everything but the
                  face-up cards (Priest looks, King swaps, missed Guard
                  guesses), so a bot that uses those can beat it, and the
                  equal-chance assumption is only exact when opponents keep
                  cards at random.
  priest          after a Priest look, the player's next turn: a chance to use
                  it when they then hold a Guard (and the card seen isn't a
                  Guard) or a Baron with a higher card beside it, and the seen
                  player is still in and unprotected. Only looks the player can
                  still trust count: if the seen player has since played a card
                  of the seen kind (maybe the seen card, maybe a duplicate), or
                  been hit by a Prince or a King swap, the look is dropped even
                  when they happen to hold the same kind again.
                  `taken` = they played it on that player (the Guard naming the
                  seen card), which then always knocks them out.
  baron by card   Baron outcomes split by the card kept beside it.
  choices         for every pair of cards held, how often each was played,
                  and how often the round was won after that choice.

  turn order      round win rate by position in the round's turn order: 1st
                  is the player left of that round's dealer, who moves first.
                  The dealer changes every round (the last winner starts), so
                  this is the first-mover advantage itself, unlike seats,
                  which only fix who starts round 1.

Performance (only for runs played with timing on; see stats/timing.py for how
it's measured; every duration is in seconds, wall time on the machine that
ran it, so it varies a little from run to run even with the same seed):

  think time      per player: the time spent inside the bot's own methods on
                  one turn it played (choose_card + choose_target +
                  guard_guess). Skipped turns of a rejected player don't
                  count. Mean (with a 95% interval), median, p95 and max;
                  medians and p95s are read from log buckets, to within ~12%.
  decision        the same split by call: choosing the card (every turn),
                  choosing a target (turns whose card has one) and the Guard
                  guess (Guard turns). Each is averaged over the turns it
                  happened on, so they don't add up to the turn mean.
  by cycle        think time per turn by the turn's cycle (cycle 1 = everyone's
                  first turn of the round). Late cycles are rare: their means
                  come with wide intervals.
  by round        think time per turn by round number in the game.
  by card         think time per turn by the card that was played.
  game time       start to end of each game: engine + bots. `perRound` is the
                  total over all rounds. `think` / total game time is the bots'
                  share; the rest is the engine (and the stopwatch itself).
  measuring       what timing costs while counting: the time add() spends on
                  think times (clocked, so exact; part of counting the stats).
                  What it costs during play can't be clocked without adding
                  more cost; the Stats page estimates it by comparing play
                  time per turn with the latest untimed run of the lineup.
  over time       per stretch of the run (the same snapshots as the
                  convergence chart, but each covering only the games since
                  the last one): ms per game and each line's think time per
                  turn. A bot that slows down as the run goes on (state that
                  keeps growing) shows up here.
"""
from __future__ import annotations

import dataclasses
from collections import Counter
from time import perf_counter_ns
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from engine.cards import Baron, Guard, King, Priest, Prince, Princess, GUESSABLE_TYPES
from engine.deck import Deck
from engine.history import Outcome

from .replay import kept_card, walk
from .timing import Timings, TimingsBy

if TYPE_CHECKING:
    from engine.cards import Card
    from engine.history import GameHistory, RoundHistory, TurnHistory

    from .timing import GameTiming

# how a round was lost, in the order the Stats page shows them
CAUSES = ("guard", "baron", "ownBaron", "prince", "ownPrince", "princess", "showdown")

# card names, lowest value first, and how many of each are in the deck
CARDS = tuple(dict.fromkeys(c.name for c in sorted(Deck().cards, key=lambda c: c.value)))
DECK_COUNTS = Counter(c.name for c in Deck().cards)
GUESSABLE = tuple(t.name for t in GUESSABLE_TYPES)
BARON_OUTCOMES = {Outcome.WIN: "won", Outcome.DRAW: "tied", Outcome.LOSE: "lost", Outcome.PROTECTED: "protected"}

CONVERGENCE_POINTS = 100  # win-rate snapshots kept over a run, for the convergence chart


def wilson(successes: int, n: int, z: float = 1.96) -> dict[str, float] | None:
    """The rate and its 95% Wilson score interval, or None when n is 0."""
    if n == 0:
        return None
    p = successes / n
    denom = 1 + z**2 / n
    centre = (p + z**2 / (2 * n)) / denom
    half = z * ((p * (1 - p) / n + z**2 / (4 * n**2)) ** 0.5) / denom
    return {"p": p, "lo": max(0.0, centre - half), "hi": min(1.0, centre + half)}


@dataclass
class Counts:
    """Everything counted for one player (or summed for one bot)."""

    games: int = 0
    game_wins: int = 0
    rounds: int = 0
    round_wins: int = 0

    guards: int = 0  # Guards played
    guard_correct: int = 0
    guard_incorrect: int = 0
    guard_protected: int = 0

    barons: int = 0  # Barons played
    baron_won: int = 0
    baron_lost: int = 0
    baron_tied: int = 0
    baron_protected: int = 0

    losses: Counter[str] = field(default_factory=Counter)  # cause -> rounds lost

    start_rounds: Counter[str] = field(default_factory=Counter)  # start card -> rounds
    start_wins: Counter[str] = field(default_factory=Counter)  # start card -> rounds won

    guard_picked_best: int = 0  # checked guesses that named a likeliest card
    guard_expected: float = 0.0  # sum over checked guesses of the chance the guess had
    guard_counting_best: float = 0.0  # sum of the chance of the likeliest card

    priest_looks: int = 0  # Priests that saw a card
    priest_chances: int = 0
    priest_taken: int = 0

    baron_by_card: Counter[str] = field(default_factory=Counter)  # "Guard|won" -> Barons

    choices: Counter[str] = field(default_factory=Counter)  # "Baron|Handmaid|Baron" -> times
    choice_wins: Counter[str] = field(default_factory=Counter)  # same keys -> rounds won after

    # think time per turn played, only filled for timed runs (stats/timing.py)
    think: Timings = field(default_factory=Timings)
    think_card: Timings = field(default_factory=Timings)  # choose_card
    think_target: Timings = field(default_factory=Timings)  # choose_target, when asked
    think_guess: Timings = field(default_factory=Timings)  # guard_guess, when asked
    think_by_cycle: TimingsBy = field(default_factory=TimingsBy)  # cycle -> per turn
    think_by_round: TimingsBy = field(default_factory=TimingsBy)  # round number -> per turn
    think_by_card: TimingsBy = field(default_factory=TimingsBy)  # card played -> per turn

    def __iadd__(self, other: Counts) -> Counts:
        self.merge(other, think=False)
        self.merge(other, think=True)
        return self

    def merge(self, other: Counts, think: bool) -> None:
        """Add other's counts into these: the think-time fields (think=True) or
        all the others. Split so Tally can time what measuring costs."""
        # in place for the Counters and Timings (other is left as it was): this
        # runs three times per seat per game, so building new ones adds up
        for name in THINK_FIELDS if think else PLAIN_FIELDS:
            mine = getattr(self, name)
            mine += getattr(other, name)
            setattr(self, name, mine)

    def to_json(self) -> dict[str, Any]:
        checked = self.guard_correct + self.guard_incorrect
        return {
            "games": self.games,
            "gameWins": self.game_wins,
            "gameWinRate": wilson(self.game_wins, self.games),
            "rounds": self.rounds,
            "roundWins": self.round_wins,
            "roundWinRate": wilson(self.round_wins, self.rounds),
            "guard": {
                "played": self.guards,
                "correct": self.guard_correct,
                "incorrect": self.guard_incorrect,
                "protected": self.guard_protected,
                "accuracy": wilson(self.guard_correct, self.guard_correct + self.guard_incorrect),
            },
            "baron": {
                "played": self.barons,
                "won": self.baron_won,
                "lost": self.baron_lost,
                "tied": self.baron_tied,
                "protected": self.baron_protected,
            },
            "losses": {cause: self.losses[cause] for cause in CAUSES},
            "startCard": {
                card: {
                    "rounds": self.start_rounds[card],
                    "wins": self.start_wins[card],
                    "rate": wilson(self.start_wins[card], self.start_rounds[card]),
                }
                for card in CARDS
            },
            "guardOdds": {
                "checked": checked,
                "pickedBest": wilson(self.guard_picked_best, checked),
                "expected": self.guard_expected / checked if checked else None,
                "countingBest": self.guard_counting_best / checked if checked else None,
            },
            "priest": {
                "looks": self.priest_looks,
                "chances": self.priest_chances,
                "taken": self.priest_taken,
                "takenRate": wilson(self.priest_taken, self.priest_chances),
            },
            "baronByCard": {
                card: {o: self.baron_by_card[f"{card}|{o}"] for o in BARON_OUTCOMES.values()}
                for card in CARDS
            },
            "choices": [
                {"a": a, "b": b, "played": played, "n": n, "wins": self.choice_wins[key]}
                for key, n in sorted(self.choices.items())
                for a, b, played in [key.split("|")]
            ],
            "think": self.think_json() if self.think.n else None,
        }

    def think_json(self) -> dict[str, Any]:
        return {
            "turn": self.think.to_json(),
            "decision": {
                "card": self.think_card.to_json(),
                "target": self.think_target.to_json(),
                "guess": self.think_guess.to_json(),
            },
            "byCycle": [{"cycle": k, **t.to_json()} for k, t in sorted(self.think_by_cycle.items()) if t.n],  # type: ignore[dict-item]
            "byRound": [{"round": k, **t.to_json()} for k, t in sorted(self.think_by_round.items()) if t.n],  # type: ignore[dict-item]
            "byCard": {card: self.think_by_card[card].to_json() for card in CARDS if card in self.think_by_card},
        }


THINK_FIELDS = tuple(f.name for f in dataclasses.fields(Counts) if f.name.startswith("think"))
PLAIN_FIELDS = tuple(f.name for f in dataclasses.fields(Counts) if not f.name.startswith("think"))


def loss_cause(turn: TurnHistory, victim: int) -> str:
    """Why `victim` was knocked out on this turn (one of CAUSES, not "showdown")."""
    own = victim == turn.seat
    if isinstance(turn.played, Guard):
        return "guard"
    if isinstance(turn.played, Baron):
        return "ownBaron" if own else "baron"
    if isinstance(turn.played, Prince):
        return "ownPrince" if own else "prince"
    if isinstance(turn.played, Princess):
        return "princess"
    raise ValueError(f"No known way to be knocked out by {turn.played!r}")


def unseen(turn: TurnHistory, discards: dict[int, list[Card]]) -> Counter[str]:
    """The cards the player of `turn` couldn't see as they played it: the deck
    minus their own two cards and every face-up discard."""
    counts = DECK_COUNTS.copy()
    for card in (turn.held, turn.drawn, *(c for pile in discards.values() for c in pile)):
        if card is not None:
            counts[card.name] -= 1
    return counts


def count_game(gh: GameHistory) -> list[Counts]:
    """Everything each seat did in one game, as one Counts per seat."""
    counts = [Counts(games=1, game_wins=int(gh.winner == seat)) for seat in range(len(gh.players))]
    for rh in gh.rounds:
        count_round(rh, counts)
    return counts


def count_timing(timing: GameTiming, counts: list[Counts]) -> None:
    """One game's think times, into each seat's Counts."""
    for t in timing.turns:
        me = counts[t.seat]
        total = t.total_ns
        me.think.add(total)
        me.think_card.add(t.card_ns)
        if t.target_ns is not None:
            me.think_target.add(t.target_ns)
        if t.guess_ns is not None:
            me.think_guess.add(t.guess_ns)
        me.think_by_cycle.add(t.cycle, total)
        me.think_by_round.add(t.round, total)
        me.think_by_card.add(t.card, total)


def count_round(rh: RoundHistory, counts: list[Counts]) -> None:
    knocked_out: set[int] = set()
    priest_seen: dict[int, tuple[int, Card]] = {}  # seat -> (who they looked at, what they saw)

    for turn, table in walk(rh):
        me = counts[turn.seat]
        played = turn.played
        assert played is not None
        won = turn.seat in rh.winners

        # the choice: which of the two cards held was played
        a, b = sorted((turn.held, turn.drawn), key=lambda c: c.value)  # type: ignore[union-attr]
        key = f"{a.name}|{b.name}|{played.name}"
        me.choices[key] += 1
        me.choice_wins[key] += won

        # a Priest look from this player's last turn: could they use it now?
        if turn.seat in priest_seen:
            looked_at, seen = priest_seen.pop(turn.seat)
            count_priest_follow_up(me, turn, table.hands, table.protected, looked_at, seen)

        if isinstance(played, Guard):
            me.guards += 1
            if turn.outcome in (Outcome.CORRECT, Outcome.INCORRECT):
                me.guard_correct += turn.outcome is Outcome.CORRECT
                me.guard_incorrect += turn.outcome is Outcome.INCORRECT
                pool = unseen(turn, table.discards)
                total = sum(pool.values())
                best = max(pool[name] for name in GUESSABLE)
                assert turn.guess is not None
                me.guard_expected += pool[turn.guess.name] / total
                me.guard_counting_best += best / total
                me.guard_picked_best += pool[turn.guess.name] == best
            elif turn.outcome is Outcome.PROTECTED:
                me.guard_protected += 1

        elif isinstance(played, Baron):
            me.barons += 1
            outcome = BARON_OUTCOMES.get(turn.outcome)
            if outcome is not None:
                setattr(me, f"baron_{outcome}", getattr(me, f"baron_{outcome}") + 1)
                me.baron_by_card[f"{kept_card(turn).name}|{outcome}"] += 1

        elif isinstance(played, Priest) and turn.seen is not None:
            assert turn.target is not None
            me.priest_looks += 1
            priest_seen[turn.seat] = (turn.target, turn.seen)

        # looks this turn makes untrustworthy, for everyone who's still waiting to use one
        for seat, (looked_at, seen) in list(priest_seen.items()):
            if blurs_look(turn, looked_at, seen):
                del priest_seen[seat]

        for victim in turn.rejected:
            counts[victim].losses[loss_cause(turn, victim)] += 1
            knocked_out.add(victim)

    for seat, c in enumerate(counts):
        start = rh.starting_hands[seat].name
        won = seat in rh.winners
        c.rounds += 1
        c.start_rounds[start] += 1
        if won:
            c.round_wins += 1
            c.start_wins[start] += 1
        elif seat not in knocked_out:
            c.losses["showdown"] += 1


def count_priest_follow_up(
    me: Counts, turn: TurnHistory, hands: dict[int, Card | None], protected: set[int],
    looked_at: int, seen: Card,
) -> None:
    """The turn after a (still trustworthy) Priest look: was there a chance to use
    it, and was it taken?"""
    if hands[looked_at] is None or looked_at in protected:
        return  # they're out or protected
    assert type(hands[looked_at]) is type(seen)  # nothing has blurred the look, so they still hold it
    hand = (turn.held, turn.drawn)
    guard_chance = not isinstance(seen, Guard) and any(isinstance(c, Guard) for c in hand)
    baron_chance = any(
        isinstance(c, Baron) and other is not None and other.value > seen.value
        for c, other in (hand, hand[::-1])
    )
    if not (guard_chance or baron_chance):
        return

    me.priest_chances += 1
    on_them = turn.target == looked_at
    taken = on_them and (
        (guard_chance and isinstance(turn.played, Guard) and type(turn.guess) is type(seen))
        or (baron_chance and isinstance(turn.played, Baron))
    )
    if taken:
        me.priest_taken += 1
        assert looked_at in turn.rejected  # they still held the seen card, so it can't miss


def blurs_look(turn: TurnHistory, looked_at: int, seen: Card) -> bool:
    """Does `turn` stop a Priest look at `looked_at` (who held `seen`) being knowledge?
    Playing a card of the seen kind (the looker can't tell which copy went), or a
    Prince or King that moves the seen player's card."""
    played = turn.played
    if turn.seat == looked_at and (type(played) is type(seen) or isinstance(played, King)):
        return True
    hit = turn.target == looked_at and turn.outcome is not Outcome.PROTECTED
    return hit and isinstance(played, (Prince, King))


class Tally:
    def __init__(self, expected_games: int | None = None) -> None:
        self.games = 0
        self.rounds = 0
        self.tied_rounds = 0  # showdowns won by more than one player
        self.rounds_per_game: Counter[int] = Counter()
        self.players: dict[tuple[str, str], Counts] = {}  # (name, strategy), first-seen order
        self.seats: list[Counts] = []  # by seat number, whoever sat there
        self.turn_order: list[list[int]] = []  # [rounds, round wins] by position in the turn order

        # snapshot the win rates every `every` games (and after the last one)
        self.every = max(1, (expected_games or 1000) // CONVERGENCE_POINTS)
        self.convergence: list[dict[str, Any]] = []

        # performance, for games added with their timing (stats/timing.py)
        self.timed_games = 0
        self.timed_rounds = 0
        self.game_time = Timings()
        self.perf_over_time: list[dict[str, Any]] = []
        self._perf_last: dict[str, Any] | None = None  # running totals at the last snapshot
        self.measure_count_ns = 0  # time spent here on the think times: what measuring costs in counting

    def add(self, gh: GameHistory, timing: GameTiming | None = None) -> None:
        """Count one finished game, with its think times if it was timed."""
        n = len(gh.players)
        game = count_game(gh)  # this game's counts, per seat
        timed = timing is not None
        if timing is not None:
            start = perf_counter_ns()
            count_timing(timing, game)
            self.timed_games += 1
            self.timed_rounds += len(gh.rounds)
            self.game_time.add(timing.ns)
            self.measure_count_ns += perf_counter_ns() - start

        self.games += 1
        self.rounds += len(gh.rounds)
        self.rounds_per_game[len(gh.rounds)] += 1
        self.tied_rounds += sum(len(rh.winners) > 1 for rh in gh.rounds)

        for seat, counts in enumerate(game):
            player = self.players.setdefault((gh.players[seat], gh.strategies[seat]), Counts())
            while len(self.seats) <= seat:
                self.seats.append(Counts())
            player.merge(counts, think=False)
            self.seats[seat].merge(counts, think=False)
            if timed:
                start = perf_counter_ns()
                player.merge(counts, think=True)
                self.seats[seat].merge(counts, think=True)
                self.measure_count_ns += perf_counter_ns() - start

        for rh in gh.rounds:
            for seat in range(n):
                position = (seat - rh.dealer - 1) % n  # 0 = moves first
                while len(self.turn_order) <= position:
                    self.turn_order.append([0, 0])
                self.turn_order[position][0] += 1
                self.turn_order[position][1] += seat in rh.winners

        if self.games % self.every == 0:
            self.convergence.append(self._point())
            if self.timed_games:
                start = perf_counter_ns()
                totals = self._perf_totals()
                self.perf_over_time.append(perf_window(self._perf_last, totals))
                self._perf_last = totals
                self.measure_count_ns += perf_counter_ns() - start

    def _point(self) -> dict[str, Any]:
        """The game win rates right now, in the order of to_json's players and bots."""
        return {
            "games": self.games,
            "players": [wilson(c.game_wins, c.games) for c in self.players.values()],
            "bots": [wilson(c.game_wins, c.games) for c in self.by_bot().values()],
            "seats": [wilson(c.game_wins, c.games) for c in self.seats],
        }

    def _perf_totals(self) -> dict[str, Any]:
        """Running totals the over-time windows are differences of."""
        def lines(counts: list[Counts]) -> list[tuple[int, int]]:
            return [(c.think.total, c.think.n) for c in counts]
        return {
            "games": self.games,
            "timedGames": self.timed_games,
            "gameNs": self.game_time.total,
            "players": lines(list(self.players.values())),
            "bots": lines(list(self.by_bot().values())),
            "seats": lines(self.seats),
        }

    def performance(self) -> dict[str, Any] | None:
        if not self.timed_games:
            return None
        over_time = list(self.perf_over_time)
        if not over_time or over_time[-1]["games"] != self.games:
            over_time.append(perf_window(self._perf_last, self._perf_totals()))
        think = sum(c.think.total for c in self.seats)
        return {
            "games": self.timed_games,
            "gameTime": self.game_time.to_json(),
            "gameHistogram": self.game_time.histogram(),
            "perRound": self.game_time.total / self.timed_rounds * 1e-9,
            "total": self.game_time.total * 1e-9,
            "think": think * 1e-9,
            "measuringCount": self.measure_count_ns * 1e-9,  # exact: clocked inside add()
            "overTime": over_time,
        }

    def by_bot(self) -> dict[str, Counts]:
        """The players' counts summed per strategy, in first-seen order."""
        bots: dict[str, Counts] = {}
        for (_, strategy), counts in self.players.items():
            bots.setdefault(strategy, Counts())
            bots[strategy] += counts
        return bots

    def to_json(self) -> dict[str, Any]:
        """The stats so far, as JSON-able values (rates as {p, lo, hi} or None)."""
        convergence = list(self.convergence)
        if self.games and (not convergence or convergence[-1]["games"] != self.games):
            convergence.append(self._point())  # always end on the latest numbers
        seats_per_bot = Counter(strategy for _, strategy in self.players)
        return {
            "games": self.games,
            "rounds": self.rounds,
            "tiedRounds": self.tied_rounds,
            "roundsPerGame": {
                "mean": self.rounds / self.games if self.games else None,
                "min": min(self.rounds_per_game, default=None),
                "max": max(self.rounds_per_game, default=None),
                "histogram": sorted(self.rounds_per_game.items()),  # [[rounds, games], ...]
            },
            "players": [
                {"name": name, "bot": strategy, **counts.to_json()}
                for (name, strategy), counts in self.players.items()
            ],
            "bots": [
                {"bot": strategy, "seats": seats_per_bot[strategy], **counts.to_json()}
                for strategy, counts in self.by_bot().items()
            ],
            "seats": [{"seat": i, **counts.to_json()} for i, counts in enumerate(self.seats)],
            "turnOrder": [
                {"position": i, "rounds": rounds, "roundWins": wins, "roundWinRate": wilson(wins, rounds)}
                for i, (rounds, wins) in enumerate(self.turn_order)
            ],
            "convergence": convergence,
            "performance": self.performance(),
        }


def perf_window(before: dict[str, Any] | None, now: dict[str, Any]) -> dict[str, Any]:
    """One over-time point: ms per game and think time per turn (s), counting only
    the games between two snapshots of running totals."""
    def diff(group: str) -> list[float | None]:
        old = before[group] if before else []
        out: list[float | None] = []
        for i, (total, n) in enumerate(now[group]):
            t0, n0 = old[i] if i < len(old) else (0, 0)
            out.append((total - t0) / (n - n0) * 1e-9 if n > n0 else None)
        return out

    games = now["timedGames"] - (before["timedGames"] if before else 0)
    game_ns = now["gameNs"] - (before["gameNs"] if before else 0)
    return {
        "games": now["games"],
        "gameTime": game_ns / games * 1e-9 if games else None,
        "players": diff("players"),
        "bots": diff("bots"),
        "seats": diff("seats"),
    }
