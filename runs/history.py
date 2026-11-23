"""Simulation runs: a queue that plays them one at a time, and their history on disk.

Each finished run is saved as simulations/<id>.json (settings + stats), plus
simulations/<id>.lln.bz2 when it was asked to keep the games. Runs that are
queued or still playing only live in memory; their stats so far can be read
at any time, which is what lets the Stats page fill in live.

Every record carries FORMAT, the version of its layout. A record saved with
another format (older code, before a stat was added or changed) is still
listed, with its settings, but as status "outdated" and without stats, so the
page never shows half-understood numbers. Its settings include the seed, so
running it again gives the same games with today's stats (if the bots haven't
changed since).

Runs play one at a time on a single worker thread, because a seeded run
reseeds Python's global `random` (see stats.iter_games): two at once would
make each other unrepeatable.
"""
from __future__ import annotations

import bz2
import json
import os
import queue
import secrets
import threading
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bots import available_bots
from lln.writer import generate_game_block, generate_header_lines
from stats.sim import iter_games
from stats.tally import Tally

from .config import RunConfig

HISTORY_DIR = Path(__file__).resolve().parent.parent / "simulations"

# Bump when the saved stats change shape or meaning (a new or redefined stat in
# stats/tally.py, a renamed field). 1 = the first version, which had no field.
FORMAT = 2


def checked(record: dict[str, Any]) -> dict[str, Any]:
    """A record read from disk, marked outdated if it was saved with another format."""
    if record.get("format", 1) == FORMAT:
        return record
    return {**record, "status": "outdated", "stats": None, "savedFormat": record.get("format", 1)}


class Run:
    """One simulation: its settings, progress and running tally."""

    def __init__(self, config: RunConfig) -> None:
        now = datetime.now(timezone.utc)
        self.id = f"{now:%Y%m%d-%H%M%S}-{secrets.token_hex(2)}"
        self.config = config
        self.created_at = now.isoformat(timespec="seconds")
        self.status = "queued"  # queued -> running -> done | failed
        self.error: str | None = None
        self.duration: float | None = None  # seconds of playing
        self.has_lln = False

        self.tally = Tally(expected_games=config.games)
        self.lock = threading.Lock()  # the worker adds games while the server reads
        self.cancelled = threading.Event()

    def to_json(self) -> dict[str, Any]:
        with self.lock:
            stats = self.tally.to_json() if self.tally.games else None
        bots = available_bots()
        return {
            "format": FORMAT,
            "id": self.id,
            "createdAt": self.created_at,
            "status": self.status,
            "error": self.error,
            "progress": {"done": self.tally.games, "total": self.config.games},
            "durationSec": self.duration,
            "hasLln": self.has_lln,
            "config": self.config.to_json(),
            # display names, kept with the run in case a bot is renamed later
            "botNames": {p.bot: bots[p.bot]().name if p.bot in bots else p.bot for p in self.config.players},
            "stats": stats,
        }


