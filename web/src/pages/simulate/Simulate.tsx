import { useId, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Header, Footer } from "../../components/Header";
import { Field, Segmented, Stepper, Toggle } from "../../components/Field";
import { Heart } from "../../components/Heart";
import { SectionTitle } from "../../components/SectionTitle";
import { BotTile, LibraryTile, type SeatedBot } from "../../components/BotTiles";
import { useBots, type BotInfo } from "../play/useBots";
import { randomSeed } from "../play/config";
import { startRun, useRuns } from "../../sims/api";
import { MS_PER_GAME, count, duration, lineupText, when } from "../../sims/format";
import { isActive, type RunConfig } from "../../sims/types";
import "../play/setup/Setup.css";
import "./Simulate.css";

// The Simulate page (/simulate): pick four bots and the run settings, press Run,
// and land on that run's Stats page (/stats/<id>), which fills in live.
//
// Same layout as the Play setup page (and the same CSS, Setup.css): seats on
// top, the bot library below, settings on the right. Arriving with a config in
// the router state ("Edit & run again" on a Stats page) starts from that config.

const STORAGE_KEY = "loveletter.simConfig";
const GAME_PRESETS = [100, 1000, 10_000, 100_000];
const MAX_GAMES = 100_000; // matches runs/config.py

const DEFAULT_RUN: RunConfig = {
  name: "",
  players: [
    { name: "Alice", bot: "CardCounter" },
    { name: "Bob", bot: "RandomChoice" },
    { name: "Charlie", bot: "RandomChoice" },
    { name: "Diane", bot: "RandomChoice" },
  ],
  games: 1000,
  targetRoundWins: 3,
  rotateSeats: true,
  seed: "",
  saveLln: false,
};

function loadRun(): RunConfig {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && Array.isArray(saved.players) && saved.players.length === 4) return { ...DEFAULT_RUN, ...saved };
  } catch {
    // storage unavailable or garbled: defaults
  }
  return DEFAULT_RUN;
}

function saveRun(config: RunConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // not remembered; the run still starts
  }
}

