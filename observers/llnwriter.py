from pathlib import Path
from cards import Baron, Guard, Handmaid, King, Priest, Prince, Princess
from history import Outcome

from .observer import Observer

ROOT_PATH = Path("./.")

VERSION = "1.1"

class LLNWriter(Observer):
    def __init__(self) -> None:
        self.names: list[str] = []
        self.lines: list[str] = []
