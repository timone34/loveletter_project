import { useEffect, useRef } from "react";
import { isLogged, type FeedEntry } from "../useGame";
import type { TableView } from "../types";
import { seatColor } from "../seatColor";
import "./ActionLog.css";

type Props = {
  feed: FeedEntry[];
  viewing: number | null; // index into feed being looked at; null = live
  table: TableView | null; // the table on screen (live or the one being looked at)
  onSelect: (index: number | null) => void;
};

// The action log: one line per turn, grouped by round. Click a line (or use
// the arrow keys, see Play.tsx) to see the table as it was right after it.
export function ActionLog({ feed, viewing, table, onSelect }: Props) {
  const list = useRef<HTMLOListElement>(null);

  // follow the newest line while live; keep the selected line in view while browsing
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    if (viewing === null) el.scrollTop = el.scrollHeight;
    else el.querySelector<HTMLElement>("[aria-current=true]")?.scrollIntoView({ block: "nearest" });
  }, [feed.length, viewing]);

  const you = table?.youSeat ?? null;
  const name = (seat: number) => (seat === you ? "You" : table?.players[seat]?.name ?? `Seat ${seat + 1}`);

  return (
    <aside className="log" aria-label="Action log">
      <div className="log__header">
        <h2 className="log__title">Action log</h2>
        {viewing === null ? (
          <span className="log__live">Live</span>
        ) : (
          <button type="button" className="log__back" onClick={() => onSelect(null)} title="Back to the live game (End)">
            Back to live
          </button>
        )}
      </div>

      {/* who's who; struck through = rejected this round (on the table on screen) */}
      {table && (
        <ul className="log__players">
          {table.players.map((p) => (
            <li key={p.seat} className={p.rejected ? "log__player log__player--out" : "log__player"}>
              <span className="log__dot" style={{ background: seatColor(p.seat) }} />
              {p.seat === you && p.name !== "You" ? `${p.name} (you)` : p.name}
            </li>
          ))}
        </ul>
      )}

      <ol className="log__list" ref={list}>
        {feed.length === 0 && <li className="log__empty">The log fills in as the game is played.</li>}
        {feed.map((entry, i) => {
          if (!isLogged(entry)) return null;
          const e = entry.event;

          if (e.type === "round_start") {
            return (
              <li key={entry.seq} className="log__round">
                <button type="button" onClick={() => onSelect(i)} aria-current={viewing === i}>
                  Round {e.number}
                </button>
              </li>
            );
          }

          const seat = e.type === "turn_end" || e.type === "turn_skipped" ? e.seat : null;
          const rejected = e.type === "turn_end" ? e.rejected : [];
          const classes = [
            "log__entry",
            e.type === "turn_skipped" && "log__entry--skipped",
            (e.type === "round_end" || e.type === "game_end" || e.type === "showdown") && "log__entry--result",
          ].filter(Boolean).join(" ");

          return (
            <li key={entry.seq}>
              <button type="button" className={classes} onClick={() => onSelect(i)} aria-current={viewing === i}>
                <span className="log__dot" style={seat !== null ? { background: seatColor(seat) } : undefined} />
                <span className="log__line">
                  {"lln" in e && e.lln && <code className="log__lln">{e.lln}</code>}
                  {rejected.map((r) => (
                    <span key={r} className="log__out" style={{ borderColor: seatColor(r) }}>
                      {name(r)} out
                    </span>
                  ))}
                </span>
                <span className="log__text">{entry.caption}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="log__hint">← → step through turns · End = live</p>
    </aside>
  );
}
