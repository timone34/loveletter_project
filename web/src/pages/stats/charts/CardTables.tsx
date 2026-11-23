import { GAME_CARDS } from "../../../components/cardData";
import { count, pct } from "../../../sims/format";
import { HeatTable, type HeatRow } from "./HeatTable";
import { TipRow } from "./TipRow";
import { blue, diverging } from "./ramps";

// Two per-card tables built on HeatTable.

const COLUMNS = GAME_CARDS.map((c) => ({ key: c.name, label: c.name, title: `${c.name} (${c.value})` }));
const MIN_N = 20; // fewer rounds/Barons than this: shown, but not shaded (too noisy)

// Round win rate by the card a player was dealt, shaded against that player's
// own round win rate: blue = this deal helps them, red = it hurts.
export function StartCardTable({ rows }: { rows: HeatRow[] }) {
  const diff = (row: HeatRow, card: string) => {
    const s = row.line.startCard[card];
    return s && s.rounds >= MIN_N && s.rate ? s.rate.p - (row.line.roundWinRate?.p ?? 0) : 0;
  };
  const maxAbs = Math.max(0.02, ...rows.flatMap((r) => COLUMNS.map((c) => Math.abs(diff(r, c.key)))));

  return (
    <HeatTable
      rows={rows}
      columns={COLUMNS}
      extra={{ label: "Overall", value: (r) => pct(r.line.roundWinRate?.p) }}
      cell={(row, card) => {
        const s = row.line.startCard[card];
        if (!s?.rounds || !s.rate) return null;
        const [bg, ink] = diverging(diff(row, card), maxAbs);
        return {
          text: pct(s.rate.p, 0),
          bg,
          ink,
          tip: (
            <>
              <TipRow color={row.color} value={pct(s.rate.p)} label={`${row.label} dealt a ${card}`} />
              <div className="tip__note">won {count(s.wins)} of {count(s.rounds)} rounds · 95% {pct(s.rate.lo)} – {pct(s.rate.hi)}</div>
              <div className="tip__note">their overall round win rate: {pct(row.line.roundWinRate?.p)}</div>
            </>
          ),
        };
      }}
    />
  );
}

// Baron comparisons by the card kept beside the Baron: the share of
// comparisons won (protected targets left out, since nothing was compared).
export function BaronByCardTable({ rows }: { rows: HeatRow[] }) {
  return (
    <HeatTable
      rows={rows}
      columns={COLUMNS}
      cell={(row, card) => {
        const o = row.line.baronByCard[card];
        const compared = o ? o.won + o.tied + o.lost : 0;
        if (!o || compared + o.protected === 0) return null;
        const rate = compared ? o.won / compared : 0;
        const [bg, ink] = compared >= MIN_N ? blue(rate, 1) : ["var(--background)", "var(--text-muted)"];
        return {
          text: compared ? pct(rate, 0) : "–",
          bg,
          ink,
          tip: (
            <>
              <div className="tip__title">{row.label}: Baron played, kept a {card}</div>
              <TipRow color="#2a78d6" value={count(o.won)} label="won" />
              <TipRow color="#b9b7ad" value={count(o.tied)} label="tied" />
              <TipRow color="#e34948" value={count(o.lost)} label="lost" />
              <TipRow color="#dedcd3" value={count(o.protected)} label="target protected" />
            </>
          ),
        };
      }}
    />
  );
}
