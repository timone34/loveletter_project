// Formatting and colours shared by the Simulate and Stats pages.

import type { LineupSpeed, Line, Rate, RunConfig, RunRecord } from "./types";

// One colour per player (or bot), by position in the lineup: seat 1 of the
// first game is always blue, and so on. Checked with the dataviz colour
// validator against --surface: every pair stays distinguishable, also with
// colour blindness. The values live in index.css (--series-1..4), with
// brighter versions for dark mode.
export const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
export const seriesColor = (i: number) => SERIES[i % SERIES.length];

export function pct(x: number | null | undefined, digits = 1): string {
  return x == null ? "–" : `${(x * 100).toFixed(digits)}%`;
}

export function rateText(r: Rate, digits = 1): string {
  return r ? `${pct(r.p, digits)} (${pct(r.lo, digits)}–${pct(r.hi, digits)})` : "–";
}

export function count(n: number): string {
  return n.toLocaleString("en-US");
}

export function duration(sec: number | null): string {
  if (sec == null) return "–";
  if (sec < 1) return `${Math.round(sec * 1000)} ms`;
  if (sec < 60) return `${sec.toFixed(1)} s`;
  return `${Math.floor(sec / 60)} min ${Math.round(sec % 60)} s`;
}

// A short duration with a unit that fits: "840 ns", "12.3 µs", "2.21 ms", "1.50 s".
// Three significant digits, which is all the clock is good for.
export function secs(s: number | null | undefined): string {
  if (s == null) return "–";
  const [v, unit] = s < 1e-6 ? [s * 1e9, "ns"] : s < 1e-3 ? [s * 1e6, "µs"] : s < 1 ? [s * 1e3, "ms"] : [s, "s"];
  return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${unit}`;
}

export function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// "Ann" for a player line, "Card Counter Bot ×2" for a bot line, "Seat 1" for a seat.
export function lineLabel(line: Line, run: RunRecord): string {
  if (line.name != null) return line.name;
  if (line.seat != null) return `Seat ${line.seat + 1}${line.seat === 0 ? " · deals" : line.seat === 1 ? " · starts" : ""}`;
  const bot = line.bot ?? "";
  const name = run.botNames[bot] ?? bot;
  return line.seats && line.seats > 1 ? `${name} ×${line.seats}` : name;
}

// "CardCounter vs 3× RandomChoice" style summary of a lineup, with display names.
export function lineupText(run: RunRecord): string {
  const counts = new Map<string, number>();
  for (const p of run.config.players) counts.set(p.bot, (counts.get(p.bot) ?? 0) + 1);
  return [...counts]
    .map(([bot, n]) => `${n > 1 ? `${n}× ` : ""}${run.botNames[bot] ?? bot}`)
    .join(" vs ");
}

// The name the server gives a run left unnamed (runs/config.py, default_name):
// "CardCounter vs 3× RandomChoice"
export function defaultName(bots: string[]): string {
  const counts = new Map<string, number>();
  for (const b of bots) counts.set(b, (counts.get(b) ?? 0) + 1);
  return [...counts].map(([bot, n]) => (n > 1 ? `${n}× ${bot}` : bot)).join(" vs ");
}

// The settings to start a new run from an old one's: a name or seed the
// server filled in goes back to empty, so it's made fresh again.
export function editable(config: RunConfig): RunConfig {
  const { nameAuto, seedAuto, ...rest } = config;
  return { ...rest, name: nameAuto ? "" : rest.name, seed: seedAuto ? "" : rest.seed };
}

export const MS_PER_GAME = 2.2; // playing + counting the stats, on the owner's machine; only for the time estimate
const TIMING_COST = 1.2; // a timed run takes about this much longer (measured: 3.1 vs 2.6 ms a game)
const LLN_MS_PER_GAME = 0.15; // writing LLN, when no run of the lineup has measured it yet

// The key runs/config.py's lineup_key builds: which bots (not seats or names) and how long a game is.
export function lineupKey(bots: string[], targetRoundWins: number): string {
  return `${[...bots].sort().join("+")}|${targetRoundWins}`;
}

// How long a run will take, from the latest finished run of the same lineup
// (with the same timing setting if there is one), else from MS_PER_GAME.
// `from` is that run's date, or null for the rough default.
export function estimate(
  speeds: Record<string, LineupSpeed> | null,
  bots: string[],
  targetRoundWins: number,
  games: number,
  measureTime: boolean,
  saveLln: boolean,
): { sec: number; from: string | null } {
  const entry = speeds?.[lineupKey(bots, targetRoundWins)];
  const same = measureTime ? entry?.timed : entry?.plain;
  const other = measureTime ? entry?.plain : entry?.timed;
  let ms = MS_PER_GAME * (measureTime ? TIMING_COST : 1);
  let from: string | null = null;
  if (same) {
    ms = same.msPerGame;
    from = same.at;
  } else if (other) {
    ms = other.msPerGame * (measureTime ? TIMING_COST : 1 / TIMING_COST);
    from = other.at;
  }
  if (saveLln) ms += entry?.llnMsPerGame ?? LLN_MS_PER_GAME;
  return { sec: (games * ms) / 1000, from };
}
