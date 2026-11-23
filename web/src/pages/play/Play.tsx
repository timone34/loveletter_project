import { useEffect, useRef, useState, type FormEvent } from "react";
import { Header, Footer } from "../../components/Header";
import { Card } from "../../components/Card";
import { CARD_BY_ID } from "../../components/cardData";

import { PlayerSeat } from "./components/PlayerSeat";
import { DeckPile } from "./components/DeckPile";
import { TablePanel } from "./components/TablePanel";
import { useGame, type GameSetup } from "./useGame";
import "./Play.css";

type BotId = GameSetup["bots"][number];

const BOT_OPTIONS: Record<BotId, { name: string; description: string }> = {
  random: {
    name: "Random Strategy",
    description: "Makes legal choices at random.",
  },
  "no-princess": {
    name: "No Princess",
    description: "Avoids playing the Princess.",
  },
};
const PLAYER_COUNTS = [2, 3, 4];
const ROUND_TARGETS = [1, 3, 5, 7];
const DEFAULT_BOTS: BotId[] = ["no-princess", "random", "random"];
const DEFAULT_BOT_NAMES = ["The Oracle", "The Regent", "The Scribe"];
const DEFAULT_TABLE_NAME = "The Royal Court";

type TableIconName = "new-game" | "pause" | "resume" | "fullscreen" | "setup" | "eye" | "eye-off";

function TableIcon({ name }: { name: TableIconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "new-game" && <><path d="M20 11a8 8 0 1 1-2.34-5.66" /><path d="M20 4v7h-7" /></>}
      {name === "pause" && <><path d="M8 5h3v14H8z" /><path d="M15 5h3v14h-3z" /></>}
      {name === "resume" && <path d="m8 5 11 7-11 7z" />}
      {name === "fullscreen" && <><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /></>}
      {name === "setup" && <><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="8" cy="7" r="2" fill="currentColor" /><circle cx="15" cy="12" r="2" fill="currentColor" /><circle cx="10" cy="17" r="2" fill="currentColor" /></>}
      {(name === "eye" || name === "eye-off") && (
        <>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
          <circle cx="12" cy="12" r="2.5" />
          {name === "eye-off" && <path d="m4 4 16 16" />}
        </>
      )}
    </svg>
  );
}

