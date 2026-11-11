import { Card } from "../../../components/Card";
import "./PlayerHand.css";

export default function PlayerHand() {
  return (
    <div className="player-area">
      <div className="player-area__label">
        <div>
          <p className="eyebrow">Your hand</p>
          <strong>Choose a card to play</strong>
        </div>
        <span className="player-area__token">✦ &nbsp;2 tokens</span>
      </div>

      <div className="player-hand" aria-label="Your two revealed cards">
        <Card
          id="countess"
          width="clamp(96px, min(15vw, 14svh), 190px)"
          className="player-hand__card"
        />
        <Card
          id="prince"
          width="clamp(96px, min(15vw, 14svh), 190px)"
          className="player-hand__card"
        />
      </div>
    </div>
  );
}
