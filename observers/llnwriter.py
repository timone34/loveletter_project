from pathlib import Path
from typing import TYPE_CHECKING

from cards import Baron, Countess, Guard, Handmaid, King, Priest, Prince, Princess
from history import Outcome

from .observer import Observer

if TYPE_CHECKING:
    from cards import Card
    from history import GameHistory, RoundHistory, TurnHistory

VERSION = "1.1"
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

class LLNWriter(Observer):
    def on_game_end(self, game):
        file = self.construct_lln_file(game)
        

    def construct_lln_file(self, gh: GameHistory):
        file_lines: list[str] = []
        game_lines = self.generate_game_lines(gh)
        file_lines.extend(game_lines)
        
        for rh in gh.rounds: 
            round_lines = self.generate_round_lines(rh)
            file_lines.extend(round_lines)

            for th in rh.turns:
                turn_line = self.generate_turn_line(th)
                file_lines.append(turn_line)

            file_lines.append("")

        self.print_file_to_terminal(file_lines)
        self.save_file(file_lines)

    
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
            tie_string = "".join(str(seat) for seat in rh.winners)
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
            if th.target is None or th.guess is None:
                print(f"DEBUG: {th=}")
                print(f"Target: {th.target}")
                print(f"Guess: {th.guess}")
            else:
                guessed_letter = CARD_TO_LLN[type(th.guess)]
                line += f"{played_letter}{th.target + 1}:{guessed_letter}"
        elif isinstance(th.played, Priest):
            assert th.target is not None
            line += f"{played_letter}{th.target + 1}"
        elif isinstance(th.played, Baron):
            assert th.target is not None and th.outcome is not None
            assert th.outcome in (Outcome.WIN, Outcome.DRAW, Outcome.LOSE)
            line += f"{played_letter}{th.target + 1}{OUTCOME_TO_LLN[th.outcome]}"
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

    def save_file(self, file_lines: list[str]):
        pass