from __future__ import annotations

import dataclasses
import secrets
from collections import Counter
from typing import Any

from bots import available_bots

NUM_PLAYERS = 4  # LLN and the webapp are four-player only for now
MAX_GAMES = 100_000  # ~3 minutes at ~1.7 ms a game
NAME_LIMIT = 24  # player names, same as the Play page


@dataclasses.dataclass
class Seat:
    name: str
    bot: str  # strategy id, e.g. "CardCounter"


@dataclasses.dataclass
class RunConfig:
    """Everything that decides a simulation's outcome, plus its label.

    The seed is always filled in (a random one if the browser leaves it empty),
    so every run in the history can be repeated game for game, as long as the
    bots' code hasn't changed since.
    """

    name: str
    players: list[Seat]  # starting seat order
    games: int = 1000
    target_round_wins: int = 3
    rotate_seats: bool = True
    seed: str = ""
    save_lln: bool = False
    measure_time: bool = True  # time every bot decision (stats/timing.py); ~25% slower
    # True when the browser left these empty and the server filled them in, so
    # "Edit & run" can leave them empty again (and a new lineup gets a new name)
    name_auto: bool = False
    seed_auto: bool = False

    @classmethod
    def from_json(cls, data: Any) -> RunConfig:
        """Validate settings from the browser. Raises ValueError with a readable message."""
        if not isinstance(data, dict):
            raise ValueError("No settings sent.")

        bots = available_bots()
        raw = data.get("players")
        if not isinstance(raw, list) or len(raw) != NUM_PLAYERS:
            raise ValueError(f"Pick exactly {NUM_PLAYERS} players.")
        players: list[Seat] = []
        for i, p in enumerate(raw):
            if not isinstance(p, dict) or p.get("bot") not in bots:
                raise ValueError(f"Unknown bot in seat {i + 1}: {p!r}")
            name = str(p.get("name") or "").strip()[:NAME_LIMIT] or f"Player {i + 1}"
            players.append(Seat(name, p["bot"]))
        if len({p.name.casefold() for p in players}) < len(players):
            raise ValueError("Every player needs a different name.")

        games = data.get("games", 1000)
        if not isinstance(games, int) or isinstance(games, bool) or not 1 <= games <= MAX_GAMES:
            raise ValueError(f"Number of games must be between 1 and {MAX_GAMES:,}.")

        target = data.get("targetRoundWins", 3)
        if not isinstance(target, int) or isinstance(target, bool) or not 1 <= target <= 9:
            raise ValueError("Round wins to win must be between 1 and 9.")

        seed = str(data.get("seed") or "").strip()[:40]
        name = str(data.get("name") or "").strip()[:60]

        return cls(
            name=name or default_name(players),
            players=players,
            games=games,
            target_round_wins=target,
            rotate_seats=bool(data.get("rotateSeats", True)),
            seed=seed or secrets.token_hex(3),
            save_lln=bool(data.get("saveLln", False)),
            measure_time=bool(data.get("measureTime", True)),
            name_auto=not name,
            seed_auto=not seed,
        )

    def to_json(self) -> dict[str, Any]:
        """The same shape from_json reads, so the browser can send it back to run it again."""
        return {
            "name": self.name,
            "players": [dataclasses.asdict(p) for p in self.players],
            "games": self.games,
            "targetRoundWins": self.target_round_wins,
            "rotateSeats": self.rotate_seats,
            "seed": self.seed,
            "saveLln": self.save_lln,
            "measureTime": self.measure_time,
            "nameAuto": self.name_auto,
            "seedAuto": self.seed_auto,
        }


def lineup_key(bots: list[str], target_round_wins: int) -> str:
    """What a run's speed depends on: which bots (not their seats or names) and
    how long a game is. "CardCounter+RandomChoice+RandomChoice+RandomChoice|3".
    web/src/sims/format.ts (lineupKey) builds the same key."""
    return f"{'+'.join(sorted(bots))}|{target_round_wins}"


def default_name(players: list[Seat]) -> str:
    """'CardCounter vs 3× RandomChoice'"""
    counts = Counter(p.bot for p in players)
    return " vs ".join(f"{n}× {bot}" if n > 1 else bot for bot, n in counts.items())
