import { Link, useLocation } from "react-router-dom";
import { Header, Footer } from "../../components/Header";
import type { SimulationResult } from "../../types";
import "./Stats.css";

const chartColors = ["#5e6140", "#a47c4c", "#777c9a", "#b16e56"];

function percentage(value: number | null | undefined) {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function downloadCsv(result: SimulationResult) {
  const rows = [
    [
      "Player",
      "Bot",
      "Games",
      "Game wins",
      "Game win rate",
      "95% CI low",
      "95% CI high",
      "Round wins",
      "Rounds",
      "Round win rate",
    ],
    ...result.leaderboard.map((entry) => {
      const bot = result.run.players.find((player) => player.name === entry.player);
      return [
        entry.player,
        bot?.botName ?? "",
        String(entry.games),
        String(entry.wins),
        percentage(entry.winrate),
        percentage(entry.ciLow),
        percentage(entry.ciHigh),
        String(entry.roundWins),
        String(entry.rounds),
        percentage(entry.roundWinrate),
      ];
    }),
  ];
  const csv = rows.map((row) =>
    row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
  ).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "love-letter-simulation-stats.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function PanelHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="stats-panel__heading">
      <div>
        <p className="stats-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function WinRateChart({ result }: { result: SimulationResult }) {
  const checkpoints = [...new Set(result.winrateHistory.map((point) => point.gameCount))].sort((a, b) => a - b);
  const maxRate = Math.max(0.1, ...result.winrateHistory.map((point) => point.winrate));
  const scaleMax = Math.min(1, Math.ceil(maxRate * 10) / 10);
  const series = result.run.players.map((player, index) => {
    const points = checkpoints.map((count, pointIndex) => {
      const value = result.winrateHistory.find(
        (point) => point.player === player.name && point.gameCount === count,
      )?.winrate ?? 0;
      const x = 36 + (pointIndex / Math.max(1, checkpoints.length - 1)) * 384;
      const y = 150 - (value / scaleMax) * 136;
      return { x, y };
    });
    return {
      name: player.name,
      color: chartColors[index % chartColors.length],
      points: points.map((point) => `${point.x},${point.y}`).join(" "),
      dots: points,
    };
  });

  return (
    <div className="stats-chart">
      <div className="stats-chart__legend" aria-label="Player legend">
        {series.map((player) => (
          <span className="stats-chart__legend-item" key={player.name}>
            <i style={{ backgroundColor: player.color }} />
            {player.name}
          </span>
        ))}
      </div>
      <svg
        className="stats-chart__svg"
        viewBox="0 0 440 184"
        role="img"
        aria-label={`Cumulative game win rate over ${result.run.games.toLocaleString()} simulated games`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = 150 - fraction * 136;
          return (
            <g key={fraction}>
              <line x1="36" x2="420" y1={y} y2={y} className="stats-chart__grid" />
              <text x="0" y={y + 4} className="stats-chart__axis-label">
                {Math.round(scaleMax * fraction * 100)}%
              </text>
            </g>
          );
        })}
        {checkpoints.map((count, index) => {
          const x = 36 + (index / Math.max(1, checkpoints.length - 1)) * 384;
          return (
            <text key={count} x={x} y="174" textAnchor="middle" className="stats-chart__axis-label">
              {count.toLocaleString()}
            </text>
          );
        })}
        {series.map((player) => (
          <g key={player.name}>
            <polyline
              points={player.points}
              fill="none"
              stroke={player.color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {player.dots.map((point, index) => (
              <circle key={`${player.name}-${index}`} cx={point.x} cy={point.y} r="3" fill={player.color} />
            ))}
          </g>
        ))}
      </svg>
      <p className="stats-chart__caption">Completed games · cumulative game win rate</p>
    </div>
  );
}

function UsageList({
  rows,
}: {
  rows: { card: string; count: number; share: number }[];
}) {
  const maximumShare = Math.max(0.01, ...rows.map((card) => card.share));
  return (
    <div className="stats-usage__list">
      {rows.map((card) => (
        <div className="stats-usage__row" key={card.card}>
          <span>{card.card}</span>
          <span className="stats-usage__track">
            <i style={{ width: `${(card.share / maximumShare) * 100}%` }} />
          </span>
          <strong>{card.count.toLocaleString()}</strong>
          <em>{percentage(card.share)}</em>
        </div>
      ))}
      {rows.length === 0 && <p className="stats-panel__footnote">No data recorded.</p>}
    </div>
  );
}

