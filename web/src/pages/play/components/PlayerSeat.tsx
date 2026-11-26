import type { CSSProperties } from "react";
import { CARD_BY_ID } from "../../../components/cardData";
import { Heart } from "../../../components/Heart";
import { Shield } from "../../../components/Shield";
import { initial } from "../../../components/initial";
import type { PlayerView } from "../types";
import { CardRow } from "./CardRow";
import { seatColor } from "../seatColor";
import "./PlayerSeat.css";

type Props = {
  player: PlayerView;
  winsNeeded: number;
  variant?: "opponent" | "you";
  onPickCard?: (index: number) => void; // set while you're choosing a card
  pickable?: boolean[];
  onTarget?: () => void; // set while you're choosing a target and this seat is one
};

// Above this many round wins needed, hearts show as "♥ 2/7" instead of a row of hearts.
const MAX_HEART_ROW = 5;

// The one place to tune card sizes (desktop only, so plain pixels).
const SIZES = {
  opponent: { hand: "84px", discard: "70px" },
  you: { hand: "130px", discard: "100px" },
};

export function PlayerSeat({ player, winsNeeded, variant = "opponent", onPickCard, pickable, onTarget }: Props) {
  const size = SIZES[variant];
  const overlap = variant === "you" ? -0.05 : 0.6;

  const discardTotal = player.discards.reduce((sum, id) => sum + CARD_BY_ID[id].value, 0)
  const classes = [
    "seat",
    `seat--${variant}`,
    player.active && "seat--active",
    player.rejected && "seat--rejected",
    onTarget && "seat--targetable",
  ]
    .filter(Boolean)
    .join(" ");
  
  return (
    // data-seat: where badges like "Rejected" pop up (motion/FlightLayer.tsx).
    // While targeting, the whole seat is a button (the panel's buttons work too).
    <div
      className={classes}
      data-seat={player.seat}
      style={{ "--seat-color": seatColor(player.seat) } as CSSProperties}
      onClick={onTarget}
      role={onTarget ? "button" : undefined}
      tabIndex={onTarget ? 0 : undefined}
      aria-label={onTarget ? `Target ${player.name}` : undefined}
      onKeyDown={onTarget ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onTarget()) : undefined}
    >
      <div className="seat__identity">
        <div className="seat__avatar" aria-hidden="true">{initial(player.name)}</div>
        <span className="seat__who">
          <strong className="seat__name">{player.name}</strong>
          <small className="seat__detail">{player.strategy}</small>
        </span>

        <div className="seat__meta">
          {/* status as small icons; hover for the word. "Rejected" is shown in the hand slot */}
          {player.active && (
            <span className="seat__status seat__status--active" title="Playing" role="img" aria-label="Playing" />
          )}
          {player.protected && (
            <span className="seat__status" title="Protected" role="img" aria-label="Protected">
              <Shield />
            </span>
          )}

          <span className="seat__wins" role="img" aria-label={`${player.roundWins} of ${winsNeeded} round wins`}>
            {winsNeeded > MAX_HEART_ROW ? (
              <>
                <Heart className="seat__heart seat__heart--won" />
                <span className="seat__wins-count">{player.roundWins}/{winsNeeded}</span>
              </>
            ) : (
              Array.from({ length: winsNeeded }, (_, i) => (
                <Heart
                  key={i}
                  filled={i < player.roundWins}
                  className={i < player.roundWins ? "seat__heart seat__heart--won" : "seat__heart"}
                />
              ))
            )}
          </span>
        </div>
      </div>

      <div className="seat__cards">
        {player.rejected ? (
          // same size as the hand, so nothing moves
          <div className="seat__hand seat__rejected" style={{ "--card-w": size.hand, "--overlap": overlap } as CSSProperties}>
            Rejected
          </div>
        ) : (
          <CardRow
            cards={player.hand}
            width={size.hand}
            overlap={overlap}
            className="seat__hand"
            slot={`s${player.seat}-h`}
            onPick={onPickCard}
            pickable={pickable}
          />
        )}
        <div className="seat__discards" style={{ "--hand-card-w": size.hand } as CSSProperties}>
          <p  className="seat__label">Discards · {discardTotal} Total</p>
          <div className="seat__pile">
            <CardRow cards={player.discards} width={size.discard} overlap={0.6} fit slot={`s${player.seat}-d`} />
          </div>
        </div>
      </div>
    </div>
  );
}
