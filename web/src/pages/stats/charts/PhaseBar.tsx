import { pct, secs } from "../../../sims/format";
import { useTooltip } from "./hooks";
import { TipRow } from "./TipRow";

// Where a run's wall time went, as one 100% bar: the bots thinking, the
// engine running the games, counting the stats, writing the LLN, and the rest
// (setting up, saving). Parts under 0.5% are left out; shares are of the whole. Without timing on, bots and engine are one part.
// Styles: .phase in charts.css.

export type Phase = { label: string; sec: number; color: string; note: string };

export function PhaseBar({ phases }: { phases: Phase[] }) {
  const tip = useTooltip();
  const total = phases.reduce((s, p) => s + p.sec, 0);
  if (!total) return null;
  const shown = phases.filter((p) => p.sec / total >= 0.005); // under 0.5%: clutter, not information

  return (
    <div className="chart phase">
      <div className="legend">
        {shown.map((p) => (
          <span key={p.label} className="legend__item">
            <span className="swatch" style={{ background: p.color }} />
            {p.label} <strong>{pct(p.sec / total, 0)}</strong>
          </span>
        ))}
      </div>
      <div className="phase__bar">
        {shown.map((p) => {
          const content = (
            <>
              <TipRow color={p.color} value={secs(p.sec)} label={`${p.label} · ${pct(p.sec / total)}`} />
              <div className="tip__note">{p.note}</div>
            </>
          );
          return (
            <span
              key={p.label}
              className="phase__part"
              style={{ width: `${(p.sec / total) * 100}%`, background: p.color }}
              tabIndex={0}
              onPointerMove={(e) => tip.show(e, content)}
              onFocus={(e) => tip.show(e, content)}
              onPointerLeave={tip.hide}
              onBlur={tip.hide}
            />
          );
        })}
      </div>
      {tip.node}
    </div>
  );
}
