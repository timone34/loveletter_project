import { count, pct } from "../../../sims/format";
import { niceStep } from "./scale";
import { useTooltip, useWidth } from "./hooks";
import { TipRow } from "./TipRow";

// Columns for "how many games lasted k rounds". One series, so no legend:
// the card title says what's plotted. Only the most common length is labelled;
// hover any column for its numbers.

const HEIGHT = 200;
const M = { top: 18, right: 8, bottom: 28, left: 44 };

export function Histogram({ data, unit }: { data: [number, number][]; unit: string }) {
  const { ref: sizeRef, width } = useWidth<HTMLDivElement>();
  const tip = useTooltip();
  if (!data.length) return null;

  // every length between the shortest and longest game gets a slot, even if empty
  const lo = data[0][0];
  const hi = data[data.length - 1][0];
  const byK = new Map(data);
  const slots = Array.from({ length: hi - lo + 1 }, (_, i) => [lo + i, byK.get(lo + i) ?? 0] as const);
  const total = data.reduce((s, [, n]) => s + n, 0);
  const peak = Math.max(...slots.map(([, n]) => n));
  const mode = slots.find(([, n]) => n === peak)![0];

  const w = Math.max(0, width - M.left - M.right);
  const h = HEIGHT - M.top - M.bottom;
  const band = w / slots.length;
  const barW = Math.min(24, band * 0.7);
  const step = niceStep(peak, 4);
  const top = Math.ceil(peak / step) * step;
  const y = (v: number) => h - (v / top) * h;
  const yTicks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const labelEvery = Math.ceil(28 / band); // skip x labels when columns get narrow

  return (
    <div className="chart">
      <div ref={sizeRef}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label={`Number of games by ${unit}`}>
            <g transform={`translate(${M.left},${M.top})`}>
              {yTicks.map((v) => (
                <g key={v}>
                  <line className="grid" x1={0} x2={w} y1={y(v)} y2={y(v)} />
                  <text className="axis" x={-8} y={y(v)} dy="0.32em" textAnchor="end">{count(v)}</text>
                </g>
              ))}
              {slots.map(([k, n], i) => {
                const cx = band * i + band / 2;
                const content = <TipRow value={`${count(n)} games`} label={`${k} ${unit} · ${pct(n / total)}`} />;
                return (
                  <g key={k}>
                    {n > 0 && <path d={column(cx - barW / 2, y(n), barW, h - y(n))} className="column" />}
                    {k === mode && <text className="value-label" x={cx} y={y(n) - 6} textAnchor="middle">{pct(n / total, 0)}</text>}
                    {(k - lo) % labelEvery === 0 && <text className="axis" x={cx} y={h + 18} textAnchor="middle">{k}</text>}
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
            </g>
          </svg>
        )}
      </div>
      {tip.node}
    </div>
  );
}

// a column with a 4px rounded top, square at the baseline
function column(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