export default function Simulate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { bots, error: botsError, retry } = useBots();
  const { runs } = useRuns();

  // "Edit & run again" passes the old run's settings; keep its seed only if asked to
  const [draft, setDraft] = useState<RunConfig>(() => (location.state?.config as RunConfig | undefined) ?? loadRun());
  const [active, setActive] = useState(0); // the seat the bot library fills
  const [problem, setProblem] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const ids = { name: useId(), games: useId(), seed: useId() };

  const config = withKnownBots(draft, bots);
  const botById = new Map((bots ?? []).map((b) => [b.id, b]));

  const update = (changes: Partial<RunConfig>) => {
    setDraft({ ...config, ...changes });
    setProblem(null);
  };
  const setPlayer = (i: number, changes: Partial<SeatedBot>) =>
    update({ players: config.players.map((p, j) => (j === i ? { ...p, ...changes } : p)) });

  const pickBot = (id: string) => {
    setPlayer(active, { bot: id });
    setActive((active + 1) % 4);
  };

  // the ladder setup: the bot in seat 1 against three of a fixed opponent
  const versusField = (opponent: string) =>
    update({ players: config.players.map((p, i) => (i === 0 ? p : { ...p, bot: opponent })) });
  const mirror = () => update({ players: config.players.map((p) => ({ ...p, bot: config.players[0].bot })) });

  const run = async (e: FormEvent) => {
    e.preventDefault();
    const issue = bots ? validate(config) : "The bot list hasn't loaded yet.";
    if (issue) return setProblem(issue);
    setStarting(true);
    try {
      const record = await startRun(config);
      saveRun(config);
      navigate(`/stats/${record.id}`);
    } catch (err) {
      setProblem((err as Error).message);
      setStarting(false);
    }
  };

  const busy = runs?.filter(isActive).length ?? 0;
  const estimate = duration((config.games * MS_PER_GAME) / 1000);
  const llnSize = Math.max(1, Math.round((config.games * 65) / 1000)); // ~65 KB per 1000 games, compressed

  return (
    <div className="page">
      <Header />

      <form className="setup" onSubmit={run}>
        <header className="setup__head">
          <p className="setup__eyebrow">New simulation</p>
          <h1 className="setup__title">Pit the bots against each other</h1>
          <p className="setup__intro">Seat four bots, choose how many games, and watch the numbers come in.</p>
        </header>

        {/* ----- Lineup ----- */}
        <section className="setup__seats" aria-label="Lineup">
          <SectionTitle
            n={1}
            title="Lineup"
            note={config.rotateSeats ? "Everyone moves one seat after each game." : "Seats stay fixed for every game."}
            action={
              <span className="sim-presets">
                <button type="button" className="ghost-btn" onClick={() => versusField("RandomChoice")} disabled={!bots}>
                  Seat 1 vs 3× Random
                </button>
                <button type="button" className="ghost-btn" onClick={mirror} disabled={!bots}>
                  Mirror seat 1
                </button>
              </span>
            }
          />
          <div className="seats">
            {config.players.map((p, i) => (
              <BotTile
                key={i}
                seat={i}
                opponent={p}
                bot={botById.get(p.bot)}
                active={active === i}
                onActivate={() => setActive(i)}
                onName={(name) => setPlayer(i, { name })}
              />
            ))}
          </div>
        </section>

        {/* ----- Bot library + recent runs ----- */}
        <section className="setup__bots" aria-label="Bots">
          <SectionTitle
            n={2}
            title="Bots"
            note={<>Choosing for <strong>{config.players[active].name || `seat ${active + 1}`}</strong>. Click a bot to seat it.</>}
          />
          {botsError ? (
            <div className="notice">
              <p>{botsError} Start it from the project root with <code>uvicorn server:app --port 8000</code>.</p>
              <button type="button" className="ghost-btn" onClick={retry}>Try again</button>
            </div>
          ) : !bots ? (
            <p className="notice">Loading bots…</p>
          ) : (
            <div className="library">
              {bots.map((b) => (
                <LibraryTile
                  key={b.id}
                  bot={b}
                  selected={config.players[active].bot === b.id}
                  seatedAt={config.players.flatMap((p, i) => (p.bot === b.id ? [i + 1] : []))}
                  onPick={() => pickBot(b.id)}
                />
              ))}
            </div>
          )}

          <div className="sim-recent">
            <SectionTitle
              n={4}
              title="Recent runs"
              action={<Link to="/stats" className="link-btn">All runs →</Link>}
            />
            {!runs?.length ? (
              <p className="notice">No simulations yet. Your runs will be listed here and under Statistics.</p>
            ) : (
              <ul className="sim-recent__list">
                {runs.slice(0, 4).map((r) => (
                  <li key={r.id}>
                    <Link to={`/stats/${r.id}`} className="sim-recent__item">
                      <strong>{r.config.name}</strong>
                      <span>{lineupText(r)}</span>
                      <span>{count(r.config.games)} games · {when(r.createdAt)}</span>
                      <span className={`status status--${r.status}`}>{r.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ----- Run settings ----- */}
        <aside className="setup__settings" aria-label="Run settings">
          <div className="settings">
            <SectionTitle n={3} title="Run" />

            <Field label="Run name" htmlFor={ids.name}>
              <input
                id={ids.name}
                className="input"
                value={config.name}
                maxLength={60}
                placeholder="empty = named after the lineup"
                onChange={(e) => update({ name: e.target.value })}
              />
            </Field>

            <Field
              label="Games"
              htmlFor={ids.games}
              hint={<>About {estimate}. A win rate from n games is accurate to roughly ±{pctHalfWidth(config.games)}.</>}
            >
              <Segmented<number>
                label="Games"
                value={GAME_PRESETS.includes(config.games) ? config.games : -1}
                onChange={(games) => update({ games })}
                options={GAME_PRESETS.map((n) => ({ value: n, label: n >= 1000 ? `${n / 1000}k` : String(n) }))}
              />
              <input
                id={ids.games}
                className="input input--mono"
                type="number"
                min={1}
                max={MAX_GAMES}
                value={config.games}
                onChange={(e) => update({ games: Math.max(1, Math.min(MAX_GAMES, Math.round(Number(e.target.value) || 1))) })}
              />
            </Field>

            <Field label="Round wins to win">
              <Stepper
                label="Round wins to win"
                value={config.targetRoundWins}
                min={1}
                max={9}
                onChange={(targetRoundWins) => update({ targetRoundWins })}
              >
                <span className="hearts" aria-hidden="true">
                  {Array.from({ length: config.targetRoundWins }, (_, i) => <Heart key={i} />)}
                </span>
              </Stepper>
            </Field>

            <Field label="Seats" hint="Rotating cancels out any advantage of sitting in a particular seat.">
              <Toggle checked={config.rotateSeats} onChange={(rotateSeats) => update({ rotateSeats })}>
                Rotate seats every game
              </Toggle>
            </Field>

            <Field
              label="Seed"
              htmlFor={ids.seed}
              hint="Same seed = same decks for any lineup, and the same games for the same lineup. Empty rolls one; it's kept with the run."
              aside={
                <button type="button" className="link-btn" onClick={() => update({ seed: randomSeed() })}>
                  Roll one
                </button>
              }
            >
              <input
                id={ids.seed}
                className="input input--mono"
                value={config.seed}
                maxLength={40}
                placeholder="random"
                onChange={(e) => update({ seed: e.target.value })}
              />
            </Field>

            <Field label="Game record" hint={<>Save every game as LLN (.lln.bz2, about {llnSize} KB) to download or replay later.</>}>
              <Toggle checked={config.saveLln} onChange={(saveLln) => update({ saveLln })}>
                Keep the games
              </Toggle>
            </Field>
          </div>

          <div className="start">
            <p className="start__summary">
              <strong>{count(config.games)} games</strong> · {summary(config, botById)}
              <span> · first to {config.targetRoundWins}</span>
            </p>
            {busy > 0 && <p className="start__summary"><span>{busy} run{busy > 1 ? "s" : ""} ahead in the queue.</span></p>}
            {problem && <p className="start__problem" role="alert">{problem}</p>}
            <div className="start__actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setDraft(DEFAULT_RUN);
                  setActive(0);
                  setProblem(null);
                }}
              >
                Reset
              </button>
              <button type="submit" className="start__btn" disabled={!bots || starting}>
                {starting ? "Starting…" : <>Run <span aria-hidden="true">→</span></>}
              </button>
            </div>
          </div>
        </aside>
      </form>

      <Footer />
    </div>
  );
}

// ±half-width of a 95% interval for a 25% win rate over n games, as text
function pctHalfWidth(n: number): string {
  const half = 1.96 * Math.sqrt((0.25 * 0.75) / n) * 100;
  return `${half < 1 ? half.toFixed(1) : Math.round(half)} points`;
}

function summary(config: RunConfig, botById: Map<string, BotInfo>): string {
  const counts = new Map<string, number>();
  for (const p of config.players) counts.set(p.bot, (counts.get(p.bot) ?? 0) + 1);
  return [...counts].map(([id, n]) => `${n > 1 ? `${n}× ` : ""}${botById.get(id)?.name ?? id}`).join(" vs ");
}

function validate(config: RunConfig): string | null {
  const names = config.players.map((p) => p.name.trim());
  if (names.some((n) => n === "")) return "Every player needs a name.";
  if (new Set(names.map((n) => n.toLowerCase())).size < names.length) return "Every player needs a different name.";
  return null;
}

// A saved lineup can name a bot that no longer exists: swap it for the first bot.
function withKnownBots(config: RunConfig, bots: BotInfo[] | null): RunConfig {
  if (!bots?.length || config.players.every((p) => bots.some((b) => b.id === p.bot))) return config;
  return {
    ...config,
    players: config.players.map((p) => (bots.some((b) => b.id === p.bot) ? p : { ...p, bot: bots[0].id })),
  };
}
