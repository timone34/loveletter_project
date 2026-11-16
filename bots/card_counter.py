from strategy import Strategy

import random
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from player import Player


class CardCounter(Strategy):
    def __init__(self) -> None:
        self.name = "Card Counter"

    