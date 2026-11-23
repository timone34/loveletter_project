import { useState } from "react";
import { Segmented } from "../../../components/Field";
import { count, pct } from "../../../sims/format";
import { CAUSE_LABELS } from "../../../sims/causes";
import { CAUSES, type Cause, type Line } from "../../../sims/types";
import { useTooltip } from "./hooks";
import { TipRow } from "./TipRow";

// How each player lost their rounds: a table with one row per player and one
// column per cause, every cell shaded on one blue scale (darker = more). The
// shading is shared by the whole table, so cells compare across players too.


// light -> dark steps of one blue, with the text colour that reads on each
const RAMP = [
  ["#eef4fc", "#2a2829"], ["#cde2fb", "#2a2829"], ["#9ec5f4", "#2a2829"], ["#6da7ec", "#2a2829"],
  ["#3987e5", "#fff"], ["#256abf", "#fff"], ["#184f95", "#fff"],
] as const;

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
  const shade = (v: number) => RAMP[Math.min(RAMP.length - 1, Math.floor((v / max) * (RAMP.length - 1) + 0.5))];

  return (
    <div className="chart">
      <div className="loss__controls">
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
      <table className="loss">
        <thead>
          <tr>
            <th />
            {CAUSES.map((c) => <th key={c} title={CAUSE_LABELS[c].note}>{CAUSE_LABELS[c].label}</th>)}
            <th className="loss__total">Rounds lost</th>
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
              <td className="loss__total">
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
