import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Header, Footer } from "../../../components/Header";
import { Field, Segmented, Stepper, Toggle } from "../../../components/Field";
import { Heart } from "../../../components/Heart";
import { SectionTitle } from "../../../components/SectionTitle";
import { initial } from "../../../components/initial";
import { BotTile, LibraryTile, SeatLabel } from "../../../components/BotTiles";
import {
  DEFAULT_CONFIG, NAME_LIMIT, loadConfig, randomSeed, saveConfig, validate,
  type Opponent, type Speed, type TableConfig, type Visibility,
} from "../config";
import { useBots, type BotInfo } from "../useBots";
import "./Setup.css";

// The setup page (/play): pick three bots and the table settings, then sit down.
//
// Layout: seats across the top (in seat order, your seat included), the bot
// library below them, and the table settings in a column on the right.
// Clicking a seat makes it "active"; clicking a bot in the library seats it there.

export default function Setup() {
  const navigate = useNavigate();
  const { bots, error: botsError, retry } = useBots();
  const [draft, setDraft] = useState<TableConfig>(loadConfig);
  const [active, setActive] = useState(0); // the opponent slot (0-2) the library fills
  const [problem, setProblem] = useState<string | null>(null);
  const ids = { name: useId(), seed: useId() };

  const config = withKnownBots(draft, bots);
  const botById = new Map((bots ?? []).map((b) => [b.id, b]));

  const update = (changes: Partial<TableConfig>) => {
    setDraft({ ...config, ...changes });
    setProblem(null);
  };
  const setOpponent = (i: number, changes: Partial<Opponent>) =>
    update({ opponents: config.opponents.map((o, j) => (j === i ? { ...o, ...changes } : o)) });

  const pickBot = (id: string) => {
    setOpponent(active, { bot: id });
    setActive((active + 1) % 3); // move on to the next seat, so three clicks fill the table
  };

  const randomLineup = () => {
    if (!bots?.length) return;
    update({
      opponents: config.opponents.map((o) => ({ ...o, bot: bots[Math.floor(Math.random() * bots.length)].id })),
    });
  };

  const sitDown = (e: FormEvent) => {
    e.preventDefault();
    const issue = bots ? validate(config) : "The bot list hasn't loaded yet.";
    if (issue) {
      setProblem(issue);
      return;
    }
    saveConfig(config);
    navigate("/play/table", { state: { start: true } });
  };

  // Seats in order. With a random seat, yours is drawn last, marked as random.
  const youAt = config.seat ?? 3;
  const seats: ({ kind: "you" } | { kind: "bot"; slot: number })[] = [0, 1, 2].map((slot) => ({ kind: "bot", slot }));
  seats.splice(youAt, 0, { kind: "you" });

  const lineupNames = config.opponents.map((o) => botById.get(o.bot)?.name ?? o.bot);

  return (
    <div className="page">
      <Header />

      <form className="setup" onSubmit={sitDown}>
        <header className="setup__head">
          <p className="setup__eyebrow">New table</p>
          <h1 className="setup__title">Set the table</h1>
          <p className="setup__intro">Pick three bots to play against and choose the house rules.</p>
        </header>

        {/* ----- Seats ----- */}
        <section className="setup__seats" aria-label="Seats">
          <SectionTitle n={1} title="Seats" note="Seat 1 deals the first round; seat 2 starts." />
          <div className="seats">
            {seats.map((s, i) =>
              s.kind === "you" ? (
                <YouTile
                  key="you"
                  seat={i}
                  random={config.seat === null}
                  name={config.you}
                  onName={(you) => update({ you })}
                  onMove={(d) => update({ seat: youAt + d })}
                />
              ) : (
                <BotTile
                  key={s.slot}
                  seat={i}
                  opponent={config.opponents[s.slot]}
                  bot={botById.get(config.opponents[s.slot].bot)}
                  active={active === s.slot}
                  onActivate={() => setActive(s.slot)}
                  onName={(name) => setOpponent(s.slot, { name })}
                />
              ),
            )}
          </div>
        </section>

        {/* ----- Bot library ----- */}
        <section className="setup__bots" aria-label="Bots">
          <SectionTitle
            n={2}
            title="Bots"
            note={<>Choosing for <strong>{config.opponents[active].name || `opponent ${active + 1}`}</strong>. Click a bot to seat it.</>}
            action={
              <button type="button" className="ghost-btn" onClick={randomLineup} disabled={!bots?.length}>
                Random lineup
              </button>
            }
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
                  selected={config.opponents[active].bot === b.id}
                  seatedAt={seats.flatMap((s, i) => (s.kind === "bot" && config.opponents[s.slot].bot === b.id ? [i + 1] : []))}
                  onPick={() => pickBot(b.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ----- Table settings ----- */}
        <aside className="setup__settings" aria-label="Table settings">
          <div className="settings">
            <SectionTitle n={3} title="Table" />

            <Field label="Table name" htmlFor={ids.name}>
              <input
                id={ids.name}
                className="input"
                value={config.name}
                maxLength={40}
                placeholder={DEFAULT_CONFIG.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </Field>

            <Field label="Round wins to win" hint="Ties at the target raise it by one, so there's always a single winner.">
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

            <Field
              label="Deck seed"
              htmlFor={ids.seed}
              hint="The same seed deals the same cards, round for round. Leave empty for fresh shuffles."
              aside={
                <button type="button" className="link-btn" onClick={() => update({ deckSeed: randomSeed() })}>
                  Roll one
                </button>
              }
            >
              <input
                id={ids.seed}
                className="input input--mono"
                value={config.deckSeed}
                maxLength={40}
                placeholder="random"
                onChange={(e) => update({ deckSeed: e.target.value })}
              />
            </Field>

            <Field label="Your seat">
              <Toggle checked={config.seat === null} onChange={(random) => update({ seat: random ? null : 3 })}>
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
          </div>

          <div className="start">
            <p className="start__summary">
              <strong>{config.you || "You"}</strong> vs {lineupNames.join(", ")}
              <span> · first to {config.targetRoundWins}</span>
            </p>
            {problem && <p className="start__problem" role="alert">{problem}</p>}
            <div className="start__actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setDraft(DEFAULT_CONFIG);
                  setActive(0);
                  setProblem(null);
                }}
              >
                Reset
              </button>
              <button type="submit" className="start__btn" disabled={!bots}>
                Sit down <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </aside>
      </form>

      <Footer />
    </div>
  );
}