class History:
    def __init__(self, directory: Path = HISTORY_DIR) -> None:
        self.dir = directory
        self.active: dict[str, Run] = {}  # queued or running
        self.queue: queue.Queue[Run] = queue.Queue()
        self.lock = threading.Lock()
        self.worker: threading.Thread | None = None

    # --- reading --- #

    def list(self) -> list[dict[str, Any]]:
        """Every run, newest first, without the bulky chart data."""
        records = [run.to_json() for run in list(self.active.values())]
        if self.dir.exists():
            for path in self.dir.glob("*.json"):
                try:
                    records.append(checked(json.loads(path.read_text(encoding="utf-8"))))
                except (OSError, json.JSONDecodeError):
                    continue  # half-written or hand-edited: skip it rather than break the page
        for r in records:
            if r.get("stats"):
                r["stats"] = {k: v for k, v in r["stats"].items() if k != "convergence"}
        return sorted(records, key=lambda r: r["id"], reverse=True)

    def get(self, run_id: str) -> dict[str, Any] | None:
        run = self.active.get(run_id)
        if run is not None:
            return run.to_json()
        path = self._path(run_id, ".json")
        if path is None or not path.exists():
            return None
        return checked(json.loads(path.read_text(encoding="utf-8")))

    def lln_path(self, run_id: str) -> Path | None:
        path = self._path(run_id, ".lln.bz2")
        return path if path is not None and path.exists() else None

    # --- changing --- #

    def submit(self, config: RunConfig) -> dict[str, Any]:
        run = Run(config)
        with self.lock:
            self.active[run.id] = run
            if self.worker is None:
                self.worker = threading.Thread(target=self._work, daemon=True)
                self.worker.start()
        self.queue.put(run)
        return run.to_json()

    def rename(self, run_id: str, name: str) -> dict[str, Any] | None:
        name = name.strip()[:60]
        if not name:
            raise ValueError("A run needs a name.")
        run = self.active.get(run_id)
        if run is not None:
            run.config.name = name  # saved with the new name when it finishes
            run.config.name_auto = False
            return run.to_json()
        path = self._path(run_id, ".json")
        if path is None or not path.exists():
            return None
        record = json.loads(path.read_text(encoding="utf-8"))  # as saved, not the outdated view
        record["config"]["name"] = name
        record["config"]["nameAuto"] = False
        self._save(run_id, record)
        return checked(record)

    def delete(self, run_id: str) -> bool:
        """Stop a queued or running run, or delete a saved one."""
        run = self.active.pop(run_id, None)
        if run is not None:
            run.cancelled.set()  # the worker drops it at the next game
            return True
        found = False
        for suffix in (".json", ".lln.bz2"):
            path = self._path(run_id, suffix)
            if path is not None and path.exists():
                path.unlink()
                found = True
        return found

    # --- the worker thread --- #

    def _work(self) -> None:
        while True:
            run = self.queue.get()
            if run.cancelled.is_set():
                continue
            self._play(run)
            if not run.cancelled.is_set():
                self._save(run.id, run.to_json())
            self.active.pop(run.id, None)

    def _play(self, run: Run) -> None:
        cfg = run.config
        lln_tmp = self.dir / f"{run.id}.lln.bz2.part"
        lln = None
        run.status = "running"
        start = time.perf_counter()
        try:
            bots = available_bots()
            players = {p.name: bots[p.bot]() for p in cfg.players}
            if cfg.save_lln:
                self.dir.mkdir(parents=True, exist_ok=True)
                lln = bz2.open(lln_tmp, "wt", encoding="utf-8")

            games = iter_games(
                cfg.games, players, rotate_seats=cfg.rotate_seats,
                seed=cfg.seed, target_round_wins=cfg.target_round_wins,
            )
            base = None
            for number, gh in enumerate(games, start=1):
                if run.cancelled.is_set():
                    break
                with run.lock:
                    run.tally.add(gh)
                if lln is not None:
                    if base is None:
                        base = gh
                        lln.write("\n".join(generate_header_lines(base)) + "\n")
                    lln.write("\n".join(generate_game_block(gh, number, base)) + "\n")
            run.status = "done"
        except Exception as exc:
            traceback.print_exc()
            run.status = "failed"
            run.error = f"{type(exc).__name__}: {exc}"
        finally:
            run.duration = time.perf_counter() - start
            if lln is not None:
                lln.close()
                if run.status == "done" and not run.cancelled.is_set():
                    os.replace(lln_tmp, self.dir / f"{run.id}.lln.bz2")
                    run.has_lln = True
                else:
                    lln_tmp.unlink(missing_ok=True)

    # --- files --- #

    def _path(self, run_id: str, suffix: str) -> Path | None:
        """The file for a run id, or None for ids that aren't ours (no '../' tricks)."""
        if not run_id or not all(c.isalnum() or c == "-" for c in run_id):
            return None
        return self.dir / f"{run_id}{suffix}"

    def _save(self, run_id: str, record: dict[str, Any]) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        path = self.dir / f"{run_id}.json"
        tmp = path.with_suffix(".json.part")
        tmp.write_text(json.dumps(record), encoding="utf-8")
        os.replace(tmp, path)  # never leave a half-written record behind
