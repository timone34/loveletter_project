import { Card } from "../../../components/Card";
import "./DrawPile.css";

export default function DrawPile() {
  return (
    <div className="deck">
      <span className="deck__label">Draw pile</span>
      <div className="deck__cards" aria-label="Four cards in the draw pile">
        <Card
          faceDown
          width="clamp(56px, min(9vw, 6svh), 116px)"
          className="deck__card deck__card--back"
        />
        <Card
          faceDown
          width="clamp(56px, min(9vw, 6svh), 116px)"
          className="deck__card deck__card--top"
        />
      </div>
      <span className="deck__count">4 cards left</span>
    </div>
  );
}
