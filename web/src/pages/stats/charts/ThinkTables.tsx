import { GAME_CARDS } from "../../../components/cardData";
import { count, secs } from "../../../sims/format";
import type { Timing } from "../../../sims/types";
import { HeatTable, type HeatRow } from "./HeatTable";
import { TipRow } from "./TipRow";
import { blue } from "./ramps";

// Two tables of mean think time, built on HeatTable and shaded one blue,
// more highlighted = slower (darker in light mode, brighter in dark mode, see ramps.ts),
// against the slowest cell in the table:
//   by decision   which call the time goes to (choosing the card, the target,
//                 the Guard guess), each averaged over the turns it happened on
//   by card       per turn, by the card that was played

const MIN_N = 20; // fewer turns than this: shown, but not shaded (too noisy)

function timingCell(row: HeatRow, t: Timing | null | undefined, max: number, what: string) {
  if (!t) return null;
  const [bg, ink] = t.n >= MIN_N ? blue(t.mean, max) : ["transparent", "var(--text-muted)"];
  return {
    text: secs(t.mean),
    bg,
    ink,
    tip: (
      <>
        <TipRow color={row.color} value={secs(t.mean)} label={`${row.label} · ${what}`} />
        <div className="tip__note">mean of {count(t.n)} · 95% {secs(t.lo)} – {secs(t.hi)}</div>
        <div className="tip__note">median {secs(t.median)} · p95 {secs(t.p95)} · slowest {secs(t.max)}</div>
      </>
    ),
  };
}

const DECISIONS = [
  { key: "card", label: "Card", what: "choosing which card to play (every turn)" },
  { key: "target", label: "Target", what: "choosing a target (cards that have one)" },
  { key: "guess", label: "Guard guess", what: "naming a card for the Guard" },
] as const;

export function DecisionTable({ rows }: { rows: HeatRow[] }) {
  const get = (row: HeatRow, key: string) => row.line.think?.decision[key as (typeof DECISIONS)[number]["key"]];
  const max = Math.max(1e-9, ...rows.flatMap((r) => DECISIONS.map((d) => get(r, d.key)?.mean ?? 0)));
  return (
    <HeatTable
      rows={rows}
      columns={DECISIONS.map((d) => ({ key: d.key, label: d.label, title: d.what }))}
      extra={{ label: "Per turn", value: (r) => secs(r.line.think?.turn.mean) }}
      cell={(row, key) => timingCell(row, get(row, key), max, DECISIONS.find((d) => d.key === key)!.what)}
    />
  );
}

const CARD_COLUMNS = GAME_CARDS.map((c) => ({ key: c.name, label: c.name, title: `${c.name} (${c.value})` }));

export function ThinkByCardTable({ rows }: { rows: HeatRow[] }) {
  const max = Math.max(1e-9, ...rows.flatMap((r) => CARD_COLUMNS.map((c) => r.line.think?.byCard[c.key]?.mean ?? 0)));
  return (
    <HeatTable
      rows={rows}
      columns={CARD_COLUMNS}
      cell={(row, card) => timingCell(row, row.line.think?.byCard[card], max, `turns playing a ${card}`)}
    />
  );
}
