import { count, pct } from "../../../sims/format";
import type { Line } from "../../../sims/types";
import { useTooltip } from "./hooks";
import { TipRow } from "./TipRow";

// What happened when each player played a Baron: one 100% bar per player,
// split into won | tied | protected | lost. Won and lost are the two poles
// (blue and red), the outcomes where nothing happened are greys in between.

const PARTS = [
  { key: "won", label: "Won", color: "#2a78d6", ink: "#fff", note: "target knocked out" },
  { key: "tied", label: "Tied", color: "#b9b7ad", ink: "#2a2829", note: "same card, nothing happens" },
  { key: "protected", label: "Protected", color: "#dedcd3", ink: "#2a2829", note: "target had a Handmaid" },
  { key: "lost", label: "Lost", color: "#e34948", ink: "#fff", note: "the Baron's player knocked out" },
] as const;

export function BaronBars({ rows }: { rows: { label: string; color: string; line: Line }[] }) {
  const tip = useTooltip();

  return (
    <div className="chart baron">
      <div className="legend">
        {PARTS.map((p) => (
          <span key={p.key} className="legend__item">
            <span className="swatch" style={{ background: p.color }} />
            {p.label}
          </span>
        ))}
      </div>

      {rows.map(({ label, color, line }) => {
        const b = line.baron;
        return (
          <div className="baron__row" key={label}>
            <span className="rate-bars__label">
              <span className="swatch" style={{ background: color }} />
              {label}
            </span>
            <div className="baron__bar">
              {b.played === 0 && <span className="baron__empty">no Barons played</span>}
              {PARTS.map((p) => {
                const n = b[p.key];
                if (!n) return null;
                const share = n / b.played;
                const content = (
                  <>
                    <TipRow color={p.color} value={pct(share)} label={`${p.label} · ${label}`} />
                    <div className="tip__note">{count(n)} of {count(b.played)} Barons, {p.note}</div>
                  </>
                );
                return (
                  <span
                    key={p.key}
                    className="baron__part"
                    style={{ flexGrow: n, background: p.color, color: p.ink }}
                    tabIndex={0}
                    onPointerMove={(e) => tip.show(e, content)}
                    onFocus={(e) => tip.show(e, content)}
                    onPointerLeave={tip.hide}
                    onBlur={tip.hide}
                  >
                    {/* only labelled when the text comfortably fits */}
                    {share >= 0.12 && pct(share, 0)}
                  </span>
                );
              })}
            </div>
            <span className="rate-bars__value">{count(b.played)}</span>
          </div>
        );
      })}
      {tip.node}
    </div>
  );
}
