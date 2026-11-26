import type { CSSProperties } from "react";
import { Card } from "../../../components/Card";
import { CARD_BY_ID, type CardId } from "../../../components/cardData";
import "./DeckPile.css";

type Props = {
  count: number;
  inRound: boolean; // a round is being played: the burned card lies beside the deck
  burn: CardId | null; // the burned card, only known with "reveal hands" on
  burnTaken: boolean; // a Prince on an empty deck handed it out
};

const CARD_W = 84; // px, matches the opponents' hands

// The middle of the table: the burned card set aside (left) and the deck (right),
// each with a label under it. data-slot="burn" / "deck" are where the
// animations fly cards from and to (motion/plan.ts).
export function DeckPile({ count, inRound, burn, burnTaken }: Props) {
  const layers = Math.min(count, 5); // the stack's thickness, not the real count
  const burnOnTable = inRound && !burnTaken;
  const box = { width: CARD_W, aspectRatio: "7 / 12" };

  return (
    <div className="deck-piles">
      <div className="deck-pile deck-pile--burn">
        <div className="deck-pile__stack" style={box}>
          {burnOnTable ? (
            <Card id={burn ?? undefined} faceDown={!burn} width={`${CARD_W}px`} className="deck-pile__burned" slot="burn" />
          ) : (
            <div className="deck-pile__empty" />
          )}
        </div>
        <p className="deck-pile__label">
          {burnTaken ? "Burned · drawn" : burn && burnOnTable ? `Burned · ${CARD_BY_ID[burn].name}` : "Burned"}
        </p>
      </div>

      <div className="deck-pile">
        <div className="deck-pile__stack" style={box} data-slot="deck">
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
      </div>
    </div>
  );
}
