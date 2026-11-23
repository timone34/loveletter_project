import importlib
import pkgutil

from engine import Strategy

from .bot_random import RandomChoice
from .bot_no_princess import NoPrincess, NoPrincessDumb
from .bot_card_counter import CardCounter
from .bot_terminal import TerminalPlayer

# The order here is the order bots are listed in (e.g. the webapp's picker).
__all__ = [
  "RandomChoice",
  "NoPrincessDumb",
  "NoPrincess",
  "CardCounter",
  "TerminalPlayer",
]


def available_bots() -> dict[str, type[Strategy]]:
    """Every bot in this folder, by strategy id: the names in __all__ first,
    then any bot file that isn't exported yet. Strategies that need a human
    (human = True, e.g. TerminalPlayer) are left out."""
    exported = [globals()[name] for name in __all__]
    found: list[type] = []
    for info in pkgutil.iter_modules(__path__):
        module = importlib.import_module(f"{__name__}.{info.name}")
        found += [
            obj for obj in vars(module).values()
            if isinstance(obj, type) and issubclass(obj, Strategy)
            and obj.__module__ == module.__name__ and obj not in exported
        ]

    bots: dict[str, type[Strategy]] = {}
    for cls in exported + sorted(found, key=lambda c: c.__name__):
        if getattr(cls, "human", False):
            continue
        bots[cls().id] = cls
    return bots
