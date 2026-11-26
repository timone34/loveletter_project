import type { CSSProperties } from "react";
import { Card } from "../../../components/Card";
import { CARD_BY_ID, type CardId } from "../../../components/cardData";
import "./DeckPile.css";

type Props = {
  count: number;
  burn: CardId | null; // the burned card, only known with "reveal hands" on
};

const CARD_W = 84; // px, matches the opponents' hands

export function DeckPile({ count, burn }: Props) {
  const layers = Math.min(count, 5); // the stack's thickness, not the real count

  return (
    <div className="deck-pile">
      <div
        className="deck-pile__stack"
        style={{ width: CARD_W, aspectRatio: "7 / 12" }}
        data-slot="deck" /* where drawn cards fly from (motion/plan.ts) */
      >
        {Array.from({ length: layers }, (_, i) => (
          <Card
            key={i}
            faceDown
            width={`${CARD_W}px`}
            className="deck-pile__card"
            style={{ "--i": i } as CSSProperties}
          />
        ))}
      </div>
      <p className="deck-pile__count">
        <strong>{count} cards left</strong>
      </p>
      {/* absolutely positioned, so showing it never moves the deck or the header */}
      {burn && <p className="deck-pile__burn">Burned · {CARD_BY_ID[burn].name}</p>}
    </div>
  );
}