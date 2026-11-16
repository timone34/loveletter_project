import type { CSSProperties } from "react";
import { Card } from "../../../components/Card";
import "./DeckPile.css";

type Props = { count: number };

const CARD_W = "var(--deck-card-w, 54px)";

export function DeckPile({ count }: Props) {
  const layers = Math.min(count, 5); // the stack's thickness, not the real count

  return (
    <div className="deck-pile">
      <div
        className="deck-pile__stack"
        style={{ width: CARD_W, aspectRatio: "7 / 12" }}
      >
        {Array.from({ length: layers }, (_, i) => (
          <Card
            key={i}
            faceDown
            width={CARD_W}
            className="deck-pile__card"
            style={{ "--i": i } as CSSProperties}
          />
        ))}
      </div>
      <p className="deck-pile__count">
        <strong>{count} cards left</strong>
      </p>
    </div>
  );
}