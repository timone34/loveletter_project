import { useState } from "react";
import { count, pct } from "../../../sims/format";
import type { Rate } from "../../../sims/types";
import { useTooltip, useWidth } from "./hooks";
import { compact, niceStep, niceTicks } from "./scale";
import { TipRow } from "./TipRow";

// Win rate after every k games: shows whether the run was long enough for the
// numbers to settle. Each series is a 2px line with its 95% interval as a
// faint band; the right edge carries name + final value; hovering anywhere
// snaps a crosshair to the nearest snapshot and lists every series there.

export type Series = { label: string; color: string; points: Rate[] }; // points[i] at games[i]

const HEIGHT = 260;
const M = { top: 12, right: 150, bottom: 28, left: 44 }; // margins; right holds the end labels
const LABEL_GAP = 15; // min px between end labels

export function ConvergenceChart({ games, series, reference }: { games: number[]; series: Series[]; reference?: number }) {
  const { ref: sizeRef, width } = useWidth<HTMLDivElement>();
  const tip = useTooltip();
  const [hover, setHover] = useState<number | null>(null);

  const w = Math.max(0, width - M.left - M.right);
  const h = HEIGHT - M.top - M.bottom;
  const n = games.length;

  // y range: ignore the wild first 10% of the run, so the settled part fills the chart
  const skip = Math.min(n - 1, Math.floor(n / 10));
  const settled = series.flatMap((s) => s.points.slice(skip)).filter((r): r is NonNullable<Rate> => r != null);
  let lo = Math.min(...settled.map((r) => r.lo), reference ?? 1);
  let hi = Math.max(...settled.map((r) => r.hi), reference ?? 0);
  const pad = Math.max(0.01, (hi - lo) * 0.08);
  lo = Math.max(0, Math.floor((lo - pad) * 50) / 50);
  hi = Math.min(1, Math.ceil((hi + pad) * 50) / 50);
  if (!(hi > lo)) [lo, hi] = [0, 1];

  const x0 = games[0] ?? 0;
  const x1 = games[n - 1] ?? 1;
  const x = (g: number) => (x1 === x0 ? w : ((g - x0) / (x1 - x0)) * w);
  const y = (v: number) => h - ((v - lo) / (hi - lo)) * h;

  const yStep = niceStep(hi - lo, 5);
  const yTicks: number[] = [];
  for (let v = Math.ceil(lo / yStep) * yStep; v <= hi + 1e-9; v += yStep) yTicks.push(v);
  const xTicks = niceTicks(x0, x1, Math.max(2, Math.floor(w / 110)));

  // end labels: sorted by height, pushed apart, joined to their line by a leader
  const ends = series
    .map((s, i) => ({ i, s, last: s.points[n - 1] }))
    .filter((e) => e.last != null)
    .map((e) => ({ ...e, y: y(e.last!.p), labelY: y(e.last!.p) }))
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) ends[k].labelY = Math.max(ends[k].labelY, ends[k - 1].labelY + LABEL_GAP);
  const overflow = (ends.at(-1)?.labelY ?? 0) - h;
  if (overflow > 0) ends.forEach((e) => (e.labelY -= overflow));

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const g = x0 + ((e.clientX - box.left) / box.width) * (x1 - x0);
    let best = 0;
    games.forEach((v, i) => Math.abs(v - g) < Math.abs(games[best] - g) && (best = i));
    setHover(best);
    const rows = series
      .map((s) => ({ s, r: s.points[best] }))
      .sort((a, b) => (b.r?.p ?? 0) - (a.r?.p ?? 0));
    tip.show(e, (
      <>
        <div className="tip__title">After {count(games[best])} games</div>
        {rows.map(({ s, r }) => <TipRow key={s.label} color={s.color} value={pct(r?.p)} label={s.label} />)}
      </>
    ));
  };

  const path = (pts: Rate[]) =>
    pts.map((r, i) => (r ? `${i && pts[i - 1] ? "L" : "M"}${x(games[i]).toFixed(1)},${y(r.p).toFixed(1)}` : "")).join("");
  const band = (pts: Rate[]) => {
    const idx = pts.map((_, i) => i).filter((i) => pts[i]);
    if (idx.length < 2) return "";
    const top = idx.map((i) => `${x(games[i]).toFixed(1)},${y(pts[i]!.hi).toFixed(1)}`);
    const bottom = idx.reverse().map((i) => `${x(games[i]).toFixed(1)},${y(pts[i]!.lo).toFixed(1)}`);
    return `M${top.join("L")}L${bottom.join("L")}Z`;
  };

  return (
    <div className="chart">
      <div ref={sizeRef}>
        {width > 0 && n > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label="Game win rate as the games came in">
            <defs>
              <clipPath id="conv-clip"><rect width={w} height={h} /></clipPath>
            </defs>
            <g transform={`translate(${M.left},${M.top})`}>
              {yTicks.map((v) => (
                <g key={v}>
                  <line className="grid" x1={0} x2={w} y1={y(v)} y2={y(v)} />
                  <text className="axis" x={-8} y={y(v)} dy="0.32em" textAnchor="end">{pct(v, 0)}</text>
                </g>
              ))}
              {xTicks.map((g) => (
                <text key={g} className="axis" x={x(g)} y={h + 18} textAnchor="middle">{compact(g)}</text>
              ))}
              {reference != null && reference > lo && reference < hi && (
                <>
                  <line className="ref" x1={0} x2={w} y1={y(reference)} y2={y(reference)} />
                  <text className="axis" x={4} y={y(reference) - 5}>fair share</text>
                </>
              )}

              <g clipPath="url(#conv-clip)">
                {series.map((s) => <path key={`b${s.label}`} d={band(s.points)} fill={s.color} opacity={0.1} />)}
                {series.map((s) => (
                  <path key={`l${s.label}`} d={path(s.points)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                ))}
              </g>

              {hover != null && <line className="crosshair" x1={x(games[hover])} x2={x(games[hover])} y1={0} y2={h} />}

              {ends.map((e) => (
                <g key={e.s.label}>
                  <circle cx={w} cy={e.y} r={4} fill={e.s.color} className="ring" />
                  <path className="leader" d={`M${w + 7},${e.y}L${w + 16},${e.labelY}`} />
                  <text className="end-label" x={w + 20} y={e.labelY} dy="0.32em">
                    <tspan className="end-label__value">{pct(e.last!.p)}</tspan> {e.s.label}
                  </text>
                </g>
              ))}

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
