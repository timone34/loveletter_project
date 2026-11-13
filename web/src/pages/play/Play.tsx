import { Header, Footer } from "../../components/Header";
import { CARD_BY_ID } from "../../components/cardData";

import { PlayerSeat } from "./components/PlayerSeat";
import { DeckPile } from "./components/DeckPile";
import { TablePanel } from "./components/TablePanel";
import { useGame } from "./useGame";
import "./Play.css";


export default function Play() {
  const game = useGame();
  const { table, prompt, status } = game;

  const you = table?.players[table.youSeat];
  const opponents = table
    ? [
        ...table.players.slice(table.youSeat + 1),
        ...table.players.slice(0, table.youSeat),
      ]
    : [];
  const cardPrompt = prompt?.kind === "card" ? prompt : null;
  const winsNeeded = table?.winsNeeded ?? 3;


  return (
    <div className="page">
      <Header />

      <main className="play">

        <section className="table">
          <header className="table__header">
            <div>
              <p className="table__eyebrow">
                {table && table.round > 0
                  ? `Round ${table.round} • ${table.players.length} Players`
                  : "4 Players"}
              </p>
              <h1 className="table__title">The Royal Court</h1>
            </div>

            <div className="table__aside">
              {table && (
                <div className="table__chips">
                  <span className="chip">Dealer · {table.players[table.dealer].name}</span>
                  <span className="chip">First to {table.winsNeeded}</span>
                  {table.burn && <span className="chip">Burned · {CARD_BY_ID[table.burn].name}</span>}
                </div>
              )}

              <div className="controls">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={game.newGame}
                  disabled={!status.connected}
                >
                  New game
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={game.togglePause}
                  disabled={!status.connected || !status.running}
                >
                  {status.paused ? "Resume" : "Pause"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={game.toggleReveal}
                  disabled={!status.connected}
                  aria-pressed={status.reveal}
                >
                  Reveal hands
                </button>
              </div>
            </div>
          </header>

          
          <div className="felt">
            <div className="opponents">
              {opponents.map((p) => (
                <PlayerSeat key={p.seat} player={p} winsNeeded={winsNeeded} />
              ))}
            </div>

            <div className="deck-area">
              <p className="deck-area__caption" aria-live="polite">{game.caption}</p>
              {table ? <DeckPile count={table.deckCount} /> : <span />}
              <TablePanel
                table={table}
                prompt={prompt}
                status={status}
                winner={game.winner}
                error={game.error}
                onChoose={game.choose}
                onNewGame={game.newGame}
                onResume={game.togglePause}
                onReconnect={game.reconnect}
              />
            </div>

            {you && (
              <PlayerSeat
                player={you}
                winsNeeded={winsNeeded}
                variant="you"
                onPickCard={cardPrompt ? game.choose : undefined}
                pickable={cardPrompt?.playable}
              />
            )}
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
