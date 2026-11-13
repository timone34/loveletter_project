import { Header, Footer } from "../../components/Header";

import { PlayerSeat } from "./components/PlayerSeat";
import { DeckPile } from "./components/DeckPile";
import { SAMPLE_TABLE } from "./sampleTable";
import "./Play.css";


export default function Play() {
  const table = SAMPLE_TABLE;
  const you = table.players[table.youSeat];
  const opponents = [
    ...table.players.slice(table.youSeat + 1),
    ...table.players.slice(0, table.youSeat),
  ];


  return (
    <div className="page">
      <Header />

      <main className="play">

        <section className="table">
          <header className="table__header">
            <div>
              <p className="table__eyebrow">
                Round {table.round} • {table.players.length} Players
              </p>
              <h1 className="table__title">The Royal Court</h1>
            </div>
            <div className="table__chips">
              <span className="chip">Dealer · {table.players[table.dealer].name}</span>
              <span className="chip">First to {table.winsNeeded}</span>
            </div>
          </header>

          
          <div className="felt">
            <div className="opponents">
              {opponents.map((p) => (
                <PlayerSeat key={p.seat} player={p} winsNeeded={table.winsNeeded} />
              ))}
            </div>

            <div className="deck-area">
              <DeckPile count={table.deckCount} />
            </div>

            <PlayerSeat player={you} winsNeeded={table.winsNeeded} variant="you" />
          </div>
        </section>

        <aside className="log">
          <div className="log__header">
            <h2 className="log__title">Action log</h2>
          </div>
        </aside>

      </main>

      <Footer />
    </div>
  );
}