import { SectionTitle } from "../../components/SectionTitle";
import { useLineupSpeeds } from "../../sims/api";
import { count, lineupKey, pct, secs } from "../../sims/format";
import type { LineupSpeed, Line, RunRecord, RunTiming, Stats, Timing } from "../../sims/types";
import { DecisionTable, ThinkByCardTable } from "./charts/ThinkTables";
import { PerfTable } from "./charts/PerfTable";
import { PhaseBar, type Phase } from "./charts/PhaseBar";
import { TimeHistogram } from "./charts/TimeHistogram";
import { TimeLines, type TimePoint } from "./charts/TimeLines";
import { Card, Kpi } from "./parts";

// The fourth section of a run's Stats page: how fast the bots think and where
// the run's time went. What every number means is in stats/tally.py's
// docstring ("Performance"); how it's measured in stats/timing.py.
//
// Think time needs the run's "Measure think time" setting; the phase split
// (playing / counting / writing LLN) is there for every run since format 4.
//
// What timing itself costs gets its own parts of the bar, striped in the colour
// of the part it was taken out of: while counting it's clocked (exact); while
// playing it can't be, so it's estimated from this run's play time per turn
// against the latest untimed run of the same lineup (see measuringPlay).
// Rows follow the page's "By player / By bot / By seat" switch.

type Row = { label: string; color: string; line: Line };
type Group = "players" | "bots" | "seats";

const MIN_TURNS = 30; // a cycle or round with fewer turns than this is left off the line charts

// stripes of a part's colour and a lighter shade of it, for what measuring
// took out of that part: clearly related, but not mistaken for another part
const lighter = (color: string) =>
  `repeating-linear-gradient(135deg, ${color} 0 3px, color-mix(in srgb, ${color} 40%, var(--surface)) 3px 6px)`;

export function PerformanceSection({ run, stats, rows, group }: { run: RunRecord; stats: Stats; rows: Row[]; group: Group }) {
  const speeds = useLineupSpeeds();
  const timing = run.timing;
  const perf = stats.performance;
  if (!timing) return null; // a run from before performance was measured
  const mPlay = perf ? measuringPlay(run, timing, speeds) : null;
  const mCount = perf?.measuringCount ?? 0;
  const mPlaySec = mPlay && mPlay.sec > 0 ? mPlay.sec : 0;

  const elapsed = timing.playSec + timing.countSec + timing.llnSec;
  const wall = run.durationSec ?? elapsed; // durationSec only once the run is over
  const phases: Phase[] = [
    ...(perf
      ? [
          { label: "Bots thinking", sec: perf.think, color: "var(--blue-4)", note: "inside the bots' own methods" },
          {
            label: "Engine",
            sec: Math.max(0, timing.playSec - perf.think - mPlaySec),
            color: "var(--primary)",
            note: mPlay ? "dealing, resolving cards, history, observers" : "dealing, resolving cards, history, observers, and the stopwatch (not measured separately, see below)",
          },
          {
            label: "Measuring · play",
            sec: mPlaySec,
            color: lighter("var(--primary)"),
            note: mPlay
              ? `estimate: ${secs(mPlay.perTurn)} more per turn than the latest untimed run of this lineup (${mPlay.date}), times ${count(timing.turns ?? 0)} turns`
              : "",
          },
        ]
      : [{ label: "Playing", sec: timing.playSec, color: "var(--primary)", note: "the games: engine and bots together (think time wasn't measured)" }]),
    { label: "Counting stats", sec: Math.max(0, timing.countSec - mCount), color: "var(--accent)", note: "Tally.add after every game: the numbers on this page" },
    { label: "Measuring · counting", sec: mCount, color: lighter("var(--accent)"), note: "adding up the think times after every game (clocked, so exact)" },
    { label: "Writing LLN", sec: timing.llnSec, color: "var(--grey-1)", note: "saving every game as compressed LLN" },
    { label: "Other", sec: Math.max(0, wall - elapsed), color: "var(--grey-2)", note: "setting up the bots, opening files" },
  ];
  const m = timing.machine;

  return (
    <section className="stats-section" aria-label="Performance">
      <SectionTitle n={4} title="Performance" note="How fast do the bots think, and where does the time go?" />
      <p className="stats__filter-note">
        Wall time on {m.cpu || "an unknown CPU"}{m.cores ? ` (${m.cores} cores)` : ""}, {m.system}, Python {m.python}.
        Times vary a little from run to run, even with the same seed: compare bots within a run, or runs on the same machine.
      </p>

      <section className="kpis" aria-label="Speed">
        <Kpi label="Games per second" value={wall > 0 ? count(Math.round(stats.games / wall)) : "–"} sub={`${secs(wall / stats.games)} a game, whole run`} />
        {perf && (
          <>
            <Kpi label="Game time" value={secs(perf.gameTime.median)} sub={`median · mean ${secs(perf.gameTime.mean)} · p95 ${secs(perf.gameTime.p95)}`} />
            <Kpi label="Round time" value={secs(perf.perRound)} sub={`mean · ${stats.roundsPerGame.mean?.toFixed(2) ?? "–"} rounds a game`} />
            <Kpi label="Bots' share" value={pct(perf.think / perf.total)} sub="of game time; the rest is the engine" />
          </>
        )}
      </section>

      <Card
        title="Where the time went"
        note="The whole run, from the first game to the last. Striped parts: what measuring think time cost, taken out of the part next to it. Hover a part for seconds."
      >
        <PhaseBar phases={phases} />
        {perf && !mPlay && (
          <p className="stats__filter-note">
            What the stopwatch costs during play is still inside Engine: run this lineup once with “Measure think time” off to measure it.
          </p>
        )}
        {mPlay && mPlay.sec <= 0 && (
          <p className="stats__filter-note">
            This run played no slower per turn than the latest untimed run of this lineup ({mPlay.date}): the stopwatch's cost is lost in the noise between runs.
          </p>
        )}
      </Card>

      {!perf ? (
        <p className="notice">
          Think time wasn't measured for this run. Turn on “Measure think time” in the setup to see it (Edit & run).
        </p>
      ) : (
        <>
          <div className="stats__columns">
            <div className="stats__column">
              <Card
                title="Think time by cycle"
                note={`Mean per turn by the turn's cycle (1 = everyone's first turn of the round). Bands are the 95% interval; cycles with fewer than ${MIN_TURNS} turns are left out.`}
              >
                <ByStep rows={rows} steps={(t) => t.byCycle.map((c) => [c.cycle, c])} name="Cycle" />
              </Card>

              <Card title="Think time by round" note="Mean per turn by round number in the game. Does a bot that remembers things between rounds get slower?">
                <ByStep rows={rows} steps={(t) => t.byRound.map((r) => [r.round, r])} name="Round" />
              </Card>
            </div>
            <div className="stats__column">
              <Card title="Game time" note="How long each game took, engine and bots together. Columns get about 26% wider to the right, so the slow tail fits.">
                {perf.gameHistogram && <TimeHistogram bins={perf.gameHistogram} median={perf.gameTime.median} p95={perf.gameTime.p95} />}
              </Card>

              <Card title="Over the run" note="Think time per turn in each stretch of the run (not cumulative). A line that climbs: a bot that slows down as it plays more games.">
                {perf.overTime && perf.overTime.length > 1 ? (
                  <TimeLines
                    xs={perf.overTime.map((p) => p.games)}
                    series={rows.map((r, i) => ({ label: r.label, color: r.color, points: perf.overTime!.map((p) => point(p[group][i])) }))}
                    xLabel={(g) => count(g)}
                    tipTitle={(g) => `Games up to ${count(g)}`}
                    ariaLabel="Think time per turn over the run"
                  />
                ) : (
                  <p className="notice">Needs a few more games.</p>
                )}
              </Card>
            </div>
          </div>

          <div className="stats__columns">
            <div className="stats__column">
              <Card title="By decision" note="Mean time per call: which card to play (every turn), which target (cards that have one), which card to name for a Guard. Stronger blue = slower.">
                <DecisionTable rows={rows} />
              </Card>
            </div>
            <div className="stats__column">
              <Card title="Game time over the run" note="Mean time per game in each stretch of the run.">
                {perf.overTime && perf.overTime.length > 1 ? (
                  <TimeLines
                    xs={perf.overTime.map((p) => p.games)}
                    series={[{ label: "Game time", color: "var(--primary)", points: perf.overTime.map((p) => point(p.gameTime)) }]}
                    xLabel={(g) => count(g)}
                    tipTitle={(g) => `Games up to ${count(g)}`}
                    ariaLabel="Time per game over the run"
                  />
                ) : (
                  <p className="notice">Needs a few more games.</p>
                )}
              </Card>
            </div>
          </div>

          <Card title="By card played" note="Mean think time per turn, by the card that ended up played. Stronger blue = slower; fewer than 20 turns aren't shaded.">
            <ThinkByCardTable rows={rows} />
          </Card>

          <Card title="Think time per turn" note="Time spent inside the bot's own methods on a turn it played. Median and p95 are accurate to about 12%.">
            <PerfTable rows={rows} />
          </Card>
        </>
      )}
    </section>
  );
}

