import DrawPile from "./components/DrawPile";
import OpponentSeat from "./components/OpponentSeat";
import PlayerHand from "./components/PlayerHand";
import { OPPONENTS } from "./data";
import "./Table.css";

export default function PlayTable() {
  return (
    <section className="game-table" aria-label="Love Letter game table">
      <div className="table-heading">
        <div>
          <p className="eyebrow">Round 2 · 4 players</p>
          <h1>The Royal Court</h1>
        </div>
        <div className="turn-indicator">
          <span className="turn-indicator__dot" />
          Your turn
        </div>
      </div>

      <div className="felt">
        <div className="felt__inner">
          <div className="opponent-arc" aria-label="Opponents">
            {OPPONENTS.map((opponent) => (
              <OpponentSeat key={opponent.name} opponent={opponent} />
            ))}
          </div>

          <div className="table-center">
            <DrawPile />
            <div className="round-seal" aria-hidden="true">
              <span>♡</span>
              <small>COURT</small>
            </div>
          </div>

          <PlayerHand />
        </div>
      </div>
    </section>
  );
}
