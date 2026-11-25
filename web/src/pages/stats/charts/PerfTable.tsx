import { count, pct, secs } from "../../../sims/format";
import type { Line } from "../../../sims/types";

// Think time per turn, one row per player (or bot, or seat): the numbers
// behind the Performance charts. Median and p95 are read from log buckets
// (accurate to ~12%); mean, max and totals are exact. The share bar is each
// row's part of all the bots' thinking in the run.
// Styles: .numbers in Stats.css, .perf-share in charts.css.

export function PerfTable({ rows }: { rows: { label: string; color: string; line: Line }[] }) {
  const all = rows.reduce((s, r) => s + (r.line.think?.turn.total ?? 0), 0);
  return (
    <div className="numbers-wrap">
      <table className="numbers">
        <thead>
          <tr>
            <th />
            <th>Turns</th>
            <th title="Mean think time per turn, with its 95% interval">Mean (95%)</th>
            <th>Median</th>
            <th title="95% of turns took less than this">p95</th>
            <th>Slowest</th>
            <th>Total</th>
            <th>Share of bot time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, color, line }) => {
            const t = line.think?.turn;
            const share = t && all ? t.total / all : null;
            return (
              <tr key={label}>
                <th scope="row"><span className="swatch" style={{ background: color }} />{label}</th>
                <td>{t ? count(t.n) : "–"}</td>
                <td>{t ? `${secs(t.mean)} (${secs(t.lo)}–${secs(t.hi)})` : "–"}</td>
                <td>{secs(t?.median)}</td>
                <td>{secs(t?.p95)}</td>
                <td>{secs(t?.max)}</td>
                <td>{secs(t?.total)}</td>
                <td>
                  <span className="perf-share">
                    <span className="perf-share__track">
                      <span className="perf-share__bar" style={{ width: `${(share ?? 0) * 100}%`, background: color }} />
                    </span>
                    <span>{pct(share)}</span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
