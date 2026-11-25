import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Header, Footer } from "../../components/Header";
import { Segmented } from "../../components/Field";
import { SectionTitle } from "../../components/SectionTitle";
import { deleteRun, llnUrl, renameRun, startRun, useRun } from "../../sims/api";
import { count, duration, editable, lineLabel, lineupText, pct, rateText, seriesColor, when } from "../../sims/format";
import { isActive, type Line, type RunRecord, type Stats } from "../../sims/types";
import { RateBars } from "./charts/RateBars";
import { ConvergenceChart } from "./charts/ConvergenceChart";
import { Histogram } from "./charts/Histogram";
import { BaronBars } from "./charts/BaronBars";
import { LossTable } from "./charts/LossTable";
import { GuardOdds } from "./charts/GuardOdds";
import { CardChoices } from "./charts/CardChoices";
import { BaronByCardTable, StartCardTable } from "./charts/CardTables";
import { PerformanceSection } from "./Performance";
import { Card, Kpi } from "./parts";
import "./charts/charts.css";
import "./Stats.css";

// One simulation's stats (/stats/<id>). While the run is going, useRun polls
// and every chart redraws with the games so far.
//
// "By player" shows each player; "By bot" sums the players that use the same
// bot (only offered when some bot has more than one seat); "By seat" sums
// whoever sat in each seat.

type Group = "players" | "bots" | "seats";

const GROUP_NOTES: Record<Group, string> = {
  players: "",
  bots: "A bot's games count once per seat; its win rate is per seat.",
  seats: "Seat 1 deals the first round of each game, seat 2 moves first in it. Later rounds start with the last winner, see Turn order.",
};