const point = (y: number | null): TimePoint => (y == null ? null : { y });

// What the stopwatch cost while playing, estimated: this run's play time per
// turn minus that of the latest untimed run of the same lineup (same bots, same
// game length) on this machine, times this run's turns. Comparing per turn
// takes out most of the difference in game lengths between seeds; what's left
// is noise between runs (other programs, the CPU's clock speed), so it's an
// estimate, and it's only as recent as that untimed run.
function measuringPlay(run: RunRecord, timing: RunTiming, speeds: Record<string, LineupSpeed> | null) {
  const plain = speeds?.[lineupKey(run.config.players.map((p) => p.bot), run.config.targetRoundWins)]?.plain;
  if (!plain?.playUsPerTurn || !timing.turns) return null;
  const perTurn = timing.playSec / timing.turns - plain.playUsPerTurn * 1e-6;
  return { sec: perTurn * timing.turns, perTurn, date: new Date(plain.at).toLocaleDateString(undefined, { day: "numeric", month: "short" }) };
}

// Think time per turn against a step (cycle or round number), one line per row.
function ByStep({ rows, steps, name }: { rows: Row[]; steps: (t: NonNullable<Line["think"]>) => [number, Timing][]; name: string }) {
  const byRow = rows.map((r) => new Map(r.line.think ? steps(r.line.think).filter(([, t]) => t.n >= MIN_TURNS) : []));
  const xs = [...new Set(byRow.flatMap((m) => [...m.keys()]))].sort((a, b) => a - b);
  if (!xs.length) return <p className="notice">Needs a few more games.</p>;
  return (
    <TimeLines
      xs={xs}
      series={rows.map((r, i) => ({
        label: r.label,
        color: r.color,
        points: xs.map((x) => {
          const t = byRow[i].get(x);
          return t ? { y: t.mean, lo: t.lo, hi: t.hi, n: t.n } : null;
        }),
      }))}
      xLabel={String}
      tipTitle={(x) => `${name} ${x}`}
      ariaLabel={`Think time per turn by ${name.toLowerCase()}`}
    />
  );
}
