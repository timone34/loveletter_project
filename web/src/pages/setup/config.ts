// The setup page (/new): one lineup and its settings, for all three modes.
//   play      you and three bots, on the table (/play/table)
//   watch     four bots, one game on the table, nobody to ask
//   simulate  four bots, many games in the background, stats at /stats/<id>
//
// The lineup is always four bots. In Play mode you take a seat and the fourth
// bot sits out, so switching modes never loses a bot you picked.

import type { SeatedBot } from "../../components/BotTiles";
import { type Speed, type TableConfig, type Visibility } from "../play/config";
import { editable } from "../../sims/format";
import type { RunConfig } from "../../sims/types";

export type Mode = "play" | "watch" | "simulate";

export type SetupConfig = {
  mode: Mode;
  players: SeatedBot[]; // always 4, in seat order (in Play mode the 4th sits out)
  you: string;
  youSeat: number | null; // play: your seat 0-3, null = random
  targetRoundWins: number;
  seed: string; // "" = fresh shuffles (play/watch) or a random seed kept with the run (simulate)
  // play and watch
  tableName: string;
  speed: Speed;
  visibility: Visibility; // play only, for multiplayer later
  reveal: boolean; // watch only: every hand face up
  // simulate
  runName: string; // "" = named after the lineup
  games: number;
  rotateSeats: boolean;
  saveLln: boolean;
  measureTime: boolean; // time every bot decision (the Performance section of the stats)
};

export const MAX_GAMES = 100_000; // matches runs/config.py

export const DEFAULT_SETUP: SetupConfig = {
  mode: "play",
  players: [
    { name: "Alice", bot: "CardCounter" },
    { name: "Bob", bot: "RandomChoice" },
    { name: "Charlie", bot: "RandomChoice" },
    { name: "Diane", bot: "RandomChoice" },
  ],
  you: "You",
  youSeat: 3,
  targetRoundWins: 3,
  seed: "",
  tableName: "The Royal Court",
  speed: "normal",
  visibility: "private",
  reveal: true,
  runName: "",
  games: 1000,
  rotateSeats: true,
  saveLln: false,
  measureTime: true,
};

const STORAGE_KEY = "loveletter.setup";

export function loadSetup(): SetupConfig {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && Array.isArray(saved.players) && saved.players.length === 4) return { ...DEFAULT_SETUP, ...saved };
  } catch {
    // storage unavailable or garbled: defaults
  }
  return DEFAULT_SETUP;
}

export function saveSetup(config: SetupConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // not remembered; the game or run still starts
  }
}

// The players who actually sit down in this mode, in seat order.
export function seated(c: SetupConfig): string[] {
  return c.mode === "play" ? [c.you, ...c.players.slice(0, 3).map((p) => p.name)] : c.players.map((p) => p.name);
}

// null = fine, otherwise what to fix. The server checks the same things.
export function validate(c: SetupConfig): string | null {
  const names = seated(c).map((n) => n.trim());
  if (names.some((n) => n === "")) return "Every player needs a name.";
  if (new Set(names.map((n) => n.toLowerCase())).size < names.length) return "Every player needs a different name.";
  return null;
}

// For the table (/play/table and server.py's TableConfig).
export function toTableConfig(c: SetupConfig): TableConfig {
  const shared = {
    name: c.tableName,
    you: c.you,
    targetRoundWins: c.targetRoundWins,
    speed: c.speed,
    deckSeed: c.seed,
    visibility: c.visibility,
  };
  return c.mode === "watch"
    ? { ...shared, mode: "watch", seat: null, opponents: [], players: c.players, reveal: c.reveal }
    : { ...shared, mode: "play", seat: c.youSeat, opponents: c.players.slice(0, 3) };
}

// For /api/simulations (runs/config.py's RunConfig).
export function toRunConfig(c: SetupConfig): RunConfig {
  return {
    name: c.runName,
    players: c.players,
    games: c.games,
    targetRoundWins: c.targetRoundWins,
    rotateSeats: c.rotateSeats,
    seed: c.seed,
    saveLln: c.saveLln,
    measureTime: c.measureTime,
  };
}

// "Edit & run" on a Stats page: that run's settings, in Simulate mode. A name or
// seed the server made up goes back to empty, so they're made fresh again.
export function fromRun(run: RunConfig, base: SetupConfig): SetupConfig {
  const r = editable(run);
  return {
    ...base,
    mode: "simulate",
    players: r.players,
    runName: r.name,
    games: r.games,
    targetRoundWins: r.targetRoundWins,
    rotateSeats: r.rotateSeats,
    seed: r.seed,
    saveLln: r.saveLln,
    measureTime: r.measureTime ?? true,
  };
}
