import { Header, Footer } from "../../components/Header";
import "./Stats.css";

type BotStats = {
  name: string;
  style: string;
  wins: number;
  winRate: number;
  interval: [number, number];
  roundWinRate: number;
  guardAccuracy: number;
  guardAttempts: number;
  baron: { wins: number; ties: number; losses: number };
  seatWinRates: number[];
  dealerWinRate: number;
};

const bots: BotStats[] = [
  {
    name: "Card Counter",
    style: "Information-first",
    wins: 3_218,
    winRate: 32.18,
    interval: [31.27, 33.1],
    roundWinRate: 31.7,
    guardAccuracy: 41.2,
    guardAttempts: 6_940,
    baron: { wins: 48.1, ties: 10.2, losses: 41.7 },
    seatWinRates: [31.2, 32.8, 32.6, 32.1],
    dealerWinRate: 32.6,
  },
  {
    name: "Patient Prince",
    style: "Risk-aware",
    wins: 2_548,
    winRate: 25.48,
    interval: [24.63, 26.34],
    roundWinRate: 25.2,
    guardAccuracy: 36.8,
    guardAttempts: 6_721,
    baron: { wins: 45.6, ties: 11.6, losses: 42.8 },
    seatWinRates: [25.1, 25.7, 25.2, 25.9],
    dealerWinRate: 25.5,
  },
  {
    name: "Royal Guard",
    style: "Guard-focused",
    wins: 2_316,
    winRate: 23.16,
    interval: [22.34, 24.0],
    roundWinRate: 23.4,
    guardAccuracy: 39.5,
    guardAttempts: 7_102,
    baron: { wins: 43.8, ties: 12.1, losses: 44.1 },
    seatWinRates: [23.9, 22.8, 23.5, 22.4],
    dealerWinRate: 23.2,
  },
  {
    name: "Random",
    style: "Baseline",
    wins: 1_918,
    winRate: 19.18,
    interval: [18.42, 19.96],
    roundWinRate: 19.7,
    guardAccuracy: 25.1,
    guardAttempts: 6_842,
    baron: { wins: 39.4, ties: 12.9, losses: 47.7 },
    seatWinRates: [19.8, 18.9, 19.2, 18.8],
    dealerWinRate: 19.4,
  },
];

const winRateHistory = [
  { label: "2k", values: [30.9, 25.1, 23.7, 20.3] },
  { label: "4k", values: [31.4, 25.8, 23.2, 19.6] },
  { label: "6k", values: [32.6, 25.2, 22.8, 19.4] },
  { label: "8k", values: [31.9, 25.6, 23.1, 19.2] },
  { label: "10k", values: bots.map((bot) => bot.winRate) },
];

const rejectionCauses = [
  { name: "Guard guess", count: 8_242, share: 42, color: "olive" },
  { name: "Prince discard", count: 5_495, share: 28, color: "sand" },
  { name: "Baron comparison", count: 3_727, share: 19, color: "clay" },
  { name: "Princess played", count: 2_157, share: 11, color: "ink" },
];

const cardUsage = [
  { name: "Guard", count: 35_420, share: 30.2 },
  { name: "Prince", count: 14_216, share: 12.1 },
  { name: "Priest", count: 13_982, share: 11.9 },
  { name: "Baron", count: 13_544, share: 11.5 },
  { name: "Handmaid", count: 13_291, share: 11.3 },
  { name: "Princess", count: 9_104, share: 7.8 },
  { name: "Countess", count: 9_028, share: 7.7 },
  { name: "King", count: 8_765, share: 7.5 },
];

const drawnCardMix = [
  { name: "Guard", count: 31_200, share: 31.2 },
  { name: "Priest", count: 12_480, share: 12.5 },
  { name: "Baron", count: 12_460, share: 12.5 },
  { name: "Handmaid", count: 12_530, share: 12.5 },
  { name: "Prince", count: 12_490, share: 12.5 },
  { name: "King", count: 6_310, share: 6.3 },
  { name: "Countess", count: 6_260, share: 6.3 },
  { name: "Princess", count: 6_270, share: 6.3 },
];

const chartColors = ["#5e6140", "#a47c4c", "#777c9a", "#b16e56"];
const chartRange = { min: 15, max: 35, top: 14, bottom: 150, left: 36, right: 420 };

