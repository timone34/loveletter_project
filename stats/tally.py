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
4-player table, whatever the number of seats).
"""
from __future__ import annotations

import dataclasses
from collections import Counter
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from engine.cards import Baron, Guard, Prince, Princess
from engine.history import Outcome

if TYPE_CHECKING:
    from engine.history import GameHistory, TurnHistory

# how a round was lost, in the order the Stats page shows them
CAUSES = ("guard", "baron", "ownBaron", "prince", "ownPrince", "princess", "showdown")

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

    def __iadd__(self, other: Counts) -> Counts:
        for f in dataclasses.fields(self):
            setattr(self, f.name, getattr(self, f.name) + getattr(other, f.name))
        return self

    def to_json(self) -> dict[str, Any]:
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
        }


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


class Tally:
    def __init__(self, expected_games: int | None = None) -> None:
        self.games = 0
        self.rounds = 0
        self.tied_rounds = 0  # showdowns won by more than one player
        self.rounds_per_game: Counter[int] = Counter()
        self.players: dict[tuple[str, str], Counts] = {}  # (name, strategy), first-seen order

        # snapshot the win rates every `every` games (and after the last one)
        self.every = max(1, (expected_games or 1000) // CONVERGENCE_POINTS)
        self.convergence: list[dict[str, Any]] = []

    def _counts(self, gh: GameHistory, seat: int) -> Counts:
        key = (gh.players[seat], gh.strategies[seat])
        if key not in self.players:
            self.players[key] = Counts()
        return self.players[key]

    def add(self, gh: GameHistory) -> None:
        """Count one finished game."""
        seats = range(len(gh.players))
        counts = [self._counts(gh, seat) for seat in seats]

        self.games += 1
        self.rounds += len(gh.rounds)
        self.rounds_per_game[len(gh.rounds)] += 1

        for seat in seats:
            counts[seat].games += 1
            counts[seat].game_wins += gh.winner == seat

        for rh in gh.rounds:
            if len(rh.winners) > 1:
                self.tied_rounds += 1
            knocked_out: set[int] = set()

            for turn in rh.turns:
                if turn.played is None:  # skipped: the player was already out
                    continue
                me = counts[turn.seat]

                if isinstance(turn.played, Guard):
                    me.guards += 1
                    if turn.outcome is Outcome.CORRECT:
                        me.guard_correct += 1
                    elif turn.outcome is Outcome.INCORRECT:
                        me.guard_incorrect += 1
                    elif turn.outcome is Outcome.PROTECTED:
                        me.guard_protected += 1

                elif isinstance(turn.played, Baron):
                    me.barons += 1
                    if turn.outcome is Outcome.WIN:
                        me.baron_won += 1
                    elif turn.outcome is Outcome.LOSE:
                        me.baron_lost += 1
                    elif turn.outcome is Outcome.DRAW:
                        me.baron_tied += 1
                    elif turn.outcome is Outcome.PROTECTED:
                        me.baron_protected += 1

                for victim in turn.rejected:
                    counts[victim].losses[loss_cause(turn, victim)] += 1
                    knocked_out.add(victim)

            for seat in seats:
                counts[seat].rounds += 1
                if seat in rh.winners:
                    counts[seat].round_wins += 1
                elif seat not in knocked_out:
                    counts[seat].losses["showdown"] += 1

        if self.games % self.every == 0:
            self.convergence.append(self._point())

    def _point(self) -> dict[str, Any]:
        """The game win rates right now, in the order of to_json's players and bots."""
        return {
            "games": self.games,
            "players": [wilson(c.game_wins, c.games) for c in self.players.values()],
            "bots": [wilson(c.game_wins, c.games) for c in self.by_bot().values()],
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
            "convergence": convergence,
        }
