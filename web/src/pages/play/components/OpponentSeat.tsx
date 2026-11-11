import type { CSSProperties } from "react";
import { Card } from "../../../components/Card";
import type { Opponent } from "../types";
import "./OpponentSeat.css";

type Props = {
  opponent: Opponent;
};

export default function OpponentSeat({ opponent }: Props) {
  return (
    <article className="opponent">
      <div className="opponent__identity">
        <span className="opponent__avatar" aria-hidden="true">
          {opponent.avatar}
        </span>
        <span>
          <strong>{opponent.name}</strong>
          <small>{opponent.detail}</small>
        </span>
      </div>

      <Card
        faceDown
        width="clamp(52px, min(8vw, 6svh), 104px)"
        className="opponent__hidden-card"
        style={{ "--tilt": opponent.tilt } as CSSProperties}
      />

      <div className="opponent__discard">
        <Card
          id={opponent.discard}
          width="clamp(38px, min(5.4vw, 4svh), 68px)"
          className="opponent__discard-card"
        />
        <span>discard</span>
      </div>
    </article>
  );
}
