import type { ReactNode } from "react";
import { pct } from "../../../sims/format";
import type { Rate } from "../../../sims/types";
import { useTooltip } from "./hooks";
import { TipRow } from "./TipRow";

// Horizontal bars for rates (win rate, guard accuracy), one row per player.
// The bar is the rate, the thin line across its end is the 95% interval, and
// an optional vertical line marks a reference (fair share) for all rows. A row
// can also carry its own `mark`, a short dark tick (e.g. the best a card counter
// could do for that player), explained once by `markLabel` in a legend.
// Plain HTML: each row is a CSS grid of label | track | value; positions are percentages.

export type RateRow = {
  label: string;
  color: string;
  rate: Rate;
  detail?: ReactNode; // second line in the tooltip, e.g. "312 of 1,000 games"
  mark?: number | null; // this row's own reference tick
};

type Props = { rows: RateRow[]; reference?: number; referenceLabel?: string; markLabel?: string };

export function RateBars({ rows, reference, referenceLabel, markLabel }: Props) {
  const tip = useTooltip();

  // scale: round the largest upper bound up to the next 10%, with room for the reference
  const top = Math.max(0.1, reference ? reference * 1.4 : 0, ...rows.map((r) => Math.max(r.rate?.hi ?? 0, r.mark ?? 0)));
  const max = Math.min(1, Math.ceil(top * 10) / 10);
  const x = (v: number) => `${(v / max) * 100}%`;
  const step = max > 0.5 ? 0.2 : 0.1;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);

  return (
    <div className="chart rate-bars">
      {markLabel && rows.some((r) => r.mark != null) && (
        <div className="legend">
          <span className="legend__item"><span className="rate-bars__mark-key" />{markLabel}</span>
        </div>
      )}
      {rows.map((r) => (
        <div className="rate-bars__row" key={r.label}>
          <span className="rate-bars__label">
            <span className="swatch" style={{ background: r.color }} />
            {r.label}
          </span>
          <div className="rate-bars__track">
            {ticks.map((t) => <span key={t} className="rate-bars__grid" style={{ left: x(t) }} />)}
            {reference != null && <span className="rate-bars__ref" style={{ left: x(reference) }} />}
            {r.rate && (
              <>
                <span className="rate-bars__bar" style={{ width: x(r.rate.p), background: r.color }} />
                <span className="rate-bars__ci" style={{ left: x(r.rate.lo), width: x(r.rate.hi - r.rate.lo) }} />
              </>
            )}
            {r.mark != null && <span className="rate-bars__mark" style={{ left: x(r.mark) }} />}
            {/* the whole track is the hover target, not just the painted bar */}
            <span
              className="rate-bars__hit"
              tabIndex={0}
              onPointerMove={(e) => tip.show(e, <RateTip row={r} markLabel={markLabel} />)}
              onFocus={(e) => tip.show(e, <RateTip row={r} markLabel={markLabel} />)}
              onPointerLeave={tip.hide}
              onBlur={tip.hide}
            />
          </div>
          <span className="rate-bars__value">{pct(r.rate?.p)}</span>
        </div>
      ))}

      <div className="rate-bars__row rate-bars__axis" aria-hidden="true">
        <span />
        <div className="rate-bars__track">
          {ticks.map((t) => <span key={t} className="rate-bars__tick" style={{ left: x(t) }}>{pct(t, 0)}</span>)}
          {reference != null && referenceLabel && (
            <span className="rate-bars__ref-label" style={{ left: x(reference) }}>{referenceLabel}</span>
          )}
        </div>
        <span />
      </div>
      {tip.node}
    </div>
  );
}

function RateTip({ row, markLabel }: { row: RateRow; markLabel?: string }) {
  return (
    <>
      <TipRow color={row.color} value={pct(row.rate?.p)} label={row.label} />
      {row.rate && <div className="tip__note">95% interval {pct(row.rate.lo)} – {pct(row.rate.hi)}</div>}
      {row.mark != null && <TipRow value={pct(row.mark)} label={markLabel ?? "mark"} />}
      {row.detail && <div className="tip__note">{row.detail}</div>}
    </>
  );
}
