import { count, pct } from "../../../sims/format";
import type { Line } from "../../../sims/types";
import { useTooltip } from "./hooks";
import { TipRow } from "./TipRow";

// Guard guesses held against the odds the guesser could have known (see
// stats/tally.py, "guard odds"). Per row, on one 0-max scale:
//   bar   = expected accuracy: the average chance its guesses had (skill, no luck)
//   tick  = best possible: always naming the likeliest card
//   dot   = actual accuracy (skill + luck)
// The gap between bar and tick is what better guessing could still win.

type Row = { label: string; color: string; line: Line };

export function GuardOdds({ rows }: { rows: Row[] }) {
  const tip = useTooltip();
  const values = rows.flatMap((r) => [r.line.guardOdds.bestPossible ?? 0, r.line.guard.accuracy?.hi ?? 0]);
  const max = Math.max(0.1, Math.ceil(Math.max(...values) * 10) / 10);
  const x = (v: number) => `${(v / max) * 100}%`;
  const ticks = Array.from({ length: Math.round(max / 0.1) + 1 }, (_, i) => i * 0.1);

  return (
    <div className="chart rate-bars">
      <div className="legend">
        <span className="legend__item"><span className="swatch" style={{ background: "var(--text-muted)" }} />Expected from its guesses</span>
        <span className="legend__item"><span className="odds__tick-key" />Best possible</span>
        <span className="legend__item"><span className="odds__dot-key" />Actual</span>
      </div>

      {rows.map((r) => {
        const g = r.line.guardOdds;
        const actual = r.line.guard.accuracy?.p ?? null;
        const content = (
          <>
            <div className="tip__title">{r.label} · {count(g.checked)} guesses checked</div>
            <TipRow color={r.color} value={pct(g.expected)} label="expected from its guesses" />
            <TipRow value={pct(g.bestPossible)} label="best possible (likeliest card)" />
            <TipRow value={pct(actual)} label="actual" />
            <div className="tip__note">Named the likeliest card {pct(g.pickedBest?.p)} of the time</div>
          </>
        );
        return (
          <div className="rate-bars__row" key={r.label}>
            <span className="rate-bars__label">
              <span className="swatch" style={{ background: r.color }} />
              {r.label}
            </span>
            <div className="rate-bars__track">
              {ticks.map((t) => <span key={t} className="rate-bars__grid" style={{ left: x(t) }} />)}
              {g.expected != null && <span className="rate-bars__bar" style={{ width: x(g.expected), background: r.color }} />}
              {g.bestPossible != null && <span className="odds__tick" style={{ left: x(g.bestPossible) }} />}
              {actual != null && <span className="odds__dot" style={{ left: x(actual) }} />}
              <span
                className="rate-bars__hit"
                tabIndex={0}
                onPointerMove={(e) => tip.show(e, content)}
                onFocus={(e) => tip.show(e, content)}
                onPointerLeave={tip.hide}
                onBlur={tip.hide}
              />
            </div>
            <span className="rate-bars__value" title="Named the likeliest card">{pct(g.pickedBest?.p, 0)}</span>
          </div>
        );
      })}

      <div className="rate-bars__row rate-bars__axis" aria-hidden="true">
        <span />
        <div className="rate-bars__track">
          {ticks.map((t) => <span key={t} className="rate-bars__tick" style={{ left: x(t) }}>{pct(t, 0)}</span>)}
        </div>
        <span className="rate-bars__tick-note">likeliest</span>
      </div>
      {tip.node}
    </div>
  );
}
