from __future__ import annotations

from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

from cards import Baron, Countess, Guard, Handmaid, King, Priest, Prince, Princess
from history import Outcome

from .observer import Observer

if TYPE_CHECKING:
    from cards import Card
    from history import GameHistory, RoundHistory, TurnHistory

LLN_VERSION = "1.4"
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


class LLNWriter(Observer):
    def __init__(self, echo: bool = False, save: bool = True, directory: Path = GAMES_DIR) -> None:
        self.echo = echo
        self.save = save
        self.directory = directory

    
    def on_game_end(self, game):
        lines = to_lln([game])
        if self.echo: print_file_to_terminal(lines)
        if self.save: save_file(lines, self.directory, file_stem([game], datetime.now()))
        

def to_lln(ghs: list[GameHistory]) -> list[str]:
    if not ghs:
        raise ValueError("Nothing to write: no game histories given.")
    
    lines = [f"[Version: {LLN_VERSION}]", ""]
    for number, gh in enumerate(ghs, start=1):
        lines.extend(generate_game_lines(gh, number))
        for rh in gh.rounds:
            lines.extend(generate_round_lines(rh))
            lines.extend(generate_turn_line(th) for th in rh.turns)
            lines.append("")
        lines.append("")
    return lines


def generate_game_lines(gh: GameHistory, number: int) -> list[str]:
    lines = [f"[Game: {number}]"]

    for seat, (name, strat) in enumerate(zip(gh.players, gh.strategies)):
        line = f"[Seat {seat + 1}: {name}, {strat}]"
        lines.append(line)

    lines.append(f"[Target: {gh.target_round_wins}]")
    score_string = "-".join(str(score) for score in gh.scores.values())
    lines.append(f"[Score: {score_string}]")
    lines.append(f"")

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
    lines.append(f"")

    return lines


def generate_turn_line(th: TurnHistory) -> str:
    line: str = ""

    line += (f"{th.cycle}.{th.seat + 1}. ")

    if th.played is None: 
        line += "-"
        return line
    
    played_letter = CARD_TO_LLN[type(th.played)]
    if isinstance(th.played, Guard):
        assert th.target is not None and th.guess is not None
        guessed_letter = CARD_TO_LLN[type(th.guess)]
        line += f"{played_letter}{th.target + 1}:{guessed_letter}"
    elif isinstance(th.played, Priest):
        assert th.target is not None
        line += f"{played_letter}{th.target + 1}"
    elif isinstance(th.played, Baron):
        assert th.target is not None
        line += f"{played_letter}{th.target + 1}"
        if th.outcome in OUTCOME_TO_LLN and th.outcome is not Outcome.PROTECTED:
            line += OUTCOME_TO_LLN[th.outcome]
    elif isinstance(th.played, Handmaid):
        line += f"{played_letter}"
    elif isinstance(th.played, Prince):
        assert th.target is not None
        line += f"{played_letter}{th.target + 1}"
    elif isinstance(th.played, King):
        assert th.target is not None
        line += f"{played_letter}{th.target + 1}"
    elif isinstance(th.played, Countess):
        line += f"{played_letter}"
    elif isinstance(th.played, Princess):
        line += f"{played_letter}"

    if th.outcome == Outcome.PROTECTED:
        line += "*"
    if th.rejected:
        line += "#"

    return line


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