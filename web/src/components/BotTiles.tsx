import type { BotInfo } from "../pages/play/useBots";
import { initial } from "./initial";
import "./BotTiles.css";

// Seat tiles and the bot library, shared by the Play setup page (/play) and
// the Simulate page (/simulate). A seat tile shows who sits where and lets you
// rename them; clicking it makes it the seat the library fills.

export type SeatedBot = { name: string; bot: string }; // bot = strategy id

export const NAME_LIMIT = 24; // matches the server

export function SeatLabel({ seat }: { seat: number }) {
  return (
    <div className="tile__top">
      <span className="tile__seat">Seat {seat + 1}</span>
      {seat === 0 && <span className="tile__tag">Deals first</span>}
      {seat === 1 && <span className="tile__tag">Starts</span>}
    </div>
  );
}

export function BotTile({ seat, opponent, bot, active, onActivate, onName }: {
  seat: number;
  opponent: SeatedBot;
  bot: BotInfo | undefined;
  active: boolean;
  onActivate: () => void;
  onName: (name: string) => void;
}) {
  return (
    // clicking anywhere on the tile picks it; the button below is the keyboard way in
    <div className={`tile ${active ? "tile--active" : ""}`} onClick={onActivate}>
      <SeatLabel seat={seat} />
      <div className="tile__identity">
        <span className="tile__avatar" aria-hidden="true">{initial(opponent.name)}</span>
        <input
          className="tile__name"
          value={opponent.name}
          maxLength={NAME_LIMIT}
          aria-label={`Name of the player in seat ${seat + 1}`}
          onChange={(e) => onName(e.target.value)}
        />
      </div>
      <div className="tile__foot">
        <span className="tile__bot" title={bot?.description}>{bot?.name ?? opponent.bot}</span>
        <button type="button" className="tile__change" onClick={onActivate} aria-pressed={active}>
          {active ? "Choosing" : "Change"}
        </button>
      </div>
    </div>
  );
}

export function LibraryTile({ bot, selected, seatedAt, onPick }: {
  bot: BotInfo;
  selected: boolean;
  seatedAt: number[];
  onPick: () => void;
}) {
  return (
    <button type="button" className="bot" aria-pressed={selected} onClick={onPick}>
      <span className="bot__head">
        <strong className="bot__name">{bot.name}</strong>
        <code className="bot__id">{bot.id}</code>
      </span>
      <span className="bot__desc">{bot.description}</span>
      <span className="bot__seats">
        {seatedAt.map((s) => <span key={s} className="bot__seat">Seat {s}</span>)}
      </span>
    </button>
  );
}
