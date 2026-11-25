import { count, pct, secs } from "../../../sims/format";
import { useTooltip, useWidth } from "./hooks";
import { niceStep } from "./scale";
import { TipRow } from "./TipRow";

// How long games took: one column per log-spaced bucket (each about 26% wider
// than the one before, see stats/timing.py), so the long tail of slow games
// (a GC pause, a busy machine) fits on the same chart as the bulk. Dashed
// lines mark the median and p95. Hover a column for its numbers.

const HEIGHT = 200;
const M = { top: 22, right: 8, bottom: 28, left: 44 };

export function TimeHistogram({ bins, median, p95, unit = "games" }: {
  bins: [number, number, number][]; // [from s, to s, count]
  median: number;
  p95: number;
  unit?: string;
}) {
  const { ref: sizeRef, width } = useWidth<HTMLDivElement>();
  const tip = useTooltip();
  if (!bins.length) return null;

  const total = bins.reduce((s, [, , k]) => s + k, 0);
  const peak = Math.max(...bins.map(([, , k]) => k));
  const w = Math.max(0, width - M.left - M.right);
  const h = HEIGHT - M.top - M.bottom;
  const band = w / bins.length;
  const step = niceStep(peak, 4);
  const top = Math.ceil(peak / step) * step;
  const y = (v: number) => h - (v / top) * h;
  const yTicks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const labelEvery = Math.ceil(64 / band);

  // a duration's x position: log scale across the buckets
  const lo = Math.log10(bins[0][0]);
  const hi = Math.log10(bins[bins.length - 1][1]);
  const xOf = (s: number) => ((Math.log10(s) - lo) / (hi - lo)) * w;
  const markers = [
    { s: median, label: "median" },
    { s: p95, label: "p95" },
  ];

  return (
    <div className="chart">
      <div ref={sizeRef}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label={`Number of ${unit} by how long they took`}>
            <g transform={`translate(${M.left},${M.top})`}>
              {yTicks.map((v) => (
                <g key={v}>
                  <line className="grid" x1={0} x2={w} y1={y(v)} y2={y(v)} />
                  <text className="axis" x={-8} y={y(v)} dy="0.32em" textAnchor="end">{count(v)}</text>
                </g>
              ))}
              {bins.map(([from, to, k], i) => {
                const content = <TipRow value={`${count(k)} ${unit}`} label={`${secs(from)} – ${secs(to)} · ${pct(k / total)}`} />;
                const barW = Math.max(1, band - 1);
                return (
                  <g key={i}>
                    {k > 0 && <rect className="column" x={band * i} y={y(k)} width={barW} height={h - y(k)} rx={Math.min(2, barW / 2)} />}
                    {i % labelEvery === 0 && <text className="axis" x={band * i} y={h + 18} textAnchor="start">{secs(from)}</text>}
                    <rect
                      x={band * i}
                      width={band}
                      height={h}
                      fill="transparent"
                      tabIndex={0}
                      onPointerMove={(e) => tip.show(e, content)}
                      onFocus={(e) => tip.show(e, content)}
                      onPointerLeave={tip.hide}
                      onBlur={tip.hide}
                    />
                  </g>
                );
              })}
              {/* median label to the left of its line, p95 to the right, so they never collide */}
              {markers.map((m, i) => (
                <g key={m.label} pointerEvents="none">
                  <line className="ref" x1={xOf(m.s)} x2={xOf(m.s)} y1={-6} y2={h} />
                  <text className="axis" x={xOf(m.s) + (i ? 4 : -4)} y={-8} textAnchor={i ? "start" : "end"}>{m.label} {secs(m.s)}</text>
                </g>
              ))}
            </g>
          </svg>
        )}
      </div>
      {tip.node}
    </div>
  );
}
