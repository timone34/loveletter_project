import { Header, Footer } from "../../components/Header";

import { PlayerSeat } from "./components/PlayerSeat";
import { DeckPile } from "./components/DeckPile";
import "./Play.css";


export default function Play() {


  return (
    <div className="page">
      <Header />

      <main className="play">

        <section className="table">
          <header className="table__header">
            <div>
              <p className="table__eyebrow">Round 1 • 4 Players</p>
              <h1 className="table__title">The Royal Court</h1>
            </div>
          </header>
          
          <div className="felt">
            <div className="opponents">
              <PlayerSeat name="Alice" hand={[null]} discards={["guard"]} />
              <PlayerSeat name="Bob" hand={[null]} discards={["countess", "handmaid"]} active />
              <PlayerSeat name="Charlie" hand={[null]} discards={["priest", "baron"]} />
            </div>

            <div className="deck-area">
              <DeckPile count={2} />
            </div>

            <PlayerSeat
              name="You"
              variant="you"
              hand={["countess", "prince"]}
              discards={["guard", "guard"]}
            />
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