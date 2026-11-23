"""Parse Love Letter Notation (.lln) files back into GameHistory objects.

An .lln file only stores the deck order, the dealer and each player's choices
(card, target, guess). Everything else in the history (held/drawn cards, Priest
sightings, Prince redraws, King swaps, rejections, showdowns, ...) follows from
those. Rather than re-implementing the rules, the parser *replays* each game
through the real engine (game.Game) with a fixed deck and a scripted strategy,
then checks the replay against the file line by line.
"""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

from engine import Deck, Game, GameHistory, Observers, Strategy

from .writer import CARD_TO_LLN, generate_turn_body, generate_turn_line

if TYPE_CHECKING:
    from engine import Card, Player

# 1.4 added [Target: n]; 1.5 added the shared file header, [Rotation: k] and one line per cycle
SUPPORTED_VERSIONS = {"1.3", "1.4", "1.5"}
KNOWN_TAGS = {"Version", "Game", "Seat", "Target", "Rotation", "Score", "Round", "Dealer", "Deck", "Result"}
LLN_TO_CARD: dict[str, type[Card]] = {letter: card for card, letter in CARD_TO_LLN.items()}
DECK_COUNTS = Counter(CARD_TO_LLN[type(card)] for card in Deck().cards)

_TAG_RE = re.compile(r"^\[(\w+)(?: (\d+))?:\s*(.*?)\s*\]$")
_BODY_RE = re.compile(
    r"^(-|(?P<card>[gpBHPKCQ])(?P<target>\d)?(?::(?P<guess>[pBHPKCQ]))?"
    r"(?P<baron>[<>=])?(?P<protected>\*)?(?P<rejected>#)?)$"
)
_LONG_TURN_RE = re.compile(r"^(\d+)\.(\d+)\.\s+(\S+)$")  # "1.2. g1:H": one turn, cycle 1, seat 2
_CYCLE_RE = re.compile(r"^(\d+)\.\s+(.+)$")  # "1. g1:H p2 g1:Q# -": a whole cycle, in play order
_RESULT_RE = re.compile(r"^(W\d|T\d{2,})$")


class LLNParseError(ValueError):
    def __init__(self, message: str, line: int | None = None) -> None:
        self.line = line
        super().__init__(f"line {line}: {message}" if line is not None else message)


# ---------------------------------------------------------------- stage A: text

@dataclass
class ParsedTurn:
    line: int
    cycle: int
    seat: int | None  # 0-based; None in cycle lines (the replay knows whose turn it is)
    body: str  # the move itself, e.g. "g3:K*" or "-"
    card: type[Card] | None = None  # None = skipped turn ("-")
    target: int | None = None  # 0-based seat
    guess: type[Card] | None = None

    @property
    def text(self) -> str:
        if self.seat is None:
            return f"{self.body!r} in cycle {self.cycle}"
        return repr(f"{self.cycle}.{self.seat + 1}. {self.body}")


@dataclass
class ParsedRound:
    line: int
    number: int
    dealer: int | None = None  # 0-based seat
    deck: str | None = None
    winners: list[int] | None = None  # 0-based seats
    turns: list[ParsedTurn] = field(default_factory=list)


@dataclass
class ParsedGame:
    line: int
    number: int
    players: list[str] = field(default_factory=list)
    strategies: list[str] = field(default_factory=list)
    scores: list[int] | None = None
    target_round_wins: int | None = None  # None = not in file (LLN 1.3) or inherited
    rotation: int | None = None  # [Rotation: k]: shared lineup shifted by k seats
    rounds: list[ParsedRound] = field(default_factory=list)


