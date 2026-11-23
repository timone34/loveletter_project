import { useEffect, useId, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Header, Footer } from "../../components/Header";
import { Field, Segmented, Stepper, Toggle } from "../../components/Field";
import { Heart } from "../../components/Heart";
import { SectionTitle } from "../../components/SectionTitle";
import { BotTile, LibraryTile, YouTile, type SeatedBot } from "../../components/BotTiles";
import { useBots, type BotInfo } from "../play/useBots";
import { randomSeed, saveConfig, type Speed, type Visibility } from "../play/config";
import { startRun, useRuns } from "../../sims/api";
import { MS_PER_GAME, count, defaultName, duration, lineupText, when } from "../../sims/format";
import { isActive, type RunConfig } from "../../sims/types";
import {
  DEFAULT_SETUP, MAX_GAMES, fromRun, loadSetup, saveSetup, toRunConfig, toTableConfig, validate,
  type Mode, type SetupConfig,
} from "./config";
import "./Setup.css";

// The setup page (/new): pick the lineup and settings, then Play, Watch or
// Simulate. Everything starts here.
//
// Layout: the mode switch and seats across the top, the bot library below
// them, and the settings for the chosen mode in a column on the right.
// Clicking a seat makes it "active"; clicking a bot in the library seats it there.
//
// Arriving with ?mode=simulate (old /simulate links) picks that mode; arriving
// with a run in the router state ("Edit & run" on a Stats page) starts from it.

const GAME_PRESETS = [100, 1000, 10_000, 100_000];

const MODES: { value: Mode; label: string; title: string; intro: string; go: string }[] = [
  {
    value: "play",
    label: "Play",
    title: "Set the table",
    intro: "Pick three bots to play against and choose the house rules.",
    go: "Sit down",
  },
  {
    value: "watch",
    label: "Watch",
    title: "Watch the bots play",
    intro: "Seat four bots and watch one game, move by move.",
    go: "Watch",
  },
  {
    value: "simulate",
    label: "Simulate",
    title: "Pit the bots against each other",
    intro: "Seat four bots, choose how many games, and watch the numbers come in.",
    go: "Run",
  },
];

