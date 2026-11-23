import { useState } from "react";
import { Segmented } from "../../../components/Field";
import { count, pct } from "../../../sims/format";
import { CAUSE_LABELS } from "../../../sims/causes";
import { CAUSES, type Cause, type Line } from "../../../sims/types";
import { useTooltip } from "./hooks";
import { TipRow } from "./TipRow";
import { blue } from "./ramps";

// How each player lost their rounds: a table with one row per player and one
// column per cause, every cell shaded on one blue scale (darker = more). The
// shading is shared by the whole table, so cells compare across players too.



type Mode = "lost" | "all" | "count";

export function LossTable({ rows }: { rows: { label: string; color: string; line: Line }[] }) {
  const tip = useTooltip();
  const [mode, setMode] = useState<Mode>("lost");

  const lostOf = (l: Line) => l.rounds - l.roundWins;
  const value = (l: Line, c: Cause) => {
    const n = l.losses[c];
    if (mode === "count") return n;
    const of = mode === "lost" ? lostOf(l) : l.rounds;
    return of ? n / of : 0;
  };
  const show = (v: number) => (mode === "count" ? count(v) : pct(v));
  const max = Math.max(1e-9, ...rows.flatMap((r) => CAUSES.map((c) => value(r.line, c))));
  const shade = (v: number) => blue(v, max);

  return (
    <div className="chart">
      <div className="heat__controls">
        <Segmented<Mode>
          label="Show"
          value={mode}
          onChange={setMode}
          options={[
            { value: "lost", label: "% of rounds lost" },
            { value: "all", label: "% of all rounds" },
            { value: "count", label: "Count" },
          ]}
        />
      </div>
      <table className="heat">
        <thead>
          <tr>
            <th />
            {CAUSES.map((c) => <th key={c} title={CAUSE_LABELS[c].note}>{CAUSE_LABELS[c].label}</th>)}
            <th className="heat__total">Rounds lost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, color, line }) => (
            <tr key={label}>
              <th scope="row">
                <span className="swatch" style={{ background: color }} />
                {label}
              </th>
              {CAUSES.map((c) => {
                const v = value(line, c);
                const [bg, ink] = shade(v);
                const content = (
                  <>
                    <TipRow value={count(line.losses[c])} label={`rounds · ${label}`} />
                    <div className="tip__note">{CAUSE_LABELS[c].label}: {CAUSE_LABELS[c].note}</div>
                    <div className="tip__note">
                      {pct(lostOf(line) ? line.losses[c] / lostOf(line) : 0)} of rounds lost · {pct(line.losses[c] / line.rounds)} of all rounds
                    </div>
                  </>
                );
                return (
                  <td
                    key={c}
                    style={{ background: bg, color: ink }}
                    tabIndex={0}
                    onPointerMove={(e) => tip.show(e, content)}
                    onFocus={(e) => tip.show(e, content)}
                    onPointerLeave={tip.hide}
                    onBlur={tip.hide}
                  >
                    {show(v)}
                  </td>
                );
              })}
              <td className="heat__total">
                {count(lostOf(line))} <span>/ {count(line.rounds)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {tip.node}
    </div>
  );
}
