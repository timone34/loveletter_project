import { useState } from "react";
import { Segmented } from "../../../components/Field";
import { GAME_CARDS } from "../../../components/cardData";
import { count, pct } from "../../../sims/format";
import type { Line } from "../../../sims/types";
import { useTooltip } from "./hooks";
import { TipRow } from "./TipRow";
import { EMPTY, blue, diverging } from "./ramps";

// Which card a player plays from each pair of cards held. One 8x8 grid for one
// player at a time: the cell in row R, column C is about holding R and C.
//   "Played"         how often R was played (rather than C). Row R and row C
//                    of the same pair add up to 100%.
//   "Won the round"  how often the round was won after playing R from that
//                    pair, shaded against the player's overall round win rate:
//                    blue = better than usual, red = worse. Read along a column
//                    to see the best card to play with C in hand.
// The diagonal is holding two of the same card (no real choice).

type Row = { label: string; color: string; line: Line };
type Mode = "played" | "won";

const CARDS = GAME_CARDS.map((c) => c.name);

export function CardChoices({ rows }: { rows: Row[] }) {
  const tip = useTooltip();
  const [picked, setPicked] = useState(0);
  const [mode, setMode] = useState<Mode>("played");
  const row = rows[Math.min(picked, rows.length - 1)];
  if (!row) return null;

  // "a|b|played" -> { n, wins }, with a/b in card-value order like the server sends them
  const byKey = new Map(row.line.choices.map((c) => [`${c.a}|${c.b}|${c.played}`, c]));
  const order = (r: string, c: string) => (CARDS.indexOf(r) <= CARDS.indexOf(c) ? [r, c] : [c, r]);
  const get = (r: string, c: string, played: string) => {
    const [a, b] = order(r, c);
    return byKey.get(`${a}|${b}|${played}`) ?? { n: 0, wins: 0 };
  };
  const held = (r: string, c: string) => (r === c ? get(r, c, r).n : get(r, c, r).n + get(r, c, c).n);

  const usual = row.line.roundWinRate?.p ?? 0.25;
  const maxDiff = Math.max(
    0.05,
    ...CARDS.flatMap((r) => CARDS.map((c) => {
      const x = get(r, c, r);
      return x.n >= 20 ? Math.abs(x.wins / x.n - usual) : 0; // tiny samples don't set the scale
    })),
  );

  const tipFor = (r: string, c: string) => {
    const total = held(r, c);
    const options = r === c ? [r] : [r, c];
    return (
      <>
        <div className="tip__title">{row.label} holding {r} + {c} · {count(total)} times</div>
        {options.map((p) => {
          const x = get(r, c, p);
          return (
            <TipRow
              key={p}
              value={r === c ? "always" : pct(total ? x.n / total : null, 0)}
              label={`played ${p} → won the round ${x.n ? pct(x.wins / x.n, 0) : "–"}${x.n ? ` (${count(x.n)})` : ""}`}
            />
          );
        })}
        <div className="tip__note">Their usual round win rate: {pct(usual, 0)}</div>
      </>
    );
  };

  return (
    <div className="chart choices">
      <div className="choices__controls">
        <Segmented<number>
          label="Player"
          value={Math.min(picked, rows.length - 1)}
          onChange={setPicked}
          options={rows.map((r, i) => ({ value: i, label: r.label }))}
        />
        <Segmented<Mode>
          label="Show"
          value={mode}
          onChange={setMode}
          options={[
            { value: "played", label: "Played" },
            { value: "won", label: "Won the round" },
          ]}
        />
      </div>

      <table className="heat choices__grid">
        <thead>
          <tr>
            <th className="choices__corner">played ↓ · with →</th>
            {CARDS.map((c) => <th key={c}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {CARDS.map((r) => (
            <tr key={r}>
              <th scope="row">{r}</th>
              {CARDS.map((c) => {
                const total = held(r, c);
                const mine = get(r, c, r);
                let text = "–";
                let [bg, ink]: readonly [string, string] = EMPTY;
                if (mode === "played" && total > 0) {
                  const share = r === c ? 1 : mine.n / total;
                  text = r === c ? "=" : pct(share, 0);
                  [bg, ink] = r === c ? ["var(--background)", "var(--text-muted)"] : blue(share, 1);
                } else if (mode === "won" && mine.n > 0) {
                  const rate = mine.wins / mine.n;
                  text = pct(rate, 0);
                  [bg, ink] = diverging(mine.n >= 20 ? rate - usual : 0, maxDiff);
                }
                if (total === 0) return <td key={c} className="heat__empty">–</td>;
                return (
                  <td
                    key={c}
                    className={r === c ? "choices__same" : undefined}
                    style={{ background: bg, color: ink }}
                    tabIndex={0}
                    onPointerMove={(e) => tip.show(e, tipFor(r, c))}
                    onFocus={(e) => tip.show(e, tipFor(r, c))}
                    onPointerLeave={tip.hide}
                    onBlur={tip.hide}
                  >
                    {text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {tip.node}
    </div>
  );
}
