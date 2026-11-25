import { useState } from "react";
import { secs } from "../../../sims/format";
import { useTooltip, useWidth } from "./hooks";
import { niceStep } from "./scale";
import { TipRow } from "./TipRow";

// Durations along an x axis, one line per player (or bot, or seat): think time
// by cycle, by round number, or over the run. Each line is 2px with its 95%
// interval as a faint band (when the points have one); points with too few
// turns behind them are left out, so the line simply stops. The y axis starts
// at 0, so lines can be compared by height. Hover anywhere: a crosshair snaps
// to the nearest x and the tooltip lists every line there.
//
// Used by the Performance section of Results.tsx.

export type TimePoint = { y: number; lo?: number; hi?: number; n?: number } | null;
export type TimeSeries = { label: string; color: string; points: TimePoint[] }; // points[i] at xs[i]

const HEIGHT = 220;
const M = { top: 12, right: 16, bottom: 30, left: 64 };

export function TimeLines({ xs, series, xLabel, tipTitle, ariaLabel }: {
  xs: number[];
  series: TimeSeries[];
  xLabel: (x: number) => string; // axis tick text
  tipTitle: (x: number) => string; // tooltip heading, e.g. "Cycle 3"
  ariaLabel: string;
}) {
  const { ref: sizeRef, width } = useWidth<HTMLDivElement>();
  const tip = useTooltip();
  const [hover, setHover] = useState<number | null>(null);

  const w = Math.max(0, width - M.left - M.right);
  const h = HEIGHT - M.top - M.bottom;
  const n = xs.length;

  const values = series.flatMap((s) => s.points.flatMap((p) => (p ? [p.hi ?? p.y] : [])));
  const peak = Math.max(...values, 0);
  const step = peak > 0 ? niceStep(peak, 4) : 1;
  const top = Math.ceil((peak * 1.05) / step) * step || step;
  const yTicks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  const x0 = xs[0] ?? 0;
  const x1 = xs[n - 1] ?? 1;
  const x = (v: number) => (x1 === x0 ? w / 2 : ((v - x0) / (x1 - x0)) * w);
  const y = (v: number) => h - (v / top) * h;
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 60))));

  const path = (pts: TimePoint[]) =>
    pts.map((p, i) => (p ? `${i && pts[i - 1] ? "L" : "M"}${x(xs[i]).toFixed(1)},${y(p.y).toFixed(1)}` : "")).join("");
  // a band per unbroken stretch of points that have an interval
  const bands = (pts: TimePoint[]) => {
    const runs: number[][] = [];
    pts.forEach((p, i) => {
      if (p?.lo == null || p.hi == null) return;
      if (i && pts[i - 1]?.lo != null) runs[runs.length - 1].push(i);
      else runs.push([i]);
    });
    return runs
      .filter((r) => r.length > 1)
      .map((r) => {
        const upper = r.map((i) => `${x(xs[i]).toFixed(1)},${y(pts[i]!.hi!).toFixed(1)}`);
        const lower = [...r].reverse().map((i) => `${x(xs[i]).toFixed(1)},${y(pts[i]!.lo!).toFixed(1)}`);
        return `M${upper.join("L")}L${lower.join("L")}Z`;
      })
      .join("");
  };

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const at = x0 + ((e.clientX - box.left) / box.width) * (x1 - x0);
    let best = 0;
    xs.forEach((v, i) => Math.abs(v - at) < Math.abs(xs[best] - at) && (best = i));
    setHover(best);
    const rows = series.map((s) => ({ s, p: s.points[best] })).sort((a, b) => (b.p?.y ?? -1) - (a.p?.y ?? -1));
    tip.show(e, (
      <>
        <div className="tip__title">{tipTitle(xs[best])}</div>
        {rows.map(({ s, p }) => (
          <TipRow
            key={s.label}
            color={s.color}
            value={p ? secs(p.y) : "–"}
            label={p?.n != null ? `${s.label} · ${p.n.toLocaleString("en-US")} turns` : s.label}
          />
        ))}
      </>
    ));
  };

  return (
    <div className="chart">
      <div className="legend">
        {series.map((s) => (
          <span key={s.label} className="legend__item">
            <span className="swatch" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div ref={sizeRef}>
        {width > 0 && n > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label={ariaLabel}>
            <g transform={`translate(${M.left},${M.top})`}>
              {yTicks.map((v) => (
                <g key={v}>
                  <line className="grid" x1={0} x2={w} y1={y(v)} y2={y(v)} />
                  <text className="axis" x={-8} y={y(v)} dy="0.32em" textAnchor="end">{v === 0 ? "0" : secs(v)}</text>
                </g>
              ))}
              {xs.map((v, i) => i % labelEvery === 0 && (
                <text key={v} className="axis" x={x(v)} y={h + 18} textAnchor="middle">{xLabel(v)}</text>
              ))}

              {series.map((s) => <path key={`b${s.label}`} d={bands(s.points)} fill={s.color} opacity={0.12} />)}
              {series.map((s) => (
                <path key={`l${s.label}`} d={path(s.points)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {/* a dot on every point, so a line of one point still shows */}
              {series.map((s) => s.points.map((p, i) => p && (
                <circle key={`d${s.label}${i}`} cx={x(xs[i])} cy={y(p.y)} r={hover === i ? 4 : 2.5} fill={s.color} />
              )))}

              {hover != null && <line className="crosshair" x1={x(xs[hover])} x2={x(xs[hover])} y1={0} y2={h} />}

              <rect
                width={w}
                height={h}
                fill="transparent"
                onPointerMove={onMove}
                onPointerLeave={() => {
                  setHover(null);
                  tip.hide();
                }}
              />
            </g>
          </svg>
        )}
      </div>
      {tip.node}
    </div>
  );
}
