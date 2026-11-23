// Formatting and colours shared by the Simulate and Stats pages.

import type { Line, Rate, RunRecord } from "./types";

// One colour per player (or bot), by position in the lineup: seat 1 of the
// first game is always blue, and so on. Checked with the dataviz colour
// validator against --surface: every pair stays distinguishable, also with
// colour blindness.
export const SERIES = ["#2a78d6", "#eb6834", "#199e70", "#9e3f6e"];
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

export function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// "Ann" for a player line, "Card Counter Bot ×2" for a bot line.
export function lineLabel(line: Line, run: RunRecord): string {
  if (line.name != null) return line.name;
  const name = run.botNames[line.bot] ?? line.bot;
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

export const MS_PER_GAME = 1.7; // measured on the owner's machine; only for the time estimate