export default function Stats() {
  const location = useLocation();
  const result = (location.state as { result?: SimulationResult } | null)?.result;

  if (!result) {
    return (
      <div className="stats-page">
        <Header />
        <main className="stats-main">
          <section className="stats-intro">
            <div>
              <p className="stats-eyebrow">SIMULATION LAB <span> / </span> PERFORMANCE</p>
              <h1>Statistics</h1>
              <p className="stats-intro__copy">Run an experiment to see its results and detailed metrics here.</p>
            </div>
          </section>
          <section className="stats-context">
            <div className="stats-context__icon" aria-hidden="true">i</div>
            <div>
              <strong>No simulation results yet</strong>
              <p>Configure the bots and match settings, then run a simulation to populate this dashboard.</p>
            </div>
            <Link to="/simulate">Set up a simulation →</Link>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  const topPlayer = result.leaderboard[0];
  const leaderMargin = topPlayer && result.leaderboard[1]
    ? (topPlayer.winrate - result.leaderboard[1].winrate) * 100
    : null;
  const overallGuardAccuracy = result.summary.guardAttempts > 0
    ? result.summary.guardCorrect / result.summary.guardAttempts
    : null;

  return (
    <div className="stats-page">
      <Header />
      <main className="stats-main">
        <section className="stats-intro">
          <div>
            <p className="stats-eyebrow">SIMULATION LAB <span> / </span> PERFORMANCE</p>
            <h1>Statistics</h1>
            <p className="stats-intro__copy">
              Results and metrics calculated from the games in this simulation.
            </p>
          </div>
          <div className="stats-intro__actions">
            <Link className="stats-new-run" to="/simulate">New simulation</Link>
            <button className="stats-export" type="button" onClick={() => downloadCsv(result)}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 2.5v9m0 0 3.5-3.5M10 11.5 6.5 8M3.5 13v3.5h13V13" />
              </svg>
              Export results
            </button>
          </div>
        </section>

        <section className="stats-run" aria-label="Simulation details">
          <div className="stats-run__status"><span /> SIMULATION COMPLETE</div>
          <div className="stats-run__details">
            <strong>{result.run.games.toLocaleString()} games · first to {result.run.targetRoundWins} round wins</strong>
            <span>
              {result.run.players.length} players <b>·</b>
              {result.run.rotateSeats ? " seats rotated" : " fixed seats"} <b>·</b>
              {result.run.seed == null ? " random seed" : ` seed ${result.run.seed}`}
            </span>
          </div>
          <div className="stats-run__date">{(result.run.durationMs / 1000).toFixed(2)}s <span>·</span> elapsed</div>
        </section>

        <section className="stats-kpis" aria-label="Simulation highlights">
          <article className="stats-kpi stats-kpi--lead">
            <span className="stats-kpi__label">Top strategy</span>
            <strong>{topPlayer?.player ?? "—"}</strong>
            <span className="stats-kpi__note">
              {topPlayer ? `${percentage(topPlayer.winrate)} game win rate` : "No games recorded"}
              {leaderMargin != null ? ` · +${leaderMargin.toFixed(1)} pts` : ""}
            </span>
          </article>
          <article className="stats-kpi">
            <span className="stats-kpi__label">Games simulated</span>
            <strong>{result.summary.games.toLocaleString()}</strong>
            <span className="stats-kpi__note">{(result.summary.games * result.run.players.length).toLocaleString()} player-game results</span>
          </article>
          <article className="stats-kpi">
            <span className="stats-kpi__label">Rounds played</span>
            <strong>{result.summary.rounds.toLocaleString()}</strong>
            <span className="stats-kpi__note">
              {result.summary.games
                ? `${(result.summary.rounds / result.summary.games).toFixed(2)} rounds per game`
                : "No rounds recorded"}
            </span>
          </article>
          <article className="stats-kpi">
            <span className="stats-kpi__label">Guard accuracy</span>
            <strong>{percentage(overallGuardAccuracy)}</strong>
            <span className="stats-kpi__note">{result.summary.guardAttempts.toLocaleString()} valid guesses</span>
          </article>
        </section>

        <section className="stats-primary-grid">
          <article className="stats-panel stats-leaderboard">
            <PanelHeading eyebrow="OUTCOME · GAME WIN RATE" title="Bot leaderboard" />
            <div className="stats-table-wrap">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th scope="col">Player / bot</th>
                    <th scope="col">Game win rate</th>
                    <th scope="col">Wins</th>
                    <th scope="col">95% confidence interval</th>
                    <th scope="col">Round win rate</th>
                  </tr>
                </thead>
                <tbody>
                  {result.leaderboard.map((bot, index) => (
                    <tr key={bot.player} className={index === 0 ? "stats-table__leader" : undefined}>
                      <th scope="row">
                        <span className="stats-bot-name">{bot.player}</span>
                        <span className="stats-bot-style">
                          {result.run.players.find((player) => player.name === bot.player)?.botName}
                        </span>
                      </th>
                      <td>
                        <span className="stats-rate">{percentage(bot.winrate)}</span>
                        <span className="stats-inline-track">
                          <i style={{
                            width: `${Math.min(100, bot.winrate * result.run.players.length * 100)}%`,
                            backgroundColor: chartColors[index % chartColors.length],
                          }} />
                        </span>
                      </td>
                      <td>{bot.wins.toLocaleString()}</td>
                      <td className="stats-interval">{percentage(bot.ciLow)}–{percentage(bot.ciHigh)}</td>
                      <td>{percentage(bot.roundWinrate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="stats-panel__footnote">Game win rates include the 95% Wilson score interval. Round win rate is shown separately.</p>
          </article>

          <article className="stats-panel stats-trend">
            <PanelHeading eyebrow="CONSISTENCY" title="Win rate over time" />
            <WinRateChart result={result} />
          </article>
        </section>

        <section className="stats-secondary-grid">
          <article className="stats-panel">
            <PanelHeading eyebrow="OUTCOME · REJECTIONS" title="How players were rejected" />
            <div className="stats-rejection-bar" aria-label="Rejections by cause">
              {result.rejections.byCause.map((cause, index) => (
                <span
                  key={cause.category}
                  className={`stats-rejection-bar__segment stats-rejection-bar__segment--${["olive", "sand", "clay", "ink"][index % 4]}`}
                  style={{ width: `${cause.share * 100}%` }}
                  title={`${cause.category}: ${percentage(cause.share)}`}
                />
              ))}
            </div>
            <ul className="stats-breakdown">
              {result.rejections.byCause.map((cause, index) => (
                <li key={cause.category}>
                  <span className={`stats-breakdown__dot stats-breakdown__dot--${["olive", "sand", "clay", "ink"][index % 4]}`} />
                  <span>{cause.category}</span>
                  <strong>{cause.count.toLocaleString()}</strong>
                  <em>{percentage(cause.share)}</em>
                </li>
              ))}
              {result.rejections.byCause.length === 0 && <li>No players were rejected.</li>}
            </ul>
            <div className="stats-rejection-context">
              <span>
                <small>Most common timing</small>
                <strong>
                  {result.rejections.byCycle[0]
                    ? `Cycle ${result.rejections.byCycle[0].cycle} · ${percentage(result.rejections.byCycle[0].share)}`
                    : "No rejections"}
                </strong>
              </span>
              <span>
                <small>Top rejector</small>
                <strong>{result.rejections.byAttacker[0]?.attacker ?? "—"}</strong>
              </span>
              <span>
                <small>Most rejected</small>
                <strong>{result.rejections.byVictim[0]?.victim ?? "—"}</strong>
              </span>
              <span>
                <small>Self-inflicted</small>
                <strong>
                  {(result.rejections.selfInflicted.find((item) => item.self_inflicted)?.count ?? 0).toLocaleString()}
                </strong>
              </span>
            </div>
            <p className="stats-panel__footnote">{result.summary.rejections.toLocaleString()} rejection events across all simulated games.</p>
          </article>

          <article className="stats-panel">
            <PanelHeading eyebrow="PLAY · DECISION QUALITY" title="Guard guess accuracy" />
            <div className="stats-accuracy">
              <div
                className="stats-accuracy__ring"
                style={{
                  background: `conic-gradient(#73794b 0 ${overallGuardAccuracy ? overallGuardAccuracy * 100 : 0}%, #e8e6dd ${overallGuardAccuracy ? overallGuardAccuracy * 100 : 0}% 100%)`,
                }}
              >
                <strong>{percentage(overallGuardAccuracy)}</strong>
              </div>
              <div>
                <strong>{result.summary.guardCorrect.toLocaleString()} correct</strong>
                <p>Protected targets are excluded from valid guesses.</p>
              </div>
            </div>
            <div className="stats-table-wrap">
              <table className="stats-table">
                <thead><tr><th scope="col">Player</th><th scope="col">Attempts</th><th scope="col">Correct</th><th scope="col">Accuracy</th></tr></thead>
                <tbody>
                  {result.guards.map((guard) => (
                    <tr key={guard.player}>
                      <th scope="row">{guard.player}</th>
                      <td>{guard.attempts.toLocaleString()}</td>
                      <td>{guard.correct.toLocaleString()}</td>
                      <td>{percentage(guard.accuracy)}</td>
                    </tr>
                  ))}
                  {result.guards.length === 0 && <tr><td colSpan={4}>No valid Guard guesses recorded.</td></tr>}
                </tbody>
              </table>
            </div>
          </article>

          <article className="stats-panel">
            <PanelHeading eyebrow="PLAY · BARON COMPARISONS" title="Baron outcomes by player" />
            <div className="stats-table-wrap">
              <table className="stats-table">
                <thead>
                  <tr><th scope="col">Player</th><th scope="col">Attempts</th><th scope="col">Won</th><th scope="col">Tied</th><th scope="col">Lost</th></tr>
                </thead>
                <tbody>
                  {result.barons.map((baron) => (
                    <tr key={baron.player}>
                      <th scope="row">{baron.player}</th>
                      <td>{baron.attempts.toLocaleString()}</td>
                      <td>{percentage(baron.win_rate)}</td>
                      <td>{percentage(baron.tie_rate)}</td>
                      <td>{percentage(baron.loss_rate)}</td>
                    </tr>
                  ))}
                  {result.barons.length === 0 && <tr><td colSpan={5}>No Baron comparisons recorded.</td></tr>}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <section className="stats-detail-grid">
          <article className="stats-panel stats-usage">
            <PanelHeading eyebrow="PLAY · CARD CHOICES" title="Cards played" />
            <UsageList rows={result.cardUsage} />
          </article>

          <article className="stats-panel stats-usage">
            <PanelHeading eyebrow="CONTEXT · DRAWN CARDS" title="Cards drawn" />
            <UsageList rows={result.cardsDrawn} />
          </article>

          <article className="stats-panel stats-seats">
            <PanelHeading eyebrow="CONTEXT · SEAT EFFECT" title="Round win rate by seat" />
            <div className="stats-table-wrap">
              <table className="stats-table stats-table--seats">
                <thead>
                  <tr>
                    <th scope="col">Player</th>
                    {Array.from({ length: result.run.players.length }, (_, seat) => (
                      <th scope="col" key={seat}>Seat {seat + 1}</th>
                    ))}
                    <th scope="col">Dealer</th>
                  </tr>
                </thead>
                <tbody>
                  {result.run.players.map((player) => {
                    const dealer = result.dealerWinrates.find((item) => item.player === player.name);
                    return (
                      <tr key={player.name}>
                        <th scope="row"><span className="stats-bot-name">{player.name}</span></th>
                        {Array.from({ length: result.run.players.length }, (_, seat) => {
                          const entry = result.seatWinrates.find(
                            (item) => item.player === player.name && item.seat === seat,
                          );
                          return <td key={seat}>{percentage(entry?.winrate)}</td>;
                        })}
                        <td>{percentage(dealer?.winrate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="stats-panel__footnote">Seat and dealer figures are round win rates; rotating seats can reduce position bias.</p>
          </article>

          <article className="stats-panel">
            <PanelHeading eyebrow="CONTEXT · SAMPLE SIZE" title="Experiment details" />
            <ul className="stats-breakdown stats-run-metrics">
              <li><span>Turns recorded</span><strong>{result.summary.turns.toLocaleString()}</strong></li>
              <li><span>Rounds recorded</span><strong>{result.summary.rounds.toLocaleString()}</strong></li>
              <li><span>Seat rotation</span><strong>{result.run.rotateSeats ? "On" : "Off"}</strong></li>
              <li><span>Random seed</span><strong>{result.run.seed ?? "Not specified"}</strong></li>
              <li><span>Target</span><strong>First to {result.run.targetRoundWins}</strong></li>
            </ul>
            <p className="stats-panel__footnote">All metrics above are calculated from this run’s game histories and constructed datasets.</p>
          </article>

          <article className="stats-panel">
            <PanelHeading eyebrow="OUTCOME · SHOWDOWNS" title="Showdown results" />
            <div className="stats-table-wrap">
              <table className="stats-table">
                <thead>
                  <tr><th scope="col">Player</th><th scope="col">Showdowns</th><th scope="col">Won</th><th scope="col">Tied</th><th scope="col">Lost</th></tr>
                </thead>
                <tbody>
                  {result.showdowns.map((showdown) => (
                    <tr key={showdown.player}>
                      <th scope="row">{showdown.player}</th>
                      <td>{showdown.showdowns.toLocaleString()}</td>
                      <td>{percentage(showdown.win_rate)}</td>
                      <td>{percentage(showdown.tie_rate)}</td>
                      <td>{percentage(showdown.loss_rate)}</td>
                    </tr>
                  ))}
                  {result.showdowns.length === 0 && <tr><td colSpan={5}>No showdowns recorded.</td></tr>}
                </tbody>
              </table>
            </div>
          </article>

          <article className="stats-panel">
            <PanelHeading eyebrow="PLAY · PRINCE DECISIONS" title="Prince discards Princess" />
            <div className="stats-table-wrap">
              <table className="stats-table">
                <thead><tr><th scope="col">Player</th><th scope="col">Self-discarded Princess</th></tr></thead>
                <tbody>
                  {result.princeSuicides.map((entry) => (
                    <tr key={entry.player}>
                      <th scope="row">{entry.player}</th>
                      <td>{entry.count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </main>
      <Footer />
    </div>
  );
}
