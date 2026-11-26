import { useState } from "react";
import { CARD_BY_ID, GAME_CARDS, type GameCardId } from "../../../components/cardData";
import type { TableView } from "../types";
import "./CheatSheet.css";

type Props = {
  table: TableView | null;
  onClose: () => void;
};

// The eight cards with what they do, and per card how many copies you
// haven't seen yet: still in the deck, burned, or in a hand you can't see.
// "Seen" = face up somewhere on the table you're looking at (discards,
// your own hand, every hand at a showdown or with "reveal hands" on).
// The counting is off until you switch it on (it gives away the likeliest
// Guard guess); the choice is remembered in this browser.
const COUNT_KEY = "loveletter.cheatCount";

export function CheatSheet({ table, onClose }: Props) {
  const [counting, setCounting] = useState(() => {
    try {
      return localStorage.getItem(COUNT_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggleCounting = () => {
    setCounting(!counting);
    try {
      localStorage.setItem(COUNT_KEY, counting ? "0" : "1");
    } catch {
      // not remembered; it still switches
    }
  };
  const seen = table && counting ? seenCounts(table) : null;

  return (
    <aside className="cheat" aria-label="Cheat sheet">
      <header className="cheat__header">
        <h2 className="cheat__title">Cards</h2>
        <button type="button" className="cheat__close" onClick={onClose} aria-label="Close the cheat sheet (C)" title="Close (C)">
          ×
        </button>
      </header>

      <div className="cheat__legend">
        <button
          type="button"
          className="cheat__toggle"
          role="switch"
          aria-checked={counting}
          onClick={toggleCounting}
          title="Count the copies you haven't seen: in the deck, burned, or in a hand you can't see"
        >
          <span className="cheat__switch" aria-hidden="true" />
          Count unseen
        </button>
        <span>{counting ? "Unseen / total" : "In the deck"}</span>
      </div>

      <ol className="cheat__list">
        {[...GAME_CARDS].reverse().map((card) => {
          const unseen = card.copies - (seen?.[card.id as GameCardId] ?? 0);
          return (
            <li key={card.id} className={`cheat__card ${seen && unseen === 0 ? "cheat__card--gone" : ""}`}>
              <span className="cheat__value">{card.value}</span>
              <div className="cheat__body">
                <div className="cheat__head">
                  <strong className="cheat__name">{card.name}</strong>
                  <span className="cheat__count" title={`${unseen} of ${card.copies} not seen yet`}>
                    {seen ? <><b>{unseen}</b>/{card.copies}</> : <>×{card.copies}</>}
                  </span>
                </div>
                <p className="cheat__text">{card.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function seenCounts(table: TableView): Partial<Record<GameCardId, number>> {
  const counts: Partial<Record<GameCardId, number>> = {};
  const add = (id: string | null | undefined) => {
    if (id && id in CARD_BY_ID) counts[id as GameCardId] = (counts[id as GameCardId] ?? 0) + 1;
  };
  for (const p of table.players) {
    p.hand.forEach(add);
    p.discards.forEach(add);
  }
  add(table.burn);
  return counts;
}
