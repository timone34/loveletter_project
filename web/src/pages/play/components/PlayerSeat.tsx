import type { CSSProperties } from "react";
import { CARD_BY_ID } from "../../../components/cardData";
import type { PlayerView } from "../types";
import { CardRow } from "./CardRow";
import "./PlayerSeat.css";

type Props = {
  player: PlayerView;
  winsNeeded: number;
  variant?: "opponent" | "you";
  onPickCard?: (index: number) => void; // set while you're choosing a card
  pickable?: boolean[];
  onSelectTarget?: () => void;
};

// The one place to tune card sizes (desktop only, so plain pixels).
const SIZES = {
  opponent: { hand: "var(--seat-hand-card-w, 84px)", discard: "var(--seat-discard-card-w, 70px)" },
  you: { hand: "var(--seat-hand-card-w, 130px)", discard: "var(--seat-discard-card-w, 100px)" },
};

export function PlayerSeat({
  player,
  winsNeeded,
  variant = "opponent",
  onPickCard,
  pickable,
  onSelectTarget,
}: Props) {
  const size = SIZES[variant];

  const discardTotal = player.discards.reduce((sum, id) => sum + CARD_BY_ID[id].value, 0)
  const initials = player.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const classes = [
    "seat",
    `seat--${variant}`,
    player.active && "seat--active",
    player.rejected && "seat--rejected",
    onSelectTarget && "seat--targetable",
  ]
    .filter(Boolean)
    .join(" ");
  
  return (
    <div
      className={classes}
      role={onSelectTarget ? "button" : undefined}
      tabIndex={onSelectTarget ? 0 : undefined}
      aria-label={onSelectTarget ? `Target ${player.name}` : undefined}
      onClick={onSelectTarget}
      onKeyDown={onSelectTarget ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectTarget();
        }
      } : undefined}
    >
      <div className="seat__identity">
        <div className="seat__avatar" aria-hidden="true">{initials}</div>
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
              <span key={i} className={i < player.roundWins ? "seat__heart seat__heart--won" : "seat__heart"}>
                ♥
              </span>
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
            <CardRow cards={player.discards} width={size.discard} overlap={0.6} />
          </div>
        </div>
      </div>
    </div>
  );
}