function linePoints(botIndex: number) {
  const { min, max, top, bottom, left, right } = chartRange;
  return winRateHistory
    .map(({ values }, index) => {
      const x = left + (index / (winRateHistory.length - 1)) * (right - left);
      const y = bottom - ((values[botIndex] - min) / (max - min)) * (bottom - top);
      return `${x},${y}`;
    })
    .join(" ");
}

function downloadCsv() {
  const rows = [
    ["Bot", "Games", "Wins", "Game win rate", "95% CI low", "95% CI high", "Round win rate", "Guard accuracy"],
    ...bots.map((bot) => [
      bot.name,
      "10000",
      String(bot.wins),
      `${bot.winRate}%`,
      `${bot.interval[0]}%`,
      `${bot.interval[1]}%`,
      `${bot.roundWinRate}%`,
      `${bot.guardAccuracy}%`,
    ]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "love-letter-simulation-stats.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function WinRateChart() {
  return (
    <div className="stats-chart">
      <div className="stats-chart__legend" aria-label="Bot legend">
        {bots.map((bot, index) => (
          <span className="stats-chart__legend-item" key={bot.name}>
            <i style={{ backgroundColor: chartColors[index] }} />
            {bot.name}
          </span>
        ))}
      </div>
      <svg
        className="stats-chart__svg"
        viewBox="0 0 440 184"
        role="img"
        aria-label="Cumulative game win rate by bot over 10,000 simulated games"
      >
        {[15, 20, 25, 30, 35].map((rate) => {
          const y = chartRange.bottom - ((rate - chartRange.min) / (chartRange.max - chartRange.min)) *
            (chartRange.bottom - chartRange.top);
          return (
            <g key={rate}>
              <line x1={chartRange.left} x2={chartRange.right} y1={y} y2={y} className="stats-chart__grid" />
              <text x="0" y={y + 4} className="stats-chart__axis-label">{rate}%</text>
            </g>
          );
        })}
        {winRateHistory.map((point, index) => {
          const x = chartRange.left + (index / (winRateHistory.length - 1)) * (chartRange.right - chartRange.left);
          return (
            <text key={point.label} x={x} y="174" textAnchor="middle" className="stats-chart__axis-label">
              {point.label}
            </text>
          );
        })}
        {bots.map((bot, index) => (
          <g key={bot.name}>
            <polyline
              points={linePoints(index)}
              fill="none"
              stroke={chartColors[index]}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {winRateHistory.map(({ values, label }, pointIndex) => {
              const x = chartRange.left + (pointIndex / (winRateHistory.length - 1)) *
                (chartRange.right - chartRange.left);
              const y = chartRange.bottom - ((values[index] - chartRange.min) /
                (chartRange.max - chartRange.min)) * (chartRange.bottom - chartRange.top);
              return <circle key={`${bot.name}-${label}`} cx={x} cy={y} r="3" fill={chartColors[index]} />;
            })}
          </g>
        ))}
      </svg>
      <p className="stats-chart__caption">Games completed · cumulative win rate</p>
    </div>
  );
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

export default function Stats() {
  return (
    <div className="stats-page">
      <Header />
      <main className="stats-main">
        <section className="stats-intro">
          <div>
            <p className="stats-eyebrow">SIMULATION LAB <span> / </span> PERFORMANCE</p>
            <h1>Statistics</h1>
            <p className="stats-intro__copy">
              See which strategies come out ahead, how they play, and whether the edge holds up over time.
            </p>
          </div>
          <button className="stats-export" type="button" onClick={downloadCsv}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 2.5v9m0 0 3.5-3.5M10 11.5 6.5 8M3.5 13v3.5h13V13" />
            </svg>
            Export results
          </button>
        </section>

        <section className="stats-run" aria-label="Simulation details">
          <div className="stats-run__status"><span /> SAMPLE RUN</div>
          <div className="stats-run__details">
            <strong>Strategy league · 10,000 games</strong>
            <span>4 bots <b>·</b> seats rotated <b>·</b> first to 3 round wins</span>
          </div>
          <div className="stats-run__date">Example data <span>·</span> 14 Nov 2026</div>
        </section>

        <section className="stats-kpis" aria-label="Simulation highlights">
          <article className="stats-kpi stats-kpi--lead">
            <span className="stats-kpi__label">Top strategy</span>
            <strong>Card Counter</strong>
            <span className="stats-kpi__note">Leads the field by 6.7 percentage points</span>
          </article>
          <article className="stats-kpi">
            <span className="stats-kpi__label">Games simulated</span>
            <strong>10,000</strong>
            <span className="stats-kpi__note">40,000 bot-game results</span>
          </article>
          <article className="stats-kpi">
            <span className="stats-kpi__label">Rounds played</span>
            <strong>32,480</strong>
            <span className="stats-kpi__note">3.25 rounds per game on average</span>
          </article>
          <article className="stats-kpi">
            <span className="stats-kpi__label">Guard accuracy</span>
            <strong>35.7%</strong>
            <span className="stats-kpi__note">Across 27,605 guesses</span>
          </article>
        </section>

        <section className="stats-primary-grid">
          <article className="stats-panel stats-leaderboard">
            <PanelHeading eyebrow="OUTCOME · GAME WIN RATE" title="Bot leaderboard" />
            <div className="stats-table-wrap">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th scope="col">Strategy</th>
                    <th scope="col">Win rate</th>
                    <th scope="col">Wins</th>
                    <th scope="col">95% confidence interval</th>
                  </tr>
                </thead>
                <tbody>
                  {bots.map((bot, index) => (
                    <tr key={bot.name} className={index === 0 ? "stats-table__leader" : undefined}>
                      <th scope="row">
                        <span className="stats-bot-name">{bot.name}</span>
                        <span className="stats-bot-style">{bot.style}</span>
                      </th>
                      <td>
                        <span className="stats-rate">{bot.winRate.toFixed(1)}%</span>
                        <span className="stats-inline-track">
                          <i style={{ width: `${bot.winRate * 2.5}%`, backgroundColor: chartColors[index] }} />
                        </span>
                      </td>
                      <td>{bot.wins.toLocaleString()}</td>
                      <td className="stats-interval">{bot.interval[0].toFixed(1)}–{bot.interval[1].toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="stats-panel__footnote">Intervals use the 95% Wilson score method. All bots played 10,000 games.</p>
          </article>

          <article className="stats-panel stats-trend">
            <PanelHeading eyebrow="CONSISTENCY" title="Win rate over time" />
            <WinRateChart />
          </article>
        </section>

        <section className="stats-secondary-grid">
          <article className="stats-panel">
            <PanelHeading eyebrow="OUTCOME · REJECTIONS" title="How players are rejected" />
            <div className="stats-rejection-bar" aria-label="Rejections by cause">
              {rejectionCauses.map((cause) => (
                <span
                  key={cause.name}
                  className={`stats-rejection-bar__segment stats-rejection-bar__segment--${cause.color}`}
                  style={{ width: `${cause.share}%` }}
                  title={`${cause.name}: ${cause.share}%`}
                />
              ))}
            </div>
            <ul className="stats-breakdown">
              {rejectionCauses.map((cause) => (
                <li key={cause.name}>
                  <span className={`stats-breakdown__dot stats-breakdown__dot--${cause.color}`} />
                  <span>{cause.name}</span>
                  <strong>{cause.count.toLocaleString()}</strong>
                  <em>{cause.share}%</em>
                </li>
              ))}
            </ul>
              <div className="stats-rejection-context">
                <span><small>Most common timing</small><strong>Midgame · 48%</strong></span>
                <span><small>Top rejector</small><strong>Card Counter · 27%</strong></span>
              </div>
            <p className="stats-panel__footnote">19,621 rejection events across all simulated games.</p>
          </article>

          <article className="stats-panel">
            <PanelHeading eyebrow="PLAY · DECISION QUALITY" title="Guard guess accuracy" />
            <div className="stats-accuracy">
              <div className="stats-accuracy__ring"><strong>35.7<span>%</span></strong></div>
              <div>
                <strong>1 in 3 guesses is right</strong>
                <p>Correct guesses reject the target. Guard cannot guess another Guard.</p>
              </div>
            </div>
            <div className="stats-accuracy__details">
              <span><i className="stats-breakdown__dot--olive" /> Correct <strong>9,855</strong></span>
              <span><i className="stats-breakdown__dot--sand" /> Incorrect <strong>17,750</strong></span>
            </div>
            <p className="stats-panel__footnote">27,605 Guard guesses made by all strategies.</p>
          </article>

          <article className="stats-panel">
            <PanelHeading eyebrow="PLAY · BARON COMPARISONS" title="Baron outcomes" />
            <div className="stats-baron">
              <div className="stats-baron__row">
                <span><i className="stats-breakdown__dot--olive" /> Won</span>
                <strong>44.2%</strong>
                <span className="stats-baron__track"><i style={{ width: "44.2%" }} /></span>
              </div>
              <div className="stats-baron__row">
                <span><i className="stats-breakdown__dot--sand" /> Tied</span>
                <strong>11.7%</strong>
                <span className="stats-baron__track stats-baron__track--sand"><i style={{ width: "11.7%" }} /></span>
              </div>
              <div className="stats-baron__row">
                <span><i className="stats-breakdown__dot--clay" /> Lost</span>
                <strong>44.1%</strong>
                <span className="stats-baron__track stats-baron__track--clay"><i style={{ width: "44.1%" }} /></span>
              </div>
            </div>
            <p className="stats-panel__footnote">Based on 13,840 Baron comparisons. Ties reject neither player.</p>
          </article>
        </section>

        <section className="stats-detail-grid">
          <article className="stats-panel stats-usage">
            <PanelHeading eyebrow="PLAY · CARD CHOICES" title="Cards played" />
            <div className="stats-usage__list">
              {cardUsage.map((card) => (
                <div className="stats-usage__row" key={card.name}>
                  <span>{card.name}</span>
                  <span className="stats-usage__track"><i style={{ width: `${(card.share / 30.2) * 100}%` }} /></span>
                  <strong>{card.count.toLocaleString()}</strong>
                  <em>{card.share}%</em>
                </div>
              ))}
            </div>
          </article>

          <article className="stats-panel">
            <PanelHeading eyebrow="PLAY · INFORMATION USE" title="Card-counting accuracy" />
            <div className="stats-memory">
              <strong>68.4<span>%</span></strong>
              <div>
                <b>Hidden-card predictions correct</b>
                <p>Card Counter leads at 74.2%; Random baseline is 25.1%.</p>
              </div>
            </div>
            <div className="stats-memory__track" aria-label="68.4 percent prediction accuracy">
              <i />
            </div>
            <p className="stats-panel__footnote">
              Correct predictions across 1,940 turns where the target card was later revealed.
            </p>
          </article>

          <article className="stats-panel stats-usage">
            <PanelHeading eyebrow="CONTEXT · DRAWN CARDS" title="Cards drawn" />
            <div className="stats-usage__list">
              {drawnCardMix.map((card) => (
                <div className="stats-usage__row" key={card.name}>
                  <span>{card.name}</span>
                  <span className="stats-usage__track"><i style={{ width: `${(card.share / 31.2) * 100}%` }} /></span>
                  <strong>{card.count.toLocaleString()}</strong>
                  <em>{card.share}%</em>
                </div>
              ))}
            </div>
            <p className="stats-panel__footnote">100,000 observed draws. Draw mix is close to the deck’s card proportions.</p>
          </article>

          <article className="stats-panel stats-seats">
            <PanelHeading eyebrow="CONTEXT · SEAT EFFECT" title="Win rate by seat" />
            <div className="stats-table-wrap">
              <table className="stats-table stats-table--seats">
                <thead>
                  <tr>
                    <th scope="col">Strategy</th>
                    <th scope="col">Seat 1</th>
                    <th scope="col">Seat 2</th>
                    <th scope="col">Seat 3</th>
                    <th scope="col">Seat 4</th>
                    <th scope="col">Dealer</th>
                  </tr>
                </thead>
                <tbody>
                  {bots.map((bot) => (
                    <tr key={bot.name}>
                      <th scope="row"><span className="stats-bot-name">{bot.name}</span></th>
                      {bot.seatWinRates.map((rate, seat) => (
                        <td key={seat}>{rate.toFixed(1)}%</td>
                      ))}
                      <td>{bot.dealerWinRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="stats-panel__footnote">Dealer rate is shown as a share of all wins while dealing. Seats were rotated between games.</p>
          </article>
        </section>

        <section className="stats-context">
          <div className="stats-context__icon" aria-hidden="true">i</div>
          <div>
            <strong>About this comparison</strong>
            <p>
              These figures are illustrative sample data, not results from a live simulation. The benchmark compares
              four strategies in the same four-player league; each game has one winning bot. Higher win rate is better,
              while the confidence interval helps show how much results may vary. Seats are rotated to reduce position
              bias; draw mix and the 95% Wilson interval provide context for luck and sample size.
            </p>
          </div>
          <div className="stats-context__meta">
            <span>FORMAT <strong>Head-to-head</strong></span>
            <span>SEAT ROTATION <strong>Enabled</strong></span>
            <span>ROUND TARGET <strong>3 wins</strong></span>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