function TableSetup({
  onStart,
  initialSetup,
}: {
  onStart: (setup: GameSetup) => void;
  initialSetup: GameSetup | null;
}) {
  const [playerCount, setPlayerCount] = useState(() => initialSetup ? initialSetup.bots.length + 1 : 4);
  const [bots, setBots] = useState<BotId[]>(() =>
    DEFAULT_BOTS.map((fallback, index) => initialSetup?.bots[index] ?? fallback),
  );
  const [botNames, setBotNames] = useState(() =>
    DEFAULT_BOT_NAMES.map((fallback, index) => initialSetup?.botNames[index] ?? fallback),
  );
  const [tableName, setTableName] = useState(initialSetup?.tableName ?? DEFAULT_TABLE_NAME);
  const [targetRoundWins, setTargetRoundWins] = useState(initialSetup?.targetRoundWins ?? 3);
  const [revealHands, setRevealHands] = useState(initialSetup?.revealHands ?? false);
  const [revealBurn, setRevealBurn] = useState(initialSetup?.revealBurn ?? false);
  const [deckBackdrop, setDeckBackdrop] = useState<GameSetup["deckBackdrop"]>(
    initialSetup?.deckBackdrop ?? "none",
  );
  const [nameError, setNameError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const activeBotNames = botNames.slice(0, playerCount - 1);
    if (!tableName.trim() || activeBotNames.some((name) => !name.trim())) {
      setNameError("Enter a table name and a name for each bot.");
      return;
    }
    setNameError("");
    onStart({
      bots: bots.slice(0, playerCount - 1),
      botNames: activeBotNames,
      tableName: tableName.trim(),
      targetRoundWins,
      revealHands,
      revealBurn,
      deckBackdrop,
    });
  }

  return (
    <form className="play-setup" onSubmit={submit}>
      <div className="play-setup__layout">
        <div className="play-setup__builder">
          <section className="play-setup__panel" aria-labelledby="play-lineup-title">
            <div className="play-setup__heading">
              <div>
                <p className="play-eyebrow">01 <span>/</span> BOT LINEUP</p>
                <h2 id="play-lineup-title">Choose your opponents</h2>
                <p>Pick the bots who will join you at the table.</p>
              </div>
              <label className="play-setup__field play-setup__field--players">
                <span>Table size</span>
                <select
                  value={playerCount}
                  onChange={(event) => setPlayerCount(Number(event.target.value))}
                >
                  {PLAYER_COUNTS.map((count) => (
                    <option key={count} value={count}>{count} players</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="play-setup__field play-setup__field--table-name">
              <span>Table name</span>
              <input
                type="text"
                value={tableName}
                maxLength={48}
                required
                onChange={(event) => {
                  setTableName(event.target.value);
                  setNameError("");
                }}
              />
            </label>

            <div className="play-bot-list">
              {bots.slice(0, playerCount - 1).map((bot, index) => (
                <div className="play-bot" key={index}>
                  <span className="play-bot__seat">{String(index + 1).padStart(2, "0")}</span>
                  <div className="play-bot__info">
                    <strong>{botNames[index]}</strong>
                    <small>{BOT_OPTIONS[bot].description}</small>
                  </div>
                  <label className="play-bot__name">
                    <span>Bot name</span>
                    <input
                      type="text"
                      value={botNames[index]}
                      maxLength={32}
                      required
                      aria-label={`Name for opponent ${index + 1}`}
                      onChange={(event) => {
                        const name = event.target.value;
                        setBotNames((current) => current.map((item, seat) => seat === index ? name : item));
                        setNameError("");
                      }}
                    />
                  </label>
                  <select
                    className="play-bot__select"
                    aria-label={`Bot for opponent ${index + 1}`}
                    value={bot}
                    onChange={(event) => {
                      const choice: BotId = event.target.value === "no-princess" ? "no-princess" : "random";
                      setBots((current) => current.map((item, seat) => seat === index ? choice : item));
                    }}
                  >
                    {(Object.keys(BOT_OPTIONS) as BotId[]).map((id) => (
                      <option key={id} value={id}>{BOT_OPTIONS[id].name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section className="play-setup__panel" aria-labelledby="play-rules-title">
            <div className="play-setup__heading">
              <div>
                <p className="play-eyebrow">02 <span>/</span> TABLE RULES</p>
                <h2 id="play-rules-title">Set the match conditions</h2>
              </div>
            </div>

            <label className="play-setup__field">
              <span>Round wins to take the game</span>
              <select
                value={targetRoundWins}
                onChange={(event) => setTargetRoundWins(Number(event.target.value))}
              >
                {ROUND_TARGETS.map((count) => (
                  <option key={count} value={count}>First to {count}</option>
                ))}
              </select>
              <small>The first player to reach this many round wins takes the game.</small>
            </label>

          </section>

          <section className="play-setup__panel" aria-labelledby="play-dev-title">
            <div className="play-setup__heading">
              <div>
                <p className="play-eyebrow">03 <span>/</span> DEVELOPER TOOLS</p>
                <h2 id="play-dev-title">Visibility options</h2>
              </div>
            </div>
            <div className="play-setup__toggle">
              <div>
                <strong>Show all hand cards</strong>
                <p>Reveal every player's current hand.</p>
              </div>
              <button
                type="button"
                className={`play-switch${revealHands ? " is-on" : ""}`}
                role="switch"
                aria-checked={revealHands}
                aria-label="Show all hand cards"
                onClick={() => setRevealHands((current) => !current)}
              >
                <span />
              </button>
            </div>
            <div className="play-setup__toggle">
              <div>
                <strong>Show the burned card</strong>
                <p>Reveal the face-down card removed from the deck this round.</p>
              </div>
              <button
                type="button"
                className={`play-switch${revealBurn ? " is-on" : ""}`}
                role="switch"
                aria-checked={revealBurn}
                aria-label="Show the burned card"
                onClick={() => setRevealBurn((current) => !current)}
              >
                <span />
              </button>
            </div>
          </section>

          <section className="play-setup__panel" aria-labelledby="play-style-title">
            <div className="play-setup__heading">
              <div>
                <p className="play-eyebrow">04 <span>/</span> TABLE STYLE</p>
                <h2 id="play-style-title">Choose the deck backdrop</h2>
                <p>Compare a clean table with a subtle etched rectangle.</p>
              </div>
            </div>
            <fieldset className="play-backdrop-options">
              <legend className="visually-hidden">Deck backdrop</legend>
              {(["none", "rectangle"] as const).map((style) => (
                <label
                  className={`play-backdrop-option${deckBackdrop === style ? " is-selected" : ""}`}
                  key={style}
                >
                  <input
                    type="radio"
                    name="deck-backdrop"
                    value={style}
                    checked={deckBackdrop === style}
                    onChange={() => setDeckBackdrop(style)}
                  />
                  <span className={`play-backdrop-option__preview play-backdrop-option__preview--${style}`}>
                    <i />
                    <i />
                  </span>
                  <span>
                    <strong>{style === "none" ? "No backdrop" : "Rectangle"}</strong>
                    <small>{style === "none" ? "Cards directly on the felt" : "A quiet rectangular outline"}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          </section>
        </div>

        <aside className="play-setup__summary" aria-label="Table setup summary">
          <p className="play-eyebrow">TABLE PREVIEW</p>
          <h2>{tableName.trim() || DEFAULT_TABLE_NAME}</h2>
          <div className="play-summary__metric">
            <span>Players</span>
            <strong>{playerCount} total</strong>
          </div>
          <div className="play-summary__metric">
            <span>Match target</span>
            <strong>First to {targetRoundWins}</strong>
          </div>
          <div className="play-summary__lineup">
            <p>SEATS AT THE TABLE</p>
            <div className="play-summary__player">
              <span className="play-summary__dot play-summary__dot--you" />
              <span>You</span>
              <small>Player</small>
            </div>
            {bots.slice(0, playerCount - 1).map((bot, index) => (
              <div className="play-summary__player" key={index}>
                <span className={`play-summary__dot play-summary__dot--${bot}`} />
                <span>{botNames[index]}</span>
                <small>{BOT_OPTIONS[bot].name}</small>
              </div>
            ))}
          </div>
          <button className="play-setup__submit" type="submit">
            Create table <span aria-hidden="true">→</span>
          </button>
          <p className="play-setup__footnote">
            The game server will be contacted when you create the table.
          </p>
        </aside>
      </div>
      {nameError && <p className="play-setup__validation" role="alert">{nameError}</p>}
    </form>
  );
}

export default function Play() {
  const game = useGame();
  const [started, setStarted] = useState(false);
  const [activeSetup, setActiveSetup] = useState<GameSetup | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const playRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLElement>(null);
  const { table, prompt, status } = game;

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === playRef.current);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [game.log]);

  const you = table?.players[table.youSeat];
  const opponents = table
    ? [
        ...table.players.slice(table.youSeat + 1),
        ...table.players.slice(0, table.youSeat),
      ]
    : [];
  const cardPrompt = prompt?.kind === "card" ? prompt : null;
  const winsNeeded = table?.winsNeeded ?? 3;

  function startGame(setup: GameSetup) {
    setActiveSetup(setup);
    setStarted(true);
    game.startGame(setup);
  }

  function returnToSetup() {
    setStarted(false);
    game.returnToSetup();
  }

  async function toggleFullscreen() {
    const element = playRef.current;
    if (!element) return;

    setFullscreenError("");
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await element.requestFullscreen();
      }
    } catch (error) {
      setFullscreenError(error instanceof Error ? error.message : "Fullscreen could not be changed.");
    }
  }

  function targetSelection(seat: number) {
    if (prompt?.kind !== "target") return undefined;
    const optionIndex = prompt.options.indexOf(seat);
    return optionIndex < 0 ? undefined : () => game.choose(optionIndex);
  }

  return (
    <div className={`page play-page${started ? " play-page--table" : ""}`}>
      <Header />

      <main className="play-main">
        {!started && (
          <section className="play-intro">
            <div>
              <p className="play-eyebrow">SIMULATION LAB <span>/</span> LIVE GAME</p>
              <h1>Play</h1>
              <p className="play-intro__copy">
                Choose your opponents and table rules before you sit down to play.
              </p>
            </div>
          </section>
        )}

        {started ? (
          <div className="play" ref={playRef}>
            <section className="table">
              <header className="table__header">
                <div className="table__heading">
                  <div>
                    <p className="table__eyebrow">
                      {table && table.round > 0
                        ? `Round ${table.round} · ${table.players.length} Players`
                        : "Creating your table"}
                    </p>
                    <h2 className="table__title">
                      {table?.name || activeSetup?.tableName || DEFAULT_TABLE_NAME}
                    </h2>
                  </div>
                  {table && (
                    <div className="table__chips">
                      <span className="chip">Dealer · {table.players[table.dealer].name}</span>
                      <span className="chip">First to {table.winsNeeded}</span>
                    </div>
                  )}
                </div>

                <div className="table__actions" aria-label="Table controls">
                  <button
                    type="button"
                    className="table-action table-action--primary"
                    onClick={game.newGame}
                    disabled={!status.connected}
                  >
                    <TableIcon name="new-game" />
                    <span>New game</span>
                  </button>
                  <button
                    type="button"
                    className="table-action"
                    onClick={game.togglePause}
                    disabled={!status.connected || !status.running}
                    aria-label={status.paused ? "Resume game" : "Pause game"}
                    title={status.paused ? "Resume game" : "Pause game"}
                  >
                    <TableIcon name={status.paused ? "resume" : "pause"} />
                  </button>
                  <button
                    type="button"
                    className="table-action"
                    onClick={returnToSetup}
                    aria-label="Change table setup"
                    title="Change table setup"
                  >
                    <TableIcon name="setup" />
                  </button>
                  <button
                    type="button"
                    className="table-action"
                    onClick={toggleFullscreen}
                    aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                    title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  >
                    <TableIcon name="fullscreen" />
                  </button>
                </div>
              </header>

              <div className="table__devtools">
                <span className="table__devtools-label">Developer tools</span>
                <button
                  type="button"
                  className="table-action table-action--tool"
                  onClick={game.toggleRevealHands}
                  disabled={!status.connected}
                  aria-pressed={status.revealHands}
                >
                  <TableIcon name={status.revealHands ? "eye-off" : "eye"} />
                  <span>{status.revealHands ? "Hide hands" : "Reveal hands"}</span>
                </button>
              </div>

              {fullscreenError && <p className="play-fullscreen-error" role="alert">{fullscreenError}</p>}

              <div className="felt">
                <div className="opponents">
                  {opponents.map((player) => (
                    <PlayerSeat
                      key={player.seat}
                      player={player}
                      winsNeeded={winsNeeded}
                      onSelectTarget={targetSelection(player.seat)}
                    />
                  ))}
                </div>

                <div className={`deck-area deck-area--${activeSetup?.deckBackdrop ?? "none"}`}>
                  <p className="deck-area__caption" aria-live="polite">{game.caption}</p>
                  {table ? (
                    <div className="deck-area__stacks">
                      <DeckPile count={table.deckCount} />
                      <div
                        className="burn-pile"
                        role="group"
                        aria-label={table.burn ? `Burned card: ${CARD_BY_ID[table.burn].name}` : "Face-down burned card"}
                      >
                        <div className="burn-pile__header">
                          <p>Burn card</p>
                          <button
                            type="button"
                            className="burn-pile__toggle"
                            onClick={game.toggleRevealBurn}
                            disabled={!status.connected}
                            aria-pressed={status.revealBurn}
                            aria-label={status.revealBurn ? "Hide burned card" : "Reveal burned card"}
                            title={status.revealBurn ? "Hide burned card" : "Reveal burned card"}
                          >
                            <TableIcon name={status.revealBurn ? "eye-off" : "eye"} />
                          </button>
                        </div>
                        <Card
                          id={table.burn ?? undefined}
                          faceDown={!table.burn}
                          width="var(--burn-card-w, 72px)"
                          className="burn-pile__card"
                        />
                      </div>
                    </div>
                  ) : <span />}
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
                    onSelectTarget={targetSelection(you.seat)}
                  />
                )}
              </div>
            </section>

            <aside ref={logRef} className="log" aria-label="Match history">
              <div className="log__header">
                <h2 className="log__title">Match history</h2>
              </div>
              {game.log.length === 0 ? (
                <p className="log__empty">Game events will appear here as the match unfolds.</p>
              ) : (
                <ol className="log__entries" aria-live="polite" aria-relevant="additions">
                  {game.log.map((entry, index) => (
                    <li className={`log__entry log__entry--${entry.kind}`} key={index}>
                      <div className="log__entry-meta">
                        {entry.turn && (
                          <span className="log__turn">
                            C{entry.turn.cycle} · S{entry.turn.seat + 1}
                          </span>
                        )}
                        <span className="log__kind">{entry.label}</span>
                      </div>
                      <p className="log__text">{entry.text}</p>
                    </li>
                  ))}
                </ol>
              )}
            </aside>
          </div>
        ) : (
          <TableSetup onStart={startGame} initialSetup={activeSetup} />
        )}
      </main>

      <Footer />
    </div>
  );
}