export default function Results() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { run, error, setRun } = useRun(id);
  const [group, setGroup] = useState<Group>("players");
  const [problem, setProblem] = useState<string | null>(null);

  if (error || !run) {
    return (
      <Shell>
        <div className="stats__message">
          {error ? <p className="notice">{error}</p> : <p className="notice">Loading…</p>}
          <Link to="/stats" className="link-btn">All runs</Link>
        </div>
      </Shell>
    );
  }

  const stats = run.stats;
  const hasDuplicates = new Set(run.config.players.map((p) => p.bot)).size < run.config.players.length;
  const shown: Group = group === "bots" && !hasDuplicates ? "players" : group;
  const lines = stats ? stats[shown] : [];
  const rows = lines.map((line, i) => ({ line, label: lineLabel(line, run), color: seriesColor(i) }));

  const act = (fn: () => Promise<unknown>) => () => {
    setProblem(null);
    fn().catch((e: Error) => setProblem(e.message));
  };
  // same games: keep the seed, but a lineup name the server made stays automatic
  const runAgain = act(async () => navigate(`/stats/${(await startRun({ ...editable(run.config), seed: run.config.seed })).id}`));
  const remove = act(async () => {
    const msg = isActive(run) ? "Stop this simulation? Its results are thrown away." : `Delete “${run.config.name}” from the history?`;
    if (!window.confirm(msg)) return;
    await deleteRun(run.id);
    navigate("/stats");
  });
  const rename = (name: string) => {
    if (!name.trim() || name === run.config.name) return;
    renameRun(run.id, name).then(setRun).catch((e: Error) => setProblem(e.message));
  };

  return (
    <Shell>
      <div className="stats">
        <header className="stats__head">
          <div className="stats__titles">
            <p className="stats__eyebrow">
              <Link to="/stats">History</Link> / {when(run.createdAt)}
            </p>
            <input
              key={run.config.name}
              className="stats__title"
              defaultValue={run.config.name}
              maxLength={60}
              aria-label="Run name"
              onBlur={(e) => rename(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
            <p className="stats__lineup">{lineupText(run)}</p>
          </div>

          <div className="stats__aside">
            <div className="table__chips">
              <span className="chip">First to {run.config.targetRoundWins}</span>
              <span className="chip">{run.config.rotateSeats ? "Seats rotate" : "Fixed seats"}</span>
              <span className="chip">Seed · {run.config.seed}</span>
              {run.config.measureTime && <span className="chip">Think time measured</span>}
              {run.durationSec != null && <span className="chip">{duration(run.durationSec)}</span>}
            </div>
            <div className="controls">
              <button type="button" className="btn btn--primary" onClick={runAgain}>Run again</button>
              <button type="button" className="btn" onClick={() => navigate("/new", { state: { run: run.config } })}>
                Edit & run
              </button>
              {run.hasLln && (
                <a className="btn" href={llnUrl(run.id)} download title="Plain-text .lln; kept compressed on disk">
                  Download LLN
                </a>
              )}
              <button type="button" className="btn" onClick={remove}>{isActive(run) ? "Stop" : "Delete"}</button>
            </div>
          </div>
        </header>

        {problem && <p className="stats__problem" role="alert">{problem}</p>}
        <Progress run={run} />

        {stats && (
          <>
            <section className="kpis" aria-label="Totals">
              <Kpi label="Games simulated" value={count(stats.games)} sub={isActive(run) ? `of ${count(run.config.games)}` : undefined} />
              <Kpi label="Rounds played" value={count(stats.rounds)} />
              <Kpi
                label="Rounds per game"
                value={stats.roundsPerGame.mean?.toFixed(2) ?? "–"}
                sub={`shortest ${stats.roundsPerGame.min}, longest ${stats.roundsPerGame.max}`}
              />
              <Kpi label="Tied rounds" value={count(stats.tiedRounds)} sub={`${pct(stats.tiedRounds / stats.rounds)} of rounds, a win for each`} />
            </section>

            <div className="stats__filters">
              <Segmented<Group>
                label="Group"
                value={shown}
                onChange={setGroup}
                options={[
                  { value: "players", label: "By player" },
                  ...(hasDuplicates ? [{ value: "bots" as const, label: "By bot" }] : []),
                  { value: "seats", label: "By seat" },
                ]}
              />
              {GROUP_NOTES[shown] && <span className="stats__filter-note">{GROUP_NOTES[shown]}</span>}
            </div>

            {/* Sections follow the README's stat categories. Inside a section, two
                independent columns: a card sits right under the one above it. */}
            <section className="stats-section" aria-label="Outcome">
              <SectionTitle n={1} title="Outcome" note="Did the bot win, and how?" />
              <div className="stats__columns">
                <div className="stats__column">
                  <Card
                    title="Game win rate"
                    note="Games won. Lines show the 95% interval; the vertical line is a fair 1 in 4."
                  >
                    <RateBars
                      reference={0.25}
                      referenceLabel="25%"
                      rows={rows.map((r) => ({
                        ...r,
                        rate: r.line.gameWinRate,
                        detail: `${count(r.line.gameWins)} of ${count(r.line.games)} games`,
                      }))}
                    />
                  </Card>

                  <Card title="Round win rate" note="Rounds won. A tied showdown counts as a win for everyone in the tie.">
                    <RateBars
                      reference={0.25}
                      referenceLabel="25%"
                      rows={rows.map((r) => ({
                        ...r,
                        rate: r.line.roundWinRate,
                        detail: `${count(r.line.roundWins)} of ${count(r.line.rounds)} rounds`,
                      }))}
                    />
                  </Card>
                </div>
                <div className="stats__column">
                  <Card title="Win rate over the run" note="Has it settled? Bands are the 95% interval so far.">
                    {stats.convergence && stats.convergence.length > 1 ? (
                      <ConvergenceChart
                        reference={0.25}
                        games={stats.convergence.map((pt) => pt.games)}
                        series={rows.map((r, i) => ({ label: r.label, color: r.color, points: stats.convergence!.map((pt) => pt[shown][i]) }))}
                      />
                    ) : (
                      <p className="notice">Needs a few more games.</p>
                    )}
                  </Card>
                </div>
              </div>

              <Card title="Cause of rejection" note="How each lost round was lost. Hover a cell for counts.">
                <LossTable rows={rows} />
              </Card>
            </section>

            <section className="stats-section" aria-label="Play">
              <SectionTitle n={2} title="Play" note="What did the bot actually do?" />
              <div className="stats__columns">
                <div className="stats__column">
                  <Card title="Guard accuracy" note="Correct guesses out of guesses checked. Guards on a protected player don't count.">
                    <RateBars
                      rows={rows.map((r) => ({
                        ...r,
                        rate: r.line.guard.accuracy,
                        detail: `${count(r.line.guard.correct)} of ${count(r.line.guard.correct + r.line.guard.incorrect)} guesses right · ${count(r.line.guard.protected)} on a protected player`,
                      }))}
                    />
                  </Card>

                  <Card
                    title="Guard guesses vs the odds"
                    note="Odds from what the guesser could see: the deck minus their own cards and all discards. Right: how often it named the likeliest card."
                  >
                    <GuardOdds rows={rows} />
                  </Card>

                  <Card
                    title="Priest follow-up"
                    note="Chances to use a Priest look on the next turn (a Guard, or a Baron that wins, against a player still holding the seen card), and how often it was taken."
                  >
                    <RateBars
                      rows={rows.map((r) => ({
                        ...r,
                        rate: r.line.priest.takenRate,
                        detail: `${count(r.line.priest.taken)} of ${count(r.line.priest.chances)} chances taken · ${count(r.line.priest.looks)} Priest looks`,
                      }))}
                    />
                  </Card>
                </div>
                <div className="stats__column">
                  <Card title="Baron comparisons" note="Outcomes of the Barons each player played. Right: Barons played.">
                    <BaronBars rows={rows} />
                  </Card>

                  <Card
                    title="Baron by card kept"
                    note="Comparisons won, by the card kept beside the Baron. Hover for won / tied / lost / protected."
                  >
                    <BaronByCardTable rows={rows} />
                  </Card>
                </div>
              </div>

              <Card
                title="Card choices"
                note="Which card gets played from each pair held. Switch to 'Won the round' and read down a column to find the best play with that card in hand."
              >
                <CardChoices rows={rows} />
              </Card>
            </section>

            <section className="stats-section" aria-label="Context">
              <SectionTitle n={3} title="Context" note="How far can we trust these numbers?" />
              <div className="stats__columns">
                <div className="stats__column">
                  <Card
                    title="Turn order"
                    note="Round win rate by when you move in the round, whoever moves. The game's own first-mover advantage: why seats rotate."
                  >
                    <RateBars
                      reference={0.25}
                      referenceLabel="25%"
                      rows={stats.turnOrder.map((t) => ({
                        label: ORDINALS[t.position] ?? `${t.position + 1}th`,
                        color: "var(--primary)",
                        rate: t.roundWinRate,
                        detail: `${count(t.roundWins)} of ${count(t.rounds)} rounds`,
                      }))}
                    />
                  </Card>
                </div>
                <div className="stats__column">
                  <Card title="Rounds per game" note={`How long games lasted, first to ${run.config.targetRoundWins}.`}>
                    <Histogram data={stats.roundsPerGame.histogram} unit="rounds" />
                  </Card>
                </div>
              </div>

              <Card
                title="Start card"
                note="Round win rate by the card dealt: how much the deal decides. Shaded against the player's own overall rate (blue = helps, red = hurts)."
              >
                <StartCardTable rows={rows} />
              </Card>

              <Card title="All numbers">
                <NumbersTable rows={rows} stats={stats} />
              </Card>
            </section>

            <PerformanceSection run={run} stats={stats} rows={rows} group={shown} />
          </>
        )}
      </div>
    </Shell>
  );
}

const ORDINALS = ["Moves 1st", "Moves 2nd", "Moves 3rd", "Moves 4th (dealer)"];

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="page">
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  );
}