export default function Setup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { bots, error: botsError, retry } = useBots();
  const { runs } = useRuns();

  const [draft, setDraft] = useState<SetupConfig>(() => {
    const saved = loadSetup();
    const run = location.state?.run as RunConfig | undefined;
    if (run) return fromRun(run, saved);
    const mode = new URLSearchParams(location.search).get("mode");
    return MODES.some((m) => m.value === mode) ? { ...saved, mode: mode as Mode } : saved;
  });
  // remember every change (in memory), so leaving the page and coming back keeps it
  useEffect(() => saveSetup(draft), [draft]);
  const [activeSlot, setActive] = useState(0); // the bot seat the library fills
  const [problem, setProblem] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const ids = { name: useId(), games: useId(), seed: useId() };

  const config = withKnownBots(draft, bots);
  const botById = new Map((bots ?? []).map((b) => [b.id, b]));
  const mode = MODES.find((m) => m.value === config.mode)!;
  const play = config.mode === "play";
  const simulate = config.mode === "simulate";
  const slots = play ? 3 : 4; // bot seats in use; in Play the fourth bot sits out
  const active = Math.min(activeSlot, slots - 1);

  const update = (changes: Partial<SetupConfig>) => {
    setDraft({ ...config, ...changes });
    setProblem(null);
  };
  const setPlayer = (i: number, changes: Partial<SeatedBot>) =>
    update({ players: config.players.map((p, j) => (j === i ? { ...p, ...changes } : p)) });

  const pickBot = (id: string) => {
    setPlayer(active, { bot: id });
    setActive((active + 1) % slots); // on to the next seat, so a few clicks fill the table
  };
  const randomLineup = () => {
    if (!bots?.length) return;
    update({ players: config.players.map((p) => ({ ...p, bot: bots[Math.floor(Math.random() * bots.length)].id })) });
  };
  // the ladder setup: the bot in seat 1 against three of a fixed opponent
  const versusField = (opponent: string) =>
    update({ players: config.players.map((p, i) => (i === 0 ? p : { ...p, bot: opponent })) });
  const mirror = () => update({ players: config.players.map((p) => ({ ...p, bot: config.players[0].bot })) });

  const start = async (e: FormEvent) => {
    e.preventDefault();
    const issue = bots ? validate(config) : "The bot list hasn't loaded yet.";
    if (issue) return setProblem(issue);
    if (!simulate) {
      saveConfig(toTableConfig(config));
      navigate("/play/table", { state: { start: true } });
      return;
    }
    setStarting(true);
    try {
      const record = await startRun(toRunConfig(config));
      navigate(`/stats/${record.id}`);
    } catch (err) {
      setProblem((err as Error).message);
      setStarting(false);
    }
  };

  // Seats in order. In Play your tile goes in your seat (drawn last when random)
  // and the three bots fill the rest, in order.
  const youAt = config.youSeat ?? 3;
  const seats: ({ kind: "you" } | { kind: "bot"; slot: number })[] = Array.from({ length: slots }, (_, slot) => ({ kind: "bot", slot }));
  if (play) seats.splice(youAt, 0, { kind: "you" });

  const busy = runs?.filter(isActive).length ?? 0;
  const sections = { seats: 1, bots: 2, recent: 3, settings: simulate ? 4 : 3 };

  return (
    <div className="page">
      <Header />

      <form className="setup" onSubmit={start}>
        <header className="setup__head">
          <div className="setup__modes">
            <Segmented<Mode>
              label="Mode"
              value={config.mode}
              onChange={(m) => update({ mode: m })}
              options={MODES.map((m) => ({ value: m.value, label: m.label }))}
            />
          </div>
          <h1 className="setup__title">{mode.title}</h1>
          <p className="setup__intro">{mode.intro}</p>
        </header>

        {/* ----- Seats ----- */}
        <section className="setup__seats" aria-label="Seats">
          <SectionTitle
            n={sections.seats}
            title="Seats"
            note={
              play
                ? `You take the place of ${config.players[3].name || "seat 4's bot"}.`
                : simulate
                  ? config.rotateSeats ? "Everyone moves one seat after each game." : "Seats stay fixed for every game."
                  : "Seat 1 deals the first round; seat 2 starts."
            }
            action={
              <span className="sim-presets">
                {!play && (
                  <>
                    <button type="button" className="ghost-btn" onClick={() => versusField("RandomChoice")} disabled={!bots}>
                      Seat 1 vs 3× Random
                    </button>
                    <button type="button" className="ghost-btn" onClick={mirror} disabled={!bots}>Mirror seat 1</button>
                  </>
                )}
                <button type="button" className="ghost-btn" onClick={randomLineup} disabled={!bots?.length}>Random lineup</button>
              </span>
            }
          />
          <div className="seats">
            {seats.map((s, i) =>
              s.kind === "you" ? (
                <YouTile
                  key="you"
                  seat={i}
                  random={config.youSeat === null}
                  name={config.you}
                  onName={(you) => update({ you })}
                  onMove={(d) => update({ youSeat: youAt + d })}
                />
              ) : (
                <BotTile
                  key={s.slot}
                  seat={i}
                  opponent={config.players[s.slot]}
                  bot={botById.get(config.players[s.slot].bot)}
                  active={active === s.slot}
                  onActivate={() => setActive(s.slot)}
                  onName={(name) => setPlayer(s.slot, { name })}
                />
              ),
            )}
          </div>
        </section>

        {/* ----- Bot library (+ recent runs when simulating) ----- */}
        <section className="setup__bots" aria-label="Bots">
          <SectionTitle
            n={sections.bots}
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
                  seatedAt={seats.flatMap((s, i) => (s.kind === "bot" && config.players[s.slot].bot === b.id ? [i + 1] : []))}
                  onPick={() => pickBot(b.id)}
                />
              ))}
            </div>
          )}

          {simulate && (
            <div className="sim-recent">
              <SectionTitle
                n={sections.recent}
                title="Recent runs"
                action={<Link to="/stats" className="link-btn">All runs →</Link>}
              />
              {!runs?.length ? (
                <p className="notice">No simulations yet. Your runs will be listed here and under History.</p>
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
          )}
        </section>

        {/* ----- Settings for this mode ----- */}
        <aside className="setup__settings" aria-label="Settings">
          <div className="settings">
            <SectionTitle n={sections.settings} title={simulate ? "Run" : "Table"} />

            {simulate ? (
              <Field
                label="Run name"
                htmlFor={ids.name}
                aside={config.runName && <button type="button" className="link-btn" onClick={() => update({ runName: "" })}>Use lineup</button>}
              >
                <input
                  id={ids.name}
                  className="input"
                  value={config.runName}
                  maxLength={60}
                  placeholder={defaultName(config.players.map((p) => p.bot))}
                  onChange={(e) => update({ runName: e.target.value })}
                />
              </Field>
            ) : (
              <Field label="Table name" htmlFor={ids.name}>
                <input
                  id={ids.name}
                  className="input"
                  value={config.tableName}
                  maxLength={40}
                  placeholder={DEFAULT_SETUP.tableName}
                  onChange={(e) => update({ tableName: e.target.value })}
                />
              </Field>
            )}

            {simulate && (
              <Field
                label="Games"
                htmlFor={ids.games}
                hint={<>About {duration((config.games * MS_PER_GAME) / 1000)}. A win rate from this many games is accurate to roughly ±{pctHalfWidth(config.games)}.</>}
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
            )}

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

            {!simulate && (
              <Field label="Speed" hint="How long the bots take between moves.">
                <Segmented<Speed>
                  label="Speed"
                  value={config.speed}
                  onChange={(speed) => update({ speed })}
                  options={[
                    { value: "slow", label: "Slow" },
                    { value: "normal", label: "Normal" },
                    { value: "fast", label: "Fast" },
                  ]}
                />
              </Field>
            )}

            {simulate && (
              <Field label="Seats" hint="Rotating cancels out any advantage of sitting in a particular seat.">
                <Toggle checked={config.rotateSeats} onChange={(rotateSeats) => update({ rotateSeats })}>
                  Rotate seats every game
                </Toggle>
              </Field>
            )}

            <Field
              label={simulate ? "Seed" : "Deck seed"}
              htmlFor={ids.seed}
              hint={
                simulate
                  ? "Same seed = same decks for any lineup, and the same games for the same lineup. Empty rolls one; it's kept with the run."
                  : "The same seed deals the same cards, round for round. Leave empty for fresh shuffles."
              }
              aside={
                config.seed ? (
                  <button type="button" className="link-btn" onClick={() => update({ seed: "" })}>Clear</button>
                ) : (
                  <button type="button" className="link-btn" onClick={() => update({ seed: randomSeed() })}>Roll one</button>
                )
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

            {play && (
              <>
                <Field label="Your seat">
                  <Toggle checked={config.youSeat === null} onChange={(random) => update({ youSeat: random ? null : 3 })}>
                    Random seat each game
                  </Toggle>
                </Field>
                <Field label="Visibility" hint="Multiplayer isn't built yet. This is kept for when it is.">
                  <Segmented<Visibility>
                    label="Visibility"
                    value={config.visibility}
                    onChange={(visibility) => update({ visibility })}
                    options={[
                      { value: "private", label: "Private" },
                      { value: "public", label: "Public" },
                    ]}
                  />
                </Field>
              </>
            )}

            {config.mode === "watch" && (
              <Field label="Hands" hint="Off: see only what a spectator at the table could. Can be switched during the game.">
                <Toggle checked={config.reveal} onChange={(reveal) => update({ reveal })}>
                  Show every hand
                </Toggle>
              </Field>
            )}

            {simulate && (
              <Field label="Game record" hint={<>Save every game as LLN to download or replay later (about {Math.max(1, Math.round((config.games * 65) / 1000))} KB compressed).</>}>
                <Toggle checked={config.saveLln} onChange={(saveLln) => update({ saveLln })}>
                  Keep the games
                </Toggle>
              </Field>
            )}
          </div>

          <div className="start">
            <p className="start__summary">{summary(config, botById)}</p>
            {simulate && busy > 0 && (
              <p className="start__summary"><span>{busy} run{busy > 1 ? "s" : ""} ahead in the queue.</span></p>
            )}
            {problem && <p className="start__problem" role="alert">{problem}</p>}
            <div className="start__actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setDraft({ ...DEFAULT_SETUP, mode: config.mode });
                  setActive(0);
                  setProblem(null);
                }}
              >
                Reset
              </button>
              <button type="submit" className="start__btn" disabled={!bots || starting}>
                {starting ? "Starting…" : <>{mode.go} <span aria-hidden="true">→</span></>}
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

// "You vs Card Counter Bot, 2× Random Bot · first to 3" and friends
function summary(c: SetupConfig, botById: Map<string, BotInfo>) {
  const name = (id: string) => botById.get(id)?.name ?? id;
  const group = (players: SeatedBot[]) => {
    const counts = new Map<string, number>();
    for (const p of players) counts.set(p.bot, (counts.get(p.bot) ?? 0) + 1);
    return [...counts].map(([id, n]) => `${n > 1 ? `${n}× ` : ""}${name(id)}`);
  };
  const rest = <span> · first to {c.targetRoundWins}</span>;
  if (c.mode === "play") return <><strong>{c.you || "You"}</strong> vs {group(c.players.slice(0, 3)).join(", ")}{rest}</>;
  if (c.mode === "watch") return <><strong>One game</strong> · {group(c.players).join(" vs ")}{rest}</>;
  return <><strong>{count(c.games)} games</strong> · {group(c.players).join(" vs ")}{rest}</>;
}

// A saved lineup can name a bot that no longer exists: swap it for the first bot.
function withKnownBots(config: SetupConfig, bots: BotInfo[] | null): SetupConfig {
  if (!bots?.length || config.players.every((p) => bots.some((b) => b.id === p.bot))) return config;
  return {
    ...config,
    players: config.players.map((p) => (bots.some((b) => b.id === p.bot) ? p : { ...p, bot: bots[0].id })),
  };
}
