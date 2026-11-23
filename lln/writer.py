from __future__ import annotations

from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

from engine.cards import Baron, Countess, Guard, Handmaid, King, Priest, Prince, Princess
from engine.history import Outcome

if TYPE_CHECKING:
    from engine.cards import Card
    from engine.history import GameHistory, RoundHistory, TurnHistory

LLN_VERSION = "1.5"
CARD_TO_LLN: dict[type[Card], str] = {
    Guard: "g",
    Priest: "p",
    Baron: "B",
    Handmaid: "H",
    Prince: "P",
    King: "K",
    Countess: "C",
    Princess: "Q"
}
OUTCOME_TO_LLN: dict[Outcome, str] = {
    Outcome.WIN: ">",
    Outcome.LOSE: "<",
    Outcome.DRAW: "=",
    Outcome.PROTECTED: "*"
}

GAMES_DIR = Path(__file__).resolve().parent.parent / "games"


def to_lln(ghs: list[GameHistory]) -> list[str]:
    """LLN 1.5: a shared lineup/target in the file header, one line per cycle."""
    if not ghs:
        raise ValueError("Nothing to write: no game histories given.")

    base = ghs[0]
    lines = [f"[Version: {LLN_VERSION}]", ""]
    lines.extend(generate_seat_lines(base))
    lines.append(f"[Target: {base.target_round_wins}]")
    lines.append("")

    for number, gh in enumerate(ghs, start=1):
        lines.extend(generate_game_lines(gh, number, base))
        for rh in gh.rounds:
            lines.extend(generate_round_lines(rh))
            lines.extend(generate_cycle_lines(rh))
            lines.append("")
        lines.append("")
    return lines


def generate_seat_lines(gh: GameHistory) -> list[str]:
    return [
        f"[Seat {seat + 1}: {name}, {strat}]"
        for seat, (name, strat) in enumerate(zip(gh.players, gh.strategies))
    ]


def rotation_of(base: GameHistory, gh: GameHistory) -> int | None:
    """k such that seat s of gh holds base's seat (s + k) % n, or None if gh isn't a rotation.

    simulate(rotate_seats=True) moves everyone one seat per game, so game i has rotation i % n.
    """
    n = len(base.players)
    if len(gh.players) != n:
        return None
    lineup = list(zip(base.players, base.strategies))
    seats = list(zip(gh.players, gh.strategies))
    for k in range(n):
        if all(seats[s] == lineup[(s + k) % n] for s in range(n)):
            return k
    return None


def generate_game_lines(gh: GameHistory, number: int, base: GameHistory) -> list[str]:
    lines = [f"[Game: {number}]"]

    k = rotation_of(base, gh)
    if k is None:  # not a rotation of the shared lineup: spell out this game's seats
        lines.extend(generate_seat_lines(gh))
    elif k:
        lines.append(f"[Rotation: {k}]")

    if gh.target_round_wins != base.target_round_wins:
        lines.append(f"[Target: {gh.target_round_wins}]")
    score_string = "-".join(str(gh.scores[seat]) for seat in range(len(gh.players)))
    lines.append(f"[Score: {score_string}]")
    lines.append("")

    return lines


def generate_round_lines(rh: RoundHistory) -> list[str]:
    lines: list[str] = []
    lines.append(f"[Round: {rh.number}]")
    lines.append(f"[Dealer: {rh.dealer + 1}]")
    deck_string = "".join(CARD_TO_LLN[type(card)] for card in rh.deck_order)
    lines.append(f"[Deck: {deck_string}]")

    result_string = ""
    if len(rh.winners) == 1:
        result_string = f"[Result: W{rh.winners[0] + 1}]"
    if len(rh.winners) > 1:
        tie_string = "".join(str(seat + 1) for seat in rh.winners)
        result_string = f"[Result: T{tie_string}]"
    lines.append(result_string)
    lines.append("")

    return lines


def generate_cycle_lines(rh: RoundHistory) -> list[str]:
    """One line per cycle, turns in play order: '1. g1:H p2 g1:Q# -'."""
    cycles: dict[int, list[str]] = {}
    for th in rh.turns:
        cycles.setdefault(th.cycle, []).append(generate_turn_body(th))
    return [f"{cycle}. {' '.join(bodies)}" for cycle, bodies in cycles.items()]


def generate_turn_line(th: TurnHistory) -> str:
    """Long form, one turn per line: '1.2. g1:H' (cycle 1, seat 2)."""
    return f"{th.cycle}.{th.seat + 1}. {generate_turn_body(th)}"


def generate_turn_body(th: TurnHistory) -> str:
    """The move itself, e.g. 'g1:H', 'B3<#', 'p4*' or '-' (skipped turn)."""
    if th.played is None:
        return "-"

    body = CARD_TO_LLN[type(th.played)]
    if isinstance(th.played, Guard):
        assert th.target is not None and th.guess is not None
        body += f"{th.target + 1}:{CARD_TO_LLN[type(th.guess)]}"
    elif isinstance(th.played, Baron):
        assert th.target is not None
        body += f"{th.target + 1}"
        if th.outcome in OUTCOME_TO_LLN and th.outcome is not Outcome.PROTECTED:
            body += OUTCOME_TO_LLN[th.outcome]
    elif isinstance(th.played, (Priest, Prince, King)):
        assert th.target is not None
        body += f"{th.target + 1}"
    # Handmaid, Countess and Princess have no target

    if th.outcome == Outcome.PROTECTED:
        body += "*"
    if th.rejected:
        body += "#"

    return body


def print_file_to_terminal(file_lines: list[str]):
    print("----- LLN FILE DEBUG -----")
    for line in file_lines:
        print(line)
    print("----- /LLN FILE DEBUG -----")


def file_stem(ghs: list[GameHistory], now: datetime) -> str:
    if len(ghs) == 1:
        return now.strftime("%H-%M-%S")

    counts = Counter(ghs[0].strategies)
    matchup = "-v-".join(f"{c}x{s}" if c > 1 else s for s, c in counts.items())
    return f"{matchup}_n{len(ghs)}"  # e.g. CardCounter-v-3xRandomChoice_n1000


def save_file(file_lines: list[str], directory: Path, stem: str) -> Path:
    folder = directory / datetime.now().strftime("%Y-%m-%d")
    folder.mkdir(parents=True, exist_ok=True)

    path = folder / f"{stem}.lln"
    n = 2
    while path.exists():  # same matchup/size run twice in one day, or same-second games
        path = folder / f"{stem}_{n}.lln"
        n += 1

    path.write_text("\n".join(file_lines).rstrip("\n") + "\n", encoding="utf-8")
    return path


def save_lln(ghs: list[GameHistory], directory: Path = GAMES_DIR) -> Path:
    return save_file(to_lln(ghs), directory, file_stem(ghs, datetime.now()))