def parse_text(text: str) -> list[ParsedGame]:
    games: list[ParsedGame] = []
    defaults = ParsedGame(0, 0)  # file header (LLN 1.5): shared lineup and target
    version: str | None = None
    game: ParsedGame | None = None
    rnd: ParsedRound | None = None

    for line_no, raw in enumerate(text.splitlines(), start=1):
        line = raw.split("//", 1)[0].strip()
        if not line or line == "...":
            continue

        if version is None:
            m = _TAG_RE.match(line)
            if not m or m.group(1) != "Version":
                raise LLNParseError("file must start with a [Version: ...] tag", line_no)
            if m.group(3) not in SUPPORTED_VERSIONS:
                raise LLNParseError(
                    f"unsupported LLN version {m.group(3)!r} "
                    f"(supported: {', '.join(sorted(SUPPORTED_VERSIONS))})", line_no
                )
            version = m.group(3)
            continue

        if line.startswith("["):
            m = _TAG_RE.match(line)
            if not m:
                raise LLNParseError(f"malformed tag {line!r} (expected e.g. [Round: 1])", line_no)
            tag, index, value = m.group(1), m.group(2), m.group(3)
            if tag not in KNOWN_TAGS:
                base, number = tag.rstrip("0123456789"), tag[len(tag.rstrip("0123456789")):]
                hint = f"; did you mean [{base} {number}: ...]?" if base in KNOWN_TAGS and number else ""
                raise LLNParseError(f"unknown tag [{tag}]{hint}", line_no)

            if tag == "Game":
                if game: _finish_game(game, defaults, version)
                game = ParsedGame(line_no, _int(value, line_no))
                games.append(game)
                rnd = None
                continue
            if game is None:  # file header: the shared lineup and target
                if tag == "Seat":
                    _parse_seat(defaults, index, value, line_no)
                elif tag == "Target":
                    defaults.target_round_wins = _parse_target(value, line_no)
                else:
                    raise LLNParseError(f"[{tag}] tag outside of a [Game: ...] block", line_no)
                continue

            if tag == "Seat":
                _parse_seat(game, index, value, line_no)
            elif tag == "Rotation":
                if game.rounds:
                    raise LLNParseError("[Rotation] must come before the first round", line_no)
                game.rotation = _int(value, line_no)
            elif tag == "Score":
                if game.rounds:
                    raise LLNParseError("[Score] must come before the first round", line_no)
                game.scores = [_int(s, line_no) for s in value.split("-")]
            elif tag == "Target":
                if game.rounds:
                    raise LLNParseError("[Target] must come before the first round", line_no)
                game.target_round_wins = _parse_target(value, line_no)
            elif tag == "Round":
                if not game.rounds:
                    _resolve_lineup(game, defaults, line_no)
                rnd = ParsedRound(line_no, _int(value, line_no))
                game.rounds.append(rnd)
            elif rnd is None:
                raise LLNParseError(f"[{tag}] tag outside of a [Round: ...] block", line_no)
            elif tag == "Dealer":
                rnd.dealer = _parse_seat_ref(game, value, line_no)
            elif tag == "Deck":
                rnd.deck = _parse_deck(value, line_no)
            elif tag == "Result":
                rnd.winners = _parse_result(value, len(game.players), line_no)
            elif tag == "Version":
                raise LLNParseError("[Version] may only appear once, at the top of the file", line_no)
            continue

        if rnd is None:
            raise LLNParseError(f"turn line outside of a round: {line!r}", line_no)
        assert game is not None
        rnd.turns.extend(_parse_turns(line, len(game.players), line_no))

    if version is None:
        raise LLNParseError("empty file: no [Version: ...] tag")
    if not games:
        raise LLNParseError("no [Game: ...] blocks found")
    assert game is not None
    _finish_game(game, defaults, version)
    return games


def _int(value: str, line: int) -> int:
    try:
        return int(value)
    except ValueError:
        raise LLNParseError(f"expected a number, got {value!r}", line) from None


def _parse_seat(game: ParsedGame, index: str | None, value: str, line: int) -> None:
    if game.rounds:
        raise LLNParseError("[Seat] tags must come before the first round", line)
    if index is None or int(index) != len(game.players) + 1:
        raise LLNParseError(f"expected [Seat {len(game.players) + 1}: ...]", line)
    name, sep, strategy = value.rpartition(",")
    if not sep or not name.strip() or not strategy.strip():
        raise LLNParseError(f"expected [Seat n: name, strategy], got {value!r}", line)
    if name.strip() in game.players:
        raise LLNParseError(f"duplicate player name {name.strip()!r}", line)
    game.players.append(name.strip())
    game.strategies.append(strategy.strip())


