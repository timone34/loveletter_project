import type { CardId } from "../../../components/cardData";
import { CardRow } from "./CardRow";
import "./PlayerSeat.css";

type Props = {
  name: string;
  hand: (CardId | null)[];
  discards: CardId[];
  variant?: "opponent" | "you";
  active?: boolean; // whose turn it is
};

// The one place to tune card sizes (desktop only, so plain pixels).
const SIZES = {
  opponent: { hand: "84px", discard: "76px" },
  you: { hand: "126px", discard: "76px" },
};

export function PlayerSeat({ name, hand, discards, variant = "opponent", active = false }: Props) {
  const size = SIZES[variant];

  return (
    <div className={`seat seat--${variant} ${active ? "seat--active" : ""}`}>
      <div className="seat__id">
        <div className="seat__avatar">{name[0]}</div>
        <span className="seat__name">{name}</span>
      </div>

      <div className="seat__cards">
        <CardRow cards={hand} width={size.hand} overlap={0.5}/>
        <div className="seat__discards">
          <CardRow cards={discards} width={size.discard} overlap={0.5} />
        </div>
      </div>
    </div>
  );
}