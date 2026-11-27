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
  measureTime?: boolean; // time every bot decision (default on); older runs don't have it
  // set by the server: true when name/seed were left empty and filled in for you
  nameAuto?: boolean;
  seedAuto?: boolean;
};

// A rate with its 95% Wilson interval, all 0-1. null when there was nothing to count.
export type Rate = { p: number; lo: number; hi: number } | null;

export const CAUSES = ["guard", "baron", "ownBaron", "prince", "ownPrince", "princess", "showdown"] as const;
export type Cause = (typeof CAUSES)[number];

// One player's numbers, a bot's (the players using it, summed), or a seat's
// (whoever sat there).
export type Line = {
  bot?: string; // players and bots
  name?: string; // players only
  seats?: number; // bots only: how many seats it had
  seat?: number; // seats only: 0-3
  games: number; // for a bot: seat-games (3 seats x 1000 games = 3000)
  gameWins: number;
  gameWinRate: Rate;
  rounds: number;
  roundWins: number;
  roundWinRate: Rate;
  guard: { played: number; correct: number; incorrect: number; protected: number; accuracy: Rate; countingBest: number | null };
  baron: { played: number; won: number; lost: number; tied: number; protected: number };
  losses: Record<Cause, number>; // how each lost round was lost
  // the definitions of these are in stats/tally.py's docstring
  startCard: Record<string, { rounds: number; wins: number; rate: Rate }>; // card name -> rounds started with it
  priest: { looks: number; chances: number; taken: number; takenRate: Rate };
  baronByCard: Record<string, BaronOutcomes>; // card kept beside the Baron -> outcomes
  choices: Choice[];
  think?: Think | null; // null when the run wasn't timed; missing on older runs
};

// A set of durations, all in seconds (stats/timing.py, Timings.to_json).
// mean has a 95% interval [lo, hi]; median and p95 are accurate to ~12%.
export type Timing = { n: number; total: number; mean: number; lo: number; hi: number; median: number; p95: number; max: number };

// One line's think time: the time spent inside the bot's own methods on a turn.
// The definitions are in stats/tally.py's docstring.
export type Think = {
  turn: Timing; // per turn played
  decision: { card: Timing | null; target: Timing | null; guess: Timing | null }; // per call
  byCycle: (Timing & { cycle: number })[];
  byRound: (Timing & { round: number })[];
  byCard: Record<string, Timing | null>; // card played -> per turn
};

// Think time per turn and game time over one stretch of the run, ending after `games`.
export type PerfPoint = { games: number; gameTime: number | null; players: (number | null)[]; bots: (number | null)[]; seats: (number | null)[] };

export type Performance = {
  games: number;
  gameTime: Timing; // per game, start to end
  gameHistogram?: [number, number, number][]; // [from s, to s, games]; left out of the history list
  perRound: number; // s
  total: number; // s, all games
  think: number; // s, all bots' think time; the rest of `total` is the engine
  measuringCount?: number; // s of counting spent on think times: what timing costs there (exact)
  overTime?: PerfPoint[]; // left out of the history list
};

// Where a run's time went (runs/history.py), and what it ran on.
export type RunTiming = {
  playSec: number;
  countSec: number;
  llnSec: number;
  turns?: number; // turns played (not skipped), all games
  machine: { cpu: string; cores: number | null; system: string; python: string };
};

// The latest speed of a lineup (runs/history.py, record_speed), from /api/lineup-speeds.
export type SpeedRun = { msPerGame: number; playUsPerTurn?: number | null; games: number; runId: string; at: string };
export type LineupSpeed = { bots: string[]; targetRoundWins: number; timed?: SpeedRun; plain?: SpeedRun; llnMsPerGame?: number };

export type BaronOutcomes = { won: number; tied: number; lost: number; protected: number };

// Held cards a and b (a the lower value), played `played`, n times; won the round `wins` of those.
export type Choice = { a: string; b: string; played: string; n: number; wins: number };

export type ConvergencePoint = { games: number; players: Rate[]; bots: Rate[]; seats: Rate[] };

// Round win rate by position in a round's turn order (0 = moves first).
export type TurnOrder = { position: number; rounds: number; roundWins: number; roundWinRate: Rate };

export type Stats = {
  games: number;
  rounds: number;
  tiedRounds: number;
  roundsPerGame: { mean: number | null; min: number | null; max: number | null; histogram: [number, number][] };
  players: Line[];
  bots: Line[];
  seats: Line[];
  turnOrder: TurnOrder[];
  convergence?: ConvergencePoint[]; // left out of the history list
  performance?: Performance | null; // null when the run wasn't timed
};

// outdated = saved by an older version of the stats (see runs/history.py, FORMAT)
export type RunStatus = "queued" | "running" | "done" | "failed" | "outdated";

export type RunRecord = {
  id: string; // also sorts by time
  createdAt: string; // ISO, UTC
  status: RunStatus;
  error: string | null;
  progress: { done: number; total: number };
  durationSec: number | null;
  timing?: RunTiming; // missing on runs from before format 4
  hasLln: boolean;
  config: RunConfig;
  botNames: Record<string, string>; // strategy id -> display name
  stats: Stats | null; // null until the first game is in, and for outdated runs
  savedFormat?: number; // outdated runs only
};

export const isActive = (r: RunRecord) => r.status === "queued" || r.status === "running";
