import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Header, Footer } from "../../components/Header";
import "./Simulate.css";

type StrategyId = "random" | "no-princess";

const STRATEGIES: Record<StrategyId, { name: string; description: string }> = {
  random: {
    name: "Random Strategy",
    description: "Chooses a legal card, target, and Guard guess at random.",
  },
  "no-princess": {
    name: "No Princess",
    description: "Avoids playing Princess; random choices for other decisions.",
  },
};

const DEFAULT_LINEUP: StrategyId[] = ["random", "no-princess", "random", "no-princess"];
const GAME_COUNTS = [100, 1_000, 5_000, 10_000, 25_000, 50_000];
const PLAYER_COUNTS = [2, 3, 4];
const ROUND_TARGETS = [1, 3, 5, 7];

type RunConfig = {
  games: number;
  players: { seat: number; name: string; strategy: string }[];
  targetRoundWins: number;
  rotateSeats: boolean;
  seed: string | null;
};

function downloadConfig(config: RunConfig) {
  const contents = JSON.stringify(config, null, 2);
  const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "love-letter-simulation-config.json";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Simulate() {
  const [playerCount, setPlayerCount] = useState(4);
  const [strategies, setStrategies] = useState<StrategyId[]>(DEFAULT_LINEUP);
  const [games, setGames] = useState(10_000);
  const [targetRoundWins, setTargetRoundWins] = useState(3);
  const [rotateSeats, setRotateSeats] = useState(true);
  const [seed, setSeed] = useState("");
  const [notice, setNotice] = useState("");

  const players = strategies.slice(0, playerCount).map((strategy, index) => ({
    seat: index + 1,
    name: `${STRATEGIES[strategy].name} ${index + 1}`,
    strategy: STRATEGIES[strategy].name,
  }));
  const config: RunConfig = {
    games,
    players,
    targetRoundWins,
    rotateSeats,
    seed: seed.trim() || null,
  };

  function updateStrategy(seat: number, strategy: StrategyId) {
    setStrategies((current) => current.map((item, index) => index === seat ? strategy : item));
    setNotice("");
  }

  function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(
      `${games.toLocaleString()} games with ${playerCount} bots are ready. The simulation runner is not connected yet.`,
    );
  }

  function resetConfig() {
    setPlayerCount(4);
    setStrategies(DEFAULT_LINEUP);
    setGames(10_000);
    setTargetRoundWins(3);
    setRotateSeats(true);
    setSeed("");
    setNotice("");
  }

  return (
    <div className="simulate-page">
      <Header />
      <main className="simulate-main">
        <section className="simulate-intro">
          <div>
            <p className="simulate-eyebrow">SIMULATION LAB <span>/</span> EXPERIMENT BUILDER</p>
            <h1>Set up a simulation.</h1>
            <p className="simulate-intro__copy">
              Choose the bots, set the match conditions, and prepare a repeatable comparison.
            </p>
          </div>
          <Link className="simulate-stats-link" to="/stats">
            View statistics <span aria-hidden="true">↗</span>
          </Link>
        </section>

        <div className="simulate-status" role="note">
          <span className="simulate-status__icon" aria-hidden="true">i</span>
          <p>
            <strong>Configuration preview</strong>
            <span>Simulation execution is not connected yet. You can build and export a run setup here.</span>
          </p>
          <span className="simulate-status__badge">DRAFT</span>
        </div>

        <form className="simulate-layout" onSubmit={handlePreview}>
          <div className="simulate-builder">
            <section className="simulate-panel" aria-labelledby="lineup-title">
              <div className="simulate-panel__heading">
                <div>
                  <p className="simulate-eyebrow">01 <span>/</span> BOT LINEUP</p>
                  <h2 id="lineup-title">Choose your table</h2>
                  <p className="simulate-panel__description">
                    Seat strategies together to compare how they perform in the same games.
                  </p>
                </div>
                <label className="simulate-field simulate-field--players">
                  <span>Players</span>
                  <select
                    value={playerCount}
                    onChange={(event) => {
                      setPlayerCount(Number(event.target.value));
                      setNotice("");
                    }}
                  >
                    {PLAYER_COUNTS.map((count) => (
                      <option key={count} value={count}>{count} players</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="simulate-bot-list">
                {strategies.slice(0, playerCount).map((strategy, index) => (
                  <div className="simulate-bot" key={index}>
                    <span className="simulate-bot__seat">{String(index + 1).padStart(2, "0")}</span>
                    <div className="simulate-bot__info">
                      <label htmlFor={`bot-strategy-${index}`}>Seat {index + 1}</label>
                      <span>{STRATEGIES[strategy].description}</span>
                    </div>
                    <select
                      id={`bot-strategy-${index}`}
                      className="simulate-bot__select"
                      value={strategy}
                      onChange={(event) => updateStrategy(
                        index,
                        event.target.value === "no-princess" ? "no-princess" : "random",
                      )}
                      aria-label={`Strategy for seat ${index + 1}`}
                    >
                      {(Object.keys(STRATEGIES) as StrategyId[]).map((id) => (
                        <option key={id} value={id}>{STRATEGIES[id].name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="simulate-library-note">
                <span className="simulate-library-note__mark" aria-hidden="true">+</span>
                <span>
                  <strong>Two built-in strategies available</strong>
                  <small>Custom bot registration can be added when the simulation API is connected.</small>
                </span>
              </div>
            </section>

            <section className="simulate-panel" aria-labelledby="conditions-title">
              <div className="simulate-panel__heading">
                <div>
                  <p className="simulate-eyebrow">02 <span>/</span> GAME CONDITIONS</p>
                  <h2 id="conditions-title">Tune the experiment</h2>
                </div>
              </div>

              <div className="simulate-options-grid">
                <label className="simulate-field">
                  <span>Number of games</span>
                  <select value={games} onChange={(event) => {
                    setGames(Number(event.target.value));
                    setNotice("");
                  }}>
                    {GAME_COUNTS.map((count) => (
                      <option key={count} value={count}>{count.toLocaleString()} games</option>
                    ))}
                  </select>
                  <small>More games give steadier comparisons.</small>
                </label>

                <label className="simulate-field">
                  <span>Round wins to take the game</span>
                  <select value={targetRoundWins} onChange={(event) => {
                    setTargetRoundWins(Number(event.target.value));
                    setNotice("");
                  }}>
                    {ROUND_TARGETS.map((count) => (
                      <option key={count} value={count}>First to {count}</option>
                    ))}
                  </select>
                  <small>Sets the match length for each game.</small>
                </label>

                <label className="simulate-field">
                  <span>Random seed <em>optional</em></span>
                  <input
                    type="number"
                    min="0"
                    max="2147483647"
                    step="1"
                    placeholder="Generate automatically"
                    value={seed}
                    onChange={(event) => {
                      setSeed(event.target.value);
                      setNotice("");
                    }}
                  />
                  <small>Reuse a seed to make a run reproducible.</small>
                </label>
              </div>

              <div className="simulate-toggle-row">
                <div>
                  <strong>Rotate seats between games</strong>
                  <p>Moves each bot through every seat to reduce position bias.</p>
                </div>
                <button
                  type="button"
                  className={`simulate-switch${rotateSeats ? " is-on" : ""}`}
                  role="switch"
                  aria-checked={rotateSeats}
                  aria-label="Rotate seats between games"
                  onClick={() => {
                    setRotateSeats((current) => !current);
                    setNotice("");
                  }}
                >
                  <span />
                </button>
              </div>
            </section>

            <div className="simulate-actions">
              <button className="simulate-reset" type="button" onClick={resetConfig}>Reset defaults</button>
              <button className="simulate-submit" type="submit">
                Check configuration
                <span aria-hidden="true">→</span>
              </button>
            </div>
            {notice && <p className="simulate-notice" role="status">{notice}</p>}
          </div>

          <aside className="simulate-summary" aria-label="Simulation setup summary">
            <div className="simulate-summary__top">
              <div>
                <p className="simulate-eyebrow">RUN SUMMARY</p>
                <h2>Experiment preview</h2>
              </div>
              <span className="simulate-summary__icon" aria-hidden="true">↗</span>
            </div>

            <div className="simulate-summary__metric">
              <span>Games</span>
              <strong>{games.toLocaleString()}</strong>
            </div>
            <div className="simulate-summary__metric">
              <span>Players per game</span>
              <strong>{playerCount}</strong>
            </div>
            <div className="simulate-summary__metric">
              <span>Bot-game results</span>
              <strong>{(games * playerCount).toLocaleString()}</strong>
            </div>
            <div className="simulate-summary__metric">
              <span>Match format</span>
              <strong>First to {targetRoundWins}</strong>
            </div>

            <div className="simulate-summary__lineup">
              <p>PLAYERS IN THIS RUN</p>
              {players.map((player, index) => (
                <div className="simulate-summary__player" key={`${player.name}-${index}`}>
                  <span className={`simulate-summary__dot simulate-summary__dot--${strategies[index]}`} />
                  <span>{player.name}</span>
                  <small>Seat {player.seat}</small>
                </div>
              ))}
            </div>

            <div className="simulate-summary__rotation">
              <span className={`simulate-summary__check${rotateSeats ? " is-on" : ""}`}>
                {rotateSeats ? "✓" : "–"}
              </span>
              Seat rotation {rotateSeats ? "on" : "off"}
            </div>

            <button
              className="simulate-export"
              type="button"
              onClick={() => downloadConfig(config)}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 2.5v9m0 0 3.5-3.5M10 11.5 6.5 8M3.5 13v3.5h13V13" />
              </svg>
              Export setup
            </button>

            <p className="simulate-summary__footnote">
              This draft prepares the configuration only; it does not run games or produce results.
            </p>
          </aside>
        </form>

        <section className="simulate-next">
          <div>
            <p className="simulate-eyebrow">AFTER A RUN</p>
            <h2>Compare the results</h2>
            <p>When simulations are connected, results will be available in the statistics dashboard.</p>
          </div>
          <Link to="/stats">Explore statistics <span aria-hidden="true">→</span></Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
