import { ACTIONS } from "./data";
import "./ActionLog.css";

export default function ActionLog() {
  return (
    <aside className="action-log" aria-label="Action log">
      <div className="action-log__heading">
        <div>
          <p className="eyebrow">At the table</p>
          <h2>Action log</h2>
        </div>
        <span className="action-log__live">
          <i /> Live
        </span>
      </div>

      <ol className="action-list">
        {ACTIONS.map((entry) => (
          <li
            className={`action-list__item${entry.tone ? ` action-list__item--${entry.tone}` : ""}`}
            key={`${entry.player}-${entry.action}`}
          >
            <span className="action-list__marker" aria-hidden="true" />
            <div>
              <strong>{entry.player}</strong>
              <p>{entry.action}</p>
              <time>{entry.time}</time>
            </div>
          </li>
        ))}
      </ol>

      <p className="action-log__note">
        New turns will appear here as the round unfolds.
      </p>
    </aside>
  );
}