def _parse_target(value: str, line: int) -> int:
    target = _int(value, line)
    if target < 1:
        raise LLNParseError("[Target] must be at least 1", line)
    return target


def _resolve_lineup(game: ParsedGame, defaults: ParsedGame, line: int) -> None:
    """Fill in a game's seats and target from the file header, unless it has its own."""
    if game.target_round_wins is None:
        game.target_round_wins = defaults.target_round_wins
    if game.players:
        if game.rotation is not None:
            raise LLNParseError(f"game {game.number} has both [Seat] tags and a [Rotation]", line)
        return
    if not defaults.players:
        raise LLNParseError(
            f"game {game.number} has no seats: add [Seat] tags to the file header or to the game", line
        )
    n, k = len(defaults.players), game.rotation or 0
    if not 0 <= k < n:
        raise LLNParseError(f"[Rotation: {k}] must be between 0 and {n - 1}", line)
    game.players = [defaults.players[(s + k) % n] for s in range(n)]
    game.strategies = [defaults.strategies[(s + k) % n] for s in range(n)]


def _parse_seat_ref(game: ParsedGame, value: str, line: int) -> int:
    # 1.3 writes the seat number; older hand-written files use the player's name
    if value.isdigit():
        seat = int(value) - 1
        if not 0 <= seat < len(game.players):
            raise LLNParseError(f"seat {value} does not exist", line)
        return seat
    if value in game.players:
        return game.players.index(value)
    raise LLNParseError(f"unknown player {value!r}", line)


def _parse_deck(value: str, line: int) -> str:
    bad = sorted(set(value) - set(LLN_TO_CARD))
    if bad:
        raise LLNParseError(f"unknown card letter(s) in deck: {''.join(bad)}", line)
    if Counter(value) != DECK_COUNTS:
        raise LLNParseError(
            f"deck {value!r} is not a full Love Letter deck "
            f"(expected {dict(DECK_COUNTS)}, got {dict(Counter(value))})", line
        )
    return value


def _parse_result(value: str, num_players: int, line: int) -> list[int]:
    if not _RESULT_RE.match(value):
        raise LLNParseError(f"expected [Result: W<seat>] or [Result: T<seats>], got {value!r}", line)
    winners = [int(d) - 1 for d in value[1:]]
    if any(not 0 <= w < num_players for w in winners):
        raise LLNParseError(f"result names a seat that does not exist: {value!r}", line)
    return winners


def _parse_turns(line_text: str, num_players: int, line: int) -> list[ParsedTurn]:
    """A long-form line ('1.2. g1:H') or a cycle line ('1. g1:H p2 g1:Q# -')."""
    m = _LONG_TURN_RE.match(line_text)
    if m:
        seat = int(m.group(2)) - 1
        if not 0 <= seat < num_players:
            raise LLNParseError(f"seat {seat + 1} does not exist", line)
        return [_parse_body(m.group(3), int(m.group(1)), seat, num_players, line)]

    m = _CYCLE_RE.match(line_text)
    if not m:
        raise LLNParseError(f"malformed turn line {line_text!r}", line)
    cycle = int(m.group(1))
    return [_parse_body(body, cycle, None, num_players, line) for body in m.group(2).split()]


def _parse_body(body: str, cycle: int, seat: int | None, num_players: int, line: int) -> ParsedTurn:
    m = _BODY_RE.match(body)
    if not m:
        raise LLNParseError(f"malformed turn {body!r}", line)
    turn = ParsedTurn(line, cycle, seat, body)
    if m.group("card"):
        turn.card = LLN_TO_CARD[m.group("card")]
        if m.group("target"):
            turn.target = int(m.group("target")) - 1
            if not 0 <= turn.target < num_players:
                raise LLNParseError(f"target seat {turn.target + 1} does not exist", line)
        if m.group("guess"):
            turn.guess = LLN_TO_CARD[m.group("guess")]
    return turn


