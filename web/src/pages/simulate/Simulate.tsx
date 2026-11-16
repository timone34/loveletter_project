import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header, Footer } from "../../components/Header";
import type { BotOption, SimulationResult } from "../../types";
import "./Simulate.css";

const DEFAULT_LINEUP = [
  "random-strategy",
  "no-princess",
  "random-strategy",
  "no-princess",
];
const GAME_COUNTS = [100, 1_000, 5_000, 10_000, 25_000, 50_000];
const PLAYER_COUNTS = [2, 3, 4];
const ROUND_TARGETS = [1, 3, 5, 7];

type RunConfig = {
  games: number;
  players: { seat: number; name: string; bot: string }[];
  targetRoundWins: number;
  rotateSeats: boolean;
  seed: number | null;
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
  const navigate = useNavigate();
  const [bots, setBots] = useState<BotOption[]>([]);
  const [botsError, setBotsError] = useState("");
  const [playerCount, setPlayerCount] = useState(4);
  const [strategies, setStrategies] = useState(DEFAULT_LINEUP);
  const [games, setGames] = useState(10_000);
  const [targetRoundWins, setTargetRoundWins] = useState(3);
  const [rotateSeats, setRotateSeats] = useState(true);
  const [seed, setSeed] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/bots")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load bots (${response.status}).`);
        return response.json() as Promise<BotOption[]>;
      })
      .then((availableBots) => {
        if (!active) return;
        setBots(availableBots);
        if (availableBots.length > 0) {
          setStrategies((current) => current.map((id) =>
            availableBots.some((bot) => bot.id === id) ? id : availableBots[0].id,
          ));
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setBotsError(reason instanceof Error ? reason.message : "Could not load bots.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const players = strategies.slice(0, playerCount).map((botId, index) => {
    const bot = bots.find((item) => item.id === botId);
    return {
      seat: index + 1,
      name: `${bot?.name ?? botId} ${index + 1}`,
      bot,
      botId,
    };
  });
  const config: RunConfig = {
    games,
    players: players.map(({ seat, name, botId }) => ({ seat, name, bot: botId })),
    targetRoundWins,
    rotateSeats,
    seed: seed.trim() ? Number(seed) : null,
  };

  function updateStrategy(seat: number, botId: string) {
    setStrategies((current) => current.map((item, index) => index === seat ? botId : item));
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsRunning(true);
    try {
      const response = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const result = await response.json() as SimulationResult | { detail?: string };
      if (!response.ok) {
        throw new Error("detail" in result && result.detail
          ? result.detail
          : `Simulation failed (${response.status}).`);
      }
      navigate("/stats", { state: { result: result as SimulationResult } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The simulation could not be completed.");
    } finally {
      setIsRunning(false);
    }
  }

  function resetConfig() {
    setPlayerCount(4);
    setStrategies(DEFAULT_LINEUP);
    setGames(10_000);
    setTargetRoundWins(3);
    setRotateSeats(true);
    setSeed("");
    setError("");
  }

  const isLoadingBots = bots.length === 0 && !botsError;

  return (
    <div className="simulate-page">
      <Header />
      <main className="simulate-main">
        <section className="simulate-intro">
          <div>
            <p className="simulate-eyebrow">SIMULATION LAB <span>/</span> EXPERIMENT BUILDER</p>
            <h1>Set up a simulation.</h1>
            <p className="simulate-intro__copy">
              Choose the bots, set the match conditions, and run a comparison.
            </p>
          </div>
          <Link className="simulate-stats-link" to="/stats">
            View latest results <span aria-hidden="true">↗</span>
          </Link>
        </section>

        <div className="simulate-status" role={botsError ? "alert" : "status"}>
          <span className="simulate-status__icon" aria-hidden="true">{botsError ? "!" : "i"}</span>
          <p>
            <strong>{botsError ? "Bot list unavailable" : isRunning ? "Simulation running" : "Ready to simulate"}</strong>
            <span>
              {botsError || (isRunning
                ? "The experiment is running and its datasets are being prepared."
                : `${bots.length} strategies discovered from the bots folder.`)}
            </span>
          </p>
          <span className="simulate-status__badge">{isRunning ? "RUNNING" : "LIVE"}</span>
        </div>

        <form className="simulate-layout" onSubmit={handleSubmit}>
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
                    disabled={isRunning}
                    onChange={(event) => setPlayerCount(Number(event.target.value))}
                  >
                    {PLAYER_COUNTS.map((count) => (
                      <option key={count} value={count}>{count} players</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="simulate-bot-list">
                {players.map(({ botId, bot, seat }, index) => (
                  <div className="simulate-bot" key={seat}>
                    <span className="simulate-bot__seat">{String(seat).padStart(2, "0")}</span>
                    <div className="simulate-bot__info">
                      <label htmlFor={`bot-strategy-${index}`}>Seat {seat}</label>
                      <span>{bot?.description ?? "Loading available strategies…"}</span>
                    </div>
                    <select
                      id={`bot-strategy-${index}`}
                      className="simulate-bot__select"
                      value={botId}
                      disabled={isLoadingBots || Boolean(botsError) || isRunning}
                      onChange={(event) => updateStrategy(index, event.target.value)}
                      aria-label={`Strategy for seat ${seat}`}
                    >
                      {bots.map((option) => (
                        <option key={option.id} value={option.id}>{option.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="simulate-library-note">
                <span className="simulate-library-note__mark" aria-hidden="true">+</span>
                <span>
                  <strong>{bots.length} bot strategies available</strong>
                  <small>Options are discovered from the Python bots package.</small>
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
                  <select value={games} disabled={isRunning} onChange={(event) => setGames(Number(event.target.value))}>
                    {GAME_COUNTS.map((count) => (
                      <option key={count} value={count}>{count.toLocaleString()} games</option>
                    ))}
                  </select>
                  <small>More games give steadier comparisons.</small>
                </label>

                <label className="simulate-field">
                  <span>Round wins to take the game</span>
                  <select
                    value={targetRoundWins}
                    disabled={isRunning}
                    onChange={(event) => setTargetRoundWins(Number(event.target.value))}
                  >
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
                    disabled={isRunning}
                    onChange={(event) => setSeed(event.target.value)}
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
                  onClick={() => setRotateSeats((current) => !current)}
                  disabled={isRunning}
                >
                  <span />
                </button>
              </div>
            </section>

            <div className="simulate-actions">
              <button className="simulate-reset" type="button" onClick={resetConfig} disabled={isRunning}>
                Reset defaults
              </button>
              <button
                className="simulate-submit"
                type="submit"
                disabled={isLoadingBots || Boolean(botsError) || isRunning}
              >
                {isRunning ? "Running simulation…" : "Run simulation"}
                <span aria-hidden="true">{isRunning ? "…" : "→"}</span>
              </button>
            </div>
            {error && <p className="simulate-notice simulate-notice--error" role="alert">{error}</p>}
          </div>

          <aside className="simulate-summary" aria-label="Simulation setup summary">
            <div className="simulate-summary__top">
              <div>
                <p className="simulate-eyebrow">RUN SUMMARY</p>
                <h2>Experiment setup</h2>
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
              {players.map(({ botId, name, seat }) => (
                <div className="simulate-summary__player" key={seat}>
                  <span className={`simulate-summary__dot simulate-summary__dot--${botId}`} />
                  <span>{name}</span>
                  <small>Seat {seat}</small>
                </div>
              ))}
            </div>

            <div className="simulate-summary__rotation">
              <span className={`simulate-summary__check${rotateSeats ? " is-on" : ""}`}>
                {rotateSeats ? "✓" : "–"}
              </span>
              Seat rotation {rotateSeats ? "on" : "off"}
            </div>

            <button className="simulate-export" type="button" onClick={() => downloadConfig(config)}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 2.5v9m0 0 3.5-3.5M10 11.5 6.5 8M3.5 13v3.5h13V13" />
              </svg>
              Export setup
            </button>

            <p className="simulate-summary__footnote">
              Run results open automatically in Statistics when the experiment finishes.
            </p>
          </aside>
        </form>

        <section className="simulate-next">
          <div>
            <p className="simulate-eyebrow">AFTER A RUN</p>
            <h2>Compare the results</h2>
            <p>Review match outcomes, play decisions, seat effects, and card usage.</p>
          </div>
          <Link to="/stats">Explore statistics <span aria-hidden="true">→</span></Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
