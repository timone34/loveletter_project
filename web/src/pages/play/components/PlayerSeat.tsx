import type { CSSProperties } from "react";
import { CARD_BY_ID } from "../../../components/cardData";
import { Heart } from "../../../components/Heart";
import { initial } from "../../../components/initial";
import type { PlayerView } from "../types";
import { CardRow } from "./CardRow";
import "./PlayerSeat.css";

type Props = {
  player: PlayerView;
  winsNeeded: number;
  variant?: "opponent" | "you";
  onPickCard?: (index: number) => void; // set while you're choosing a card
  pickable?: boolean[];
};

// The one place to tune card sizes (desktop only, so plain pixels).
const SIZES = {
  opponent: { hand: "84px", discard: "70px" },
  you: { hand: "130px", discard: "100px" },
};

export function PlayerSeat({ player, winsNeeded, variant = "opponent", onPickCard, pickable }: Props) {
  const size = SIZES[variant];

  const discardTotal = player.discards.reduce((sum, id) => sum + CARD_BY_ID[id].value, 0)
  const classes = [
    "seat",
    `seat--${variant}`,
    player.active && "seat--active",
    player.rejected && "seat--rejected",
  ]
    .filter(Boolean)
    .join(" ");
  
  return (
    <div className={classes}>
      <div className="seat__identity">
        <div className="seat__avatar" aria-hidden="true">{initial(player.name)}</div>
        <span className="seat__who">
          <strong className="seat__name">{player.name}</strong>
          <small className="seat__detail">{player.strategy}</small>
        </span>

        <div className="seat__meta">
          {player.active && <span className="seat__pill seat__pill--active">Playing</span>}
          {player.protected && <span className="seat__pill">Protected</span>}
          {player.rejected && <span className="seat__pill seat__pill--rejected">Rejected</span>}

          <span className="seat__wins" aria-label={`${player.roundWins} of ${winsNeeded} round wins`}>
            {Array.from({ length: winsNeeded }, (_, i) => (
              <Heart key={i} filled={i < player.roundWins} className={i < player.roundWins ? "seat__heart seat__heart--won" : "seat__heart"} />
            ))}
          </span>
        </div>
      </div>

      <div className="seat__cards">
        <CardRow
          cards={player.hand}
          width={size.hand}
          overlap={variant === "you" ? -0.05 : 0.6}
          className="seat__hand"
          onPick={onPickCard}
          pickable={pickable}
        />
        <div className="seat__discards" style={{ "--hand-card-w": size.hand } as CSSProperties}>
          <p  className="seat__label">Discards · {discardTotal} Total</p>
          <div className="seat__pile">
            <CardRow cards={player.discards} width={size.discard} overlap={0.6} fit />
          </div>
        </div>
      </div>
    </div>
  );
}