def _finish_game(game: ParsedGame, defaults: ParsedGame, version: str) -> None:
    if not game.rounds:
        _resolve_lineup(game, defaults, game.line)
    if version != "1.3" and game.target_round_wins is None:
        raise LLNParseError(f"game {game.number} has no [Target] tag", game.line)
    if len(game.players) < 2:
        raise LLNParseError(f"game {game.number} needs at least 2 [Seat] tags", game.line)
    if game.scores is None:
        raise LLNParseError(f"game {game.number} has no [Score] tag", game.line)
    if len(game.scores) != len(game.players):
        raise LLNParseError(
            f"game {game.number}: [Score] has {len(game.scores)} entries for {len(game.players)} seats",
            game.line,
        )
    if not game.rounds:
        raise LLNParseError(f"game {game.number} has no rounds", game.line)
    for rnd in game.rounds:
        for tag, value in (("Dealer", rnd.dealer), ("Deck", rnd.deck), ("Result", rnd.winners)):
            if value is None:
                raise LLNParseError(f"round {rnd.number} is missing its [{tag}] tag", rnd.line)


# -------------------------------------------------------------- stage B: replay

class ScriptedStrategy(Strategy):
    """Plays whatever the .lln file says this seat played."""

    def __init__(self, strategy_id: str, game: ReplayGame) -> None:
        self.id = strategy_id
        self.name = f"Replay of {strategy_id}"
        self.description = "Replays moves from an LLN file."
        self.game = game

    def choose_card(self, player: Player, playable: list[Card]) -> Card:
        turn = self.game.current_turn(player)
        if turn.card is None:
            raise LLNParseError(f"seat {player.seat + 1} is still in the round but the turn is '-'", turn.line)
        for card in playable:
            if type(card) is turn.card:
                return card
        hand = ", ".join(c.name for c in player.hand)
        raise LLNParseError(
            f"seat {player.seat + 1} cannot play {turn.card.name} (hand: {hand}"
            f"{'; Countess must be played' if len(playable) < len(player.hand) else ''})",
            turn.line,
        )

    def choose_target(self, player: Player, card: Card, targets: list[Player]) -> Player:
        turn = self.game.current_turn(player)
        if turn.target is None:
            raise LLNParseError(f"{card.name} needs a target", turn.line)
        for target in targets:
            if target.seat == turn.target:
                return target
        raise LLNParseError(f"seat {turn.target + 1} is not a legal target for the {card.name}", turn.line)

    def guard_guess(self, player: Player, target: Player) -> Card:
        turn = self.game.current_turn(player)
        if turn.guess is None:
            raise LLNParseError("Guard needs a guess (e.g. g3:K)", turn.line)
        return turn.guess()


