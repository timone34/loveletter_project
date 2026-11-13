import type { CSSProperties } from "react";
import { Card } from "../../../components/Card";
import type { CardId } from "../../../components/cardData";
import "./CardRow.css";

type Props = {
  cards: (CardId | null)[]; // null = face down
  width: string;
  overlap?: number; // 0 = side by side, 0.6 = each card covers 60% of the previous
  className?: string;
};

export function CardRow({ cards, width, overlap = 0, className = "" }: Props) {
  const style = { "--card-w": width, "--overlap": overlap } as CSSProperties;

  return (
    <div className={`card-row ${className}`} style={style}>
      {cards.map((id, i) => (
        <Card key={i} id={id ?? undefined} faceDown={id === null} width={width} />
      ))}
    </div>
  );
}