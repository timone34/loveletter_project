from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

from cards import Baron, Countess, Guard, Handmaid, King, Priest, Prince, Princess
from history import Outcome

from .observer import Observer

if TYPE_CHECKING:
    from cards import Card
    from history import GameHistory, RoundHistory, TurnHistory

VERSION = "1.2"
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
        lines = self.construct_lln_file(game)
        if self.echo: self.print_file_to_terminal(lines)
        if self.save: self.save_file(lines)
        

    def construct_lln_file(self, gh: GameHistory) -> list[str]:
        file_lines: list[str] = []
        game_lines = self.generate_game_lines(gh)
        file_lines.extend(game_lines)
        
        for rh in gh.rounds: 
            file_lines.extend(self.generate_round_lines(rh))
            file_lines.extend(self.generate_turn_line(th) for th in rh.turns)
            file_lines.append("")

        return file_lines
    
    def generate_game_lines(self, gh: GameHistory) -> list[str]:
        lines: list[str] = []
        lines.append(f"[Version: {VERSION}]")
        lines.append(f"")

        for seat, (name, strat) in enumerate(zip(gh.players, gh.strategies)):
            line = f"[Seat {seat + 1}: {name}, {strat}]"
            lines.append(line)

        score_string = "-".join(str(score) for score in gh.scores.values())
        lines.append(f"[Score: {score_string}]")
        lines.append(f"")

        return lines


    def generate_round_lines(self, rh: RoundHistory) -> list[str]:
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

    def generate_turn_line(self, th: TurnHistory) -> str:
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

    def print_file_to_terminal(self, file_lines: list[str]):
        print("----- LLN FILE DEBUG -----")
        for line in file_lines:
            print(line)
        print("----- /LLN FILE DEBUG -----")

    def save_file(self, file_lines: list[str]) -> Path:
        now = datetime.now()
        folder = self.directory / now.strftime("%Y-%m-%d")
        folder.mkdir(parents=True, exist_ok=True)

        stem = now.strftime("%H-%M-%S")
        path = folder / f"{stem}.lln"
        n = 1
        while path.exists():
            path = folder / f"{stem}_{n}.lln"
            n += 1

        path.write_text("\n".join(file_lines).rstrip("\n") + "\n", encoding="utf-8")
        return path