function Progress({ run }: { run: RunRecord }) {
  if (run.status === "outdated") {
    return (
      <p className="notice">
        This run was saved by an older version of the stats (format {run.savedFormat}), so its numbers aren't shown.
        Its settings and seed are kept: Run again plays the same games and works them out the current way
        (as long as the bots haven't changed since).
      </p>
    );
  }
  if (run.status === "failed") {
    return <p className="stats__problem" role="alert">This run stopped with an error: {run.error}</p>;
  }
  if (!isActive(run)) return null;
  const { done, total } = run.progress;
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      <div className="progress__text">
        <strong>{run.status === "queued" ? "Waiting for the run ahead…" : "Simulating…"}</strong>
        <span>{count(done)} / {count(total)} games</span>
      </div>
      <div className="progress__track">
        <div className="progress__fill" style={{ width: `${(done / total) * 100}%` }} />
      </div>
    </div>
  );
}

// Every number in one table: the "table view" behind the charts.
function NumbersTable({ rows, stats }: { rows: { label: string; color: string; line: Line }[]; stats: Stats }) {
  return (
    <div className="numbers-wrap">
      <table className="numbers">
        <thead>
          <tr>
            <th />
            <th>Games</th>
            <th>Won</th>
            <th>Game win rate (95%)</th>
            <th>Rounds</th>
            <th>Won</th>
            <th>Round win rate (95%)</th>
            <th>Guards</th>
            <th>Guard accuracy (95%)</th>
            <th>Barons W / T / P / L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, color, line }) => (
            <tr key={label}>
              <th scope="row"><span className="swatch" style={{ background: color }} />{label}</th>
              <td>{count(line.games)}</td>
              <td>{count(line.gameWins)}</td>
              <td>{rateText(line.gameWinRate)}</td>
              <td>{count(line.rounds)}</td>
              <td>{count(line.roundWins)}</td>
              <td>{rateText(line.roundWinRate)}</td>
              <td>{count(line.guard.played)}</td>
              <td>{rateText(line.guard.accuracy)}</td>
              <td>{[line.baron.won, line.baron.tied, line.baron.protected, line.baron.lost].map(count).join(" / ")}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td>{count(stats.games)}</td>
            <td />
            <td />
            <td>{count(stats.rounds)}</td>
            <td />
            <td />
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