// A saved lineup can name a bot that no longer exists (renamed or deleted file):
// swap those for the first bot, so the page never shows a seat without a bot.
function withKnownBots(config: TableConfig, bots: BotInfo[] | null): TableConfig {
  if (!bots?.length || config.opponents.every((o) => bots.some((b) => b.id === o.bot))) return config;
  return {
    ...config,
    opponents: config.opponents.map((o) => (bots.some((b) => b.id === o.bot) ? o : { ...o, bot: bots[0].id })),
  };
}

function YouTile({ seat, random, name, onName, onMove }: {
  seat: number;
  random: boolean;
  name: string;
  onName: (name: string) => void;
  onMove: (delta: number) => void;
}) {
  return (
    <div className={`tile tile--you ${random ? "tile--random" : ""}`}>
      {random ? (
        <div className="tile__top"><span className="tile__seat">Seat ?</span><span className="tile__tag">Random</span></div>
      ) : (
        <SeatLabel seat={seat} />
      )}
      <div className="tile__identity">
        <span className="tile__avatar" aria-hidden="true">{initial(name, "Y")}</span>
        <input
          className="tile__name"
          value={name}
          maxLength={NAME_LIMIT}
          aria-label="Your name"
          onChange={(e) => onName(e.target.value)}
        />
      </div>
      <div className="tile__foot">
        <span className="tile__bot">You</span>
        {!random && (
          <span className="tile__move">
            <button type="button" onClick={() => onMove(-1)} disabled={seat === 0} aria-label="Move one seat left">←</button>
            <button type="button" onClick={() => onMove(1)} disabled={seat === 3} aria-label="Move one seat right">→</button>
          </span>
        )}
      </div>
    </div>
  );
}

