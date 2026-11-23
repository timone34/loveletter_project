import type { ReactNode } from "react";
import { CARD_BY_ID } from "../../../components/cardData";
import type { GameStatus } from "../useGame";
import type { Prompt, TableView } from "../types";
import "./TablePanel.css";

type Props = {
  table: TableView | null;
  prompt: Prompt | null;
  status: GameStatus;
  winner: number | null;
  error: string | null;
  onChoose: (index: number) => void;
  onNewGame: () => void;
  onSettings: () => void;
  opponents: string[]; // names, for the "waiting" text before a game
  onResume: () => void;
  onReconnect: () => void;
};

// The box beside the deck: whatever needs your attention right now.
export function TablePanel(props: Props) {
  const { table, prompt, status, winner, error } = props;

  if (!status.connected) {
    return (
      <Panel title="Can't reach the game server">
        <p className="panel__text">
          Start it from the project root with <code className="panel__code">uvicorn server:app --port 8000</code>,
          then try again.
        </p>
        <div className="panel__options">
          <button type="button" className="panel__option" onClick={props.onReconnect}>Try again</button>
        </div>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel title="Something went wrong">
        <p className="panel__text">{error}</p>
        <div className="panel__options">
          <button type="button" className="panel__option" onClick={props.onNewGame}>New game</button>
          <button type="button" className="panel__option" onClick={props.onSettings}>Table settings</button>
        </div>
      </Panel>
    );
  }

  if (prompt && table) return <PromptPanel prompt={prompt} table={table} onChoose={props.onChoose} />;

  if (winner !== null && table) {
    const name = winner === table.youSeat ? "You win" : `${table.players[winner].name} wins`;
    return (
      <Panel title={`${name} the game!`}>
        <div className="panel__options">
          <button type="button" className="panel__option" onClick={props.onNewGame}>Play again</button>
        </div>
      </Panel>
    );
  }

  if (!status.running) {
    return (
      <Panel title="Ready when you are">
        <p className="panel__text">{listNames(props.opponents)} are waiting for a fourth.</p>
        <div className="panel__options">
          <button type="button" className="panel__option" onClick={props.onNewGame}>New game</button>
          <button type="button" className="panel__option" onClick={props.onSettings}>Table settings</button>
        </div>
      </Panel>
    );
  }

  if (status.paused) {
    return (
      <Panel title="Paused">
        <div className="panel__options">
          <button type="button" className="panel__option" onClick={props.onResume}>Resume</button>
        </div>
      </Panel>
    );
  }

  return null;
}

function PromptPanel({ prompt, table, onChoose }: { prompt: Prompt; table: TableView; onChoose: (i: number) => void }) {
  switch (prompt.kind) {
    case "card":
      return (
        <Panel title="Your move">
          <p className="panel__text">
            {prompt.forced
              ? "You hold the Countess with a King or Prince, so the Countess must be played."
              : "Click a card in your hand to play it."}
          </p>
        </Panel>
      );

    case "target":
      return (
        <Panel title={`Who gets your ${CARD_BY_ID[prompt.card].name}?`}>
          <div className="panel__options">
            {prompt.options.map((seat, i) => {
              const p = table.players[seat];
              return (
                <button key={seat} type="button" className="panel__option" onClick={() => onChoose(i)}>
                  {seat === table.youSeat ? "Yourself" : p.name}
                  {p.protected && <small>protected</small>}
                </button>
              );
            })}
          </div>
        </Panel>
      );

    case "guess": {
      const target = table.players[prompt.target].name;
      return (
        <Panel title={`What is ${target} holding?`}>
          <div className="panel__options">
            {prompt.options.map((id, i) => (
              <button key={id} type="button" className="panel__option" onClick={() => onChoose(i)}>
                {CARD_BY_ID[id].name}
                <small>{CARD_BY_ID[id].value}</small>
              </button>
            ))}
          </div>
        </Panel>
      );
    }
  }
}

// ["Alice", "Bob", "Charlie"] -> "Alice, Bob and Charlie"
function listNames(names: string[]): string {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function Panel({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="panel" role="region" aria-label={title}>
      <h2 className="panel__title">{title}</h2>
      {children}
    </div>
  );
}
