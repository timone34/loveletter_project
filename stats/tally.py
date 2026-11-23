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
                  had, `bestPossible` the chance of always naming the likeliest
                  card, `pickedBest` how often it did. Expected is accuracy
                  without the luck; beating bestPossible means it used private
                  knowledge (a Priest look, a King swap).
  priest          after a Priest look, the player's next turn: a chance to use
                  it when they then hold a Guard (and the card seen isn't a
                  Guard) or a Baron with a higher card beside it, and the seen
                  player is still in, unprotected and still holds that card.
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
"""
from __future__ import annotations

import dataclasses
from collections import Counter
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from engine.cards import Baron, Guard, Priest, Prince, Princess, guessable
from engine.deck import Deck
from engine.history import Outcome

from .replay import kept_card, walk

if TYPE_CHECKING:
    from engine.cards import Card
    from engine.history import GameHistory, RoundHistory, TurnHistory

# how a round was lost, in the order the Stats page shows them
CAUSES = ("guard", "baron", "ownBaron", "prince", "ownPrince", "princess", "showdown")

# card names, lowest value first, and how many of each are in the deck
CARDS = tuple(dict.fromkeys(c.name for c in sorted(Deck().cards, key=lambda c: c.value)))
DECK_COUNTS = Counter(c.name for c in Deck().cards)
GUESSABLE = tuple(c.name for c in guessable())
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
    guard_best_possible: float = 0.0  # sum of the chance of the likeliest card

    priest_looks: int = 0  # Priests that saw a card
    priest_chances: int = 0
    priest_taken: int = 0

    baron_by_card: Counter[str] = field(default_factory=Counter)  # "Guard|won" -> Barons

    choices: Counter[str] = field(default_factory=Counter)  # "Baron|Handmaid|Baron" -> times
    choice_wins: Counter[str] = field(default_factory=Counter)  # same keys -> rounds won after

    def __iadd__(self, other: Counts) -> Counts:
        for f in dataclasses.fields(self):
            setattr(self, f.name, getattr(self, f.name) + getattr(other, f.name))
        return self

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
                "bestPossible": self.guard_best_possible / checked if checked else None,
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
                me.guard_best_possible += best / total
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
    """The turn after a Priest look: was there a chance to use it, and was it taken?"""
    if type(hands[looked_at]) is not type(seen) or looked_at in protected:
        return  # they're out, protected, or no longer hold the card that was seen
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

    def add(self, gh: GameHistory) -> None:
        """Count one finished game."""
        n = len(gh.players)
        game = count_game(gh)  # this game's counts, per seat

        self.games += 1
        self.rounds += len(gh.rounds)
        self.rounds_per_game[len(gh.rounds)] += 1
        self.tied_rounds += sum(len(rh.winners) > 1 for rh in gh.rounds)

        for seat, counts in enumerate(game):
            self.players.setdefault((gh.players[seat], gh.strategies[seat]), Counts())
            self.players[gh.players[seat], gh.strategies[seat]] += counts
            while len(self.seats) <= seat:
                self.seats.append(Counts())
            self.seats[seat] += counts

        for rh in gh.rounds:
            for seat in range(n):
                position = (seat - rh.dealer - 1) % n  # 0 = moves first
                while len(self.turn_order) <= position:
                    self.turn_order.append([0, 0])
                self.turn_order[position][0] += 1
                self.turn_order[position][1] += seat in rh.winners

        if self.games % self.every == 0:
            self.convergence.append(self._point())

    def _point(self) -> dict[str, Any]:
        """The game win rates right now, in the order of to_json's players and bots."""
        return {
            "games": self.games,
            "players": [wilson(c.game_wins, c.games) for c in self.players.values()],
            "bots": [wilson(c.game_wins, c.games) for c in self.by_bot().values()],
            "seats": [wilson(c.game_wins, c.games) for c in self.seats],
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
        }
