import type { ReactNode } from "react";
import type { Line } from "../../../sims/types";
import { useTooltip } from "./hooks";

// A table with one row per player (or bot, or seat) and one column per card,
// every cell shaded. What a cell shows is up to the caller: `cell` returns its
// text, colours and tooltip, or null for "nothing to show" (an empty cell).
// Styles: .heat in charts.css (shared with the cause-of-rejection table).

export type HeatCell = { text: string; bg: string; ink: string; tip: ReactNode };
export type HeatRow = { label: string; color: string; line: Line };

export function HeatTable({ rows, columns, cell, extra }: {
  rows: HeatRow[];
  columns: { key: string; label: string; title?: string }[];
  cell: (row: HeatRow, column: string) => HeatCell | null;
  extra?: { label: string; value: (row: HeatRow) => ReactNode }; // a last, unshaded column
}) {
  const tip = useTooltip();

  return (
    <div className="chart">
      <table className="heat">
        <thead>
          <tr>
            <th />
            {columns.map((c) => <th key={c.key} title={c.title}>{c.label}</th>)}
            {extra && <th className="heat__total">{extra.label}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">
                <span className="swatch" style={{ background: row.color }} />
                {row.label}
              </th>
              {columns.map((c) => {
                const content = cell(row, c.key);
                if (!content) return <td key={c.key} className="heat__empty">–</td>;
                return (
                  <td
                    key={c.key}
                    style={{ background: content.bg, color: content.ink }}
                    tabIndex={0}
                    onPointerMove={(e) => tip.show(e, content.tip)}
                    onFocus={(e) => tip.show(e, content.tip)}
                    onPointerLeave={tip.hide}
                    onBlur={tip.hide}
                  >
                    {content.text}
                  </td>
                );
              })}
              {extra && <td className="heat__total">{extra.value(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {tip.node}
    </div>
  );
}
