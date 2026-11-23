"""Simulation runs for the webapp: settings, a queue that plays them, and the history.

    from runs import History, RunConfig

The stats themselves are defined in stats/tally.py; this package only runs
games and keeps the results.
"""
from .config import RunConfig
from .history import History

__all__ = ["History", "RunConfig"]
