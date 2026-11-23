from __future__ import annotations

from datetime import datetime
from pathlib import Path

from engine.observer import Observer
from lln.writer import GAMES_DIR, file_stem, print_file_to_terminal, save_file, to_lln


class LLNWriter(Observer):
    """Writes every finished game to games/{date}/{time}.lln (and/or prints it)."""

    def __init__(self, echo: bool = False, save: bool = True, directory: Path = GAMES_DIR) -> None:
        self.echo = echo
        self.save = save
        self.directory = directory

    def on_game_end(self, game):
        lines = to_lln([game])
        if self.echo: print_file_to_terminal(lines)
        if self.save: save_file(lines, self.directory, file_stem([game], datetime.now()))
