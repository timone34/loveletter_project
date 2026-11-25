import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Header, Footer } from "../../components/Header";
import { deleteRun, useRuns } from "../../sims/api";
import { count, duration, lineupText, pct, seriesColor, when } from "../../sims/format";
import { isActive, type RunRecord } from "../../sims/types";
import "./Stats.css";

// The simulation history (/stats): every run, newest first. Click a row for
// its stats. Runs still going show their progress and update by themselves.
// Tick the checkboxes to delete (or stop) several runs at once.

export default function History() {
  const navigate = useNavigate();
  const { runs, error, reload } = useRuns();

  const remove = async (run: RunRecord) => {
    const msg = isActive(run) ? `Stop “${run.config.name}”?` : `Delete “${run.config.name}” from the history?`;
    if (!window.confirm(msg)) return;
    await deleteRun(run.id).catch(() => undefined);
    reload();
  };

  // ids of the ticked rows; ids of runs that no longer exist are ignored
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const selected = (runs ?? []).filter((r) => picked.has(r.id));
  const allPicked = !!runs?.length && selected.length === runs.length;

  const toggle = (id: string) =>
    setPicked((old) => {
      const next = new Set(old);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(runs?.map((r) => r.id)));

  const removeSelected = async () => {
    const active = selected.filter(isActive).length;
    const n = selected.length;
    const msg =
      `Delete ${n} simulation${n === 1 ? "" : "s"} from the history?` +
      (active ? ` ${active} still going will be stopped.` : "");
    if (!window.confirm(msg)) return;
    await Promise.allSettled(selected.map((r) => deleteRun(r.id)));
    setPicked(new Set());
    reload();
  };

  return (
    <div className="page">
      <Header />
      <main>
        <div className="stats">
          <header className="stats__head">
            <div className="stats__titles">
              <p className="stats__eyebrow">History</p>
              <h1 className="stats__title stats__title--static">Simulation history</h1>
              <p className="stats__lineup">Every simulation you've run. Pick one to see its stats.</p>
            </div>
            <div className="stats__aside">
              <div className="controls">
                {selected.length > 0 && (
                  <button type="button" className="btn btn--danger" onClick={removeSelected}>
                    Delete {selected.length} selected
                  </button>
                )}
                <button type="button" className="btn btn--primary" onClick={() => navigate("/new?mode=simulate")}>New simulation</button>
              </div>
            </div>
          </header>

          {error ? (
            <div className="notice">
              <p>{error} Start it from the project root with <code>uvicorn server:app --port 8000</code>.</p>
              <button type="button" className="ghost-btn" onClick={reload}>Try again</button>
            </div>
          ) : !runs ? (
            <p className="notice">Loading…</p>
          ) : !runs.length ? (
            <div className="notice">
              <p>No simulations yet.</p>
              <Link to="/new?mode=simulate" className="link-btn">Run the first one →</Link>
            </div>
          ) : (
            <div className="stat-card stat-card--flush">
              <table className="runs">
                <thead>
                  <tr>
                    <th className="runs__pick">
                      <input type="checkbox" aria-label="Select all" checked={allPicked} onChange={toggleAll} />
                    </th>
                    <th>Run</th>
                    <th>Game win rates</th>
                    <th className="num">Games</th>
                    <th className="num">Rounds / game</th>
                    <th>Seed</th>
                    <th>When</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr
                      key={r.id}
                      className={picked.has(r.id) ? "runs__row--picked" : undefined}
                      onClick={() => navigate(`/stats/${r.id}`)}
                    >
                      {/* the whole cell toggles, so a near-miss doesn't open the run */}
                      <td
                        className="runs__pick"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(r.id);
                        }}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.config.name}`}
                          checked={picked.has(r.id)}
                          onChange={() => toggle(r.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td>
                        <Link to={`/stats/${r.id}`} className="runs__name" onClick={(e) => e.stopPropagation()}>
                          {r.config.name}
                        </Link>
                        <span className="runs__lineup">{lineupText(r)}</span>
                      </td>
                      <td><WinRates run={r} /></td>
                      <td className="num">
                        {isActive(r) ? `${count(r.progress.done)} / ${count(r.progress.total)}` : count(r.config.games)}
                      </td>
                      <td className="num">{r.stats?.roundsPerGame.mean?.toFixed(2) ?? "–"}</td>
                      <td><code className="runs__seed">{r.config.seed}</code></td>
                      <td className="runs__when">
                        {when(r.createdAt)}
                        <span>{r.status === "done" ? duration(r.durationSec) : <span className={`status status--${r.status}`}>{r.status}</span>}</span>
                      </td>
                      <td className="num">
                        <button
                          type="button"
                          className="btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(r);
                          }}
                        >
                          {isActive(r) ? "Stop" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// Each player's game win rate as a short labelled bar, in seat order.
// The track runs 0-50%, so the fair 25% line sits in the middle.
function WinRates({ run }: { run: RunRecord }) {
  if (!run.stats) {
    const why = run.status === "failed" ? run.error : run.status === "outdated" ? "Saved by an older version: open it to run it again." : "–";
    return <span className="runs__lineup">{why}</span>;
  }
  return (
    <div className="mini-rates">
      {run.stats.players.map((p, i) => (
        <span key={p.name} className="mini-rates__row" title={`${p.name} (${run.botNames[p.bot ?? ""] ?? p.bot})`}>
          <span className="mini-rates__name">{p.name}</span>
          <span className="mini-rates__track">
            <span className="mini-rates__bar" style={{ width: `${Math.min(1, (p.gameWinRate?.p ?? 0) * 2) * 100}%`, background: seriesColor(i) }} />
            <span className="mini-rates__ref" />
          </span>
          <span className="mini-rates__value">{pct(p.gameWinRate?.p)}</span>
        </span>
      ))}
    </div>
  );
}
