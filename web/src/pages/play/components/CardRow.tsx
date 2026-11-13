import type { CSSProperties } from "react";
import { Card } from "../../../components/Card";
import { CARD_BY_ID, type CardId } from "../../../components/cardData";
import "./CardRow.css";

type Props = {
  cards: (CardId | null)[]; // null = face down
  width: string;
  overlap?: number; // 0 = side by side, 0.6 = each card covers 60% of the previous
  className?: string;
  onPick?: (index: number) => void; // makes the cards clickable
  pickable?: boolean[]; // per card; missing = pickable
};

export function CardRow({ cards, width, overlap = 0, className = "", onPick, pickable }: Props) {
  const style = { "--card-w": width, "--overlap": overlap } as CSSProperties;

  return (
    <div className={`card-row ${className}`} style={style}>
      {cards.map((id, i) => {
        const card = <Card key={i} id={id ?? undefined} faceDown={id === null} width={width} />;
        if (!onPick) return card;

        const enabled = pickable?.[i] ?? true;
        return (
          <button
            key={i}
            type="button"
            className="card-pick"
            disabled={!enabled}
            onClick={() => onPick(i)}
            aria-label={id ? `Play the ${CARD_BY_ID[id].name}` : "Play this card"}
          >
            {card}
          </button>
        );
      })}
    </div>
  );
}