class ReplayGame(Game):
    """A Game whose decks and decisions come from a ParsedGame."""

    def __init__(self, parsed: ParsedGame, target_round_wins: int = 3) -> None:
        self.parsed = parsed
        players: dict[str, Strategy] = {
            name: ScriptedStrategy(strategy, self)
            for name, strategy in zip(parsed.players, parsed.strategies)
        }
        super().__init__(players, target_round_wins, observers=Observers())

    @property
    def parsed_round(self) -> ParsedRound:
        return self.parsed.rounds[self.round - 1]

    def _new_deck(self) -> Deck:
        if self.round > len(self.parsed.rounds):
            last = self.parsed.rounds[-1]
            raise LLNParseError(
                f"game {self.parsed.number} is not decided after round {last.number}, "
                f"but the file has no round {self.round}", last.line
            )
        pr = self.parsed_round
        if pr.number != self.round:
            raise LLNParseError(f"expected [Round: {self.round}], got [Round: {pr.number}]", pr.line)
        if pr.dealer != self.dealer:
            raise LLNParseError(
                f"round {pr.number}: dealer should be seat {self.dealer + 1} "
                f"(the seat before the previous round's winner), file says seat {pr.dealer + 1}",
                pr.line,
            )
        assert pr.deck is not None
        deck = Deck()
        deck.cards = [LLN_TO_CARD[letter]() for letter in pr.deck]
        return deck

    def current_turn(self, player: Player) -> ParsedTurn:
        rnd = self.current_round
        assert rnd is not None
        pr = self.parsed_round
        index = len(rnd.history.turns)  # Round appends each turn after it is played
        if index >= len(pr.turns):
            raise LLNParseError(
                f"round {pr.number} is not over yet; expected a turn for seat {player.seat + 1}",
                pr.turns[-1].line if pr.turns else pr.line,
            )
        turn = pr.turns[index]
        if turn.seat is not None and (turn.cycle, turn.seat) != (rnd.cycle, player.seat):
            raise LLNParseError(
                f"expected turn {rnd.cycle}.{player.seat + 1}., got {turn.cycle}.{turn.seat + 1}.", turn.line
            )
        if turn.cycle != rnd.cycle:  # cycle line with too many or too few turns
            raise LLNParseError(
                f"{turn.body!r} is written in cycle {turn.cycle}, but in the replay it is "
                f"seat {player.seat + 1}'s turn in cycle {rnd.cycle}", turn.line,
            )
        return turn

    def verify(self) -> None:
        """Compare the replayed history with what the file claims."""
        gh, pg = self.history, self.parsed
        if len(gh.rounds) < len(pg.rounds):
            extra = pg.rounds[len(gh.rounds)]
            raise LLNParseError(f"game {pg.number} was already decided before round {extra.number}", extra.line)

        for rh, pr in zip(gh.rounds, pg.rounds):
            for i, th in enumerate(rh.turns):
                expected = generate_turn_line(th)  # long form: names cycle and seat
                if i >= len(pr.turns):
                    end = pr.turns[-1].line if pr.turns else pr.line
                    raise LLNParseError(f"round {pr.number} is missing turn {expected!r}", end)
                pt = pr.turns[i]
                if (
                    pt.body != generate_turn_body(th)
                    or pt.cycle != th.cycle
                    or (pt.seat is not None and pt.seat != th.seat)
                ):
                    raise LLNParseError(
                        f"turn {pt.text} does not match the replay, which gives {expected!r}", pt.line
                    )
            if len(pr.turns) > len(rh.turns):
                extra = pr.turns[len(rh.turns)]
                raise LLNParseError(f"round {pr.number} was already over before {extra.text}", extra.line)
            if rh.winners != pr.winners:
                raise LLNParseError(
                    f"round {pr.number}: [Result] says seat(s) {_seats(pr.winners)} won, "
                    f"the replay says {_seats(rh.winners)}", pr.line,
                )

        scores = [gh.scores[seat] for seat in range(len(gh.players))]
        if scores != pg.scores:
            raise LLNParseError(
                f"game {pg.number}: [Score] is {'-'.join(map(str, pg.scores))}, "
                f"the replay gives {'-'.join(map(str, scores))}", pg.line,
            )


def _seats(seats: list[int] | None) -> str:
    return ", ".join(str(s + 1) for s in seats or [])


# ------------------------------------------------------------------ public API

def replay(parsed: ParsedGame, target_round_wins: int = 3) -> GameHistory:
    """target_round_wins is only used when the file has no [Target] tag (LLN 1.3)."""
    if parsed.target_round_wins is not None:
        target_round_wins = parsed.target_round_wins
    game = ReplayGame(parsed, target_round_wins)
    game.play()
    game.verify()
    return game.history


def parse_lln(text: str, target_round_wins: int = 3) -> list[GameHistory]:
    """Turn the contents of an .lln file into fully populated GameHistory objects.

    target_round_wins is a fallback for LLN 1.3 files; newer files store it in [Target].
    """
    return [replay(pg, target_round_wins) for pg in parse_text(text)]


def load_lln(path: str | Path, target_round_wins: int = 3) -> list[GameHistory]:
    return parse_lln(Path(path).read_text(encoding="utf-8"), target_round_wins)
