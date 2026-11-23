// The shapes /api/simulations sends and receives. The Python side is
// runs/config.py (RunConfig) and stats/tally.py (Tally.to_json); keep them in step.

import type { SeatedBot } from "../components/BotTiles";

export type RunConfig = {
  name: string; // "" = the server makes one from the lineup
  players: SeatedBot[]; // always 4, in starting seat order
  games: number;
  targetRoundWins: number;
  rotateSeats: boolean;
  seed: string; // "" = the server rolls one, and keeps it with the run
  saveLln: boolean;
};

// A rate with its 95% Wilson interval, all 0-1. null when there was nothing to count.
export type Rate = { p: number; lo: number; hi: number } | null;

export const CAUSES = ["guard", "baron", "ownBaron", "prince", "ownPrince", "princess", "showdown"] as const;
export type Cause = (typeof CAUSES)[number];

// One player's numbers, or a bot's (the players using it, summed).
export type Line = {
  bot: string;
  name?: string; // players only
  seats?: number; // bots only: how many seats it had
  games: number; // for a bot: seat-games (3 seats x 1000 games = 3000)
  gameWins: number;
  gameWinRate: Rate;
  rounds: number;
  roundWins: number;
  roundWinRate: Rate;
  guard: { played: number; correct: number; incorrect: number; protected: number; accuracy: Rate };
  baron: { played: number; won: number; lost: number; tied: number; protected: number };
  losses: Record<Cause, number>; // how each lost round was lost
};

export type ConvergencePoint = { games: number; players: Rate[]; bots: Rate[] };

export type Stats = {
  games: number;
  rounds: number;
  tiedRounds: number;
  roundsPerGame: { mean: number | null; min: number | null; max: number | null; histogram: [number, number][] };
  players: Line[];
  bots: Line[];
  convergence?: ConvergencePoint[]; // left out of the history list
};

export type RunStatus = "queued" | "running" | "done" | "failed";

export type RunRecord = {
  id: string; // also sorts by time
  createdAt: string; // ISO, UTC
  status: RunStatus;
  error: string | null;
  progress: { done: number; total: number };
  durationSec: number | null;
  hasLln: boolean;
  config: RunConfig;
  botNames: Record<string, string>; // strategy id -> display name
  stats: Stats | null; // null until the first game is in
};

export const isActive = (r: RunRecord) => r.status === "queued" || r.status === "running";
