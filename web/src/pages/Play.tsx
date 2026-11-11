import { NavLink } from "react-router-dom";
import ActionLog from "./play/ActionLog";
import PlayTable from "./play/PlayTable";
import "./Play.css";

export default function Play() {
  return (
    <div className="page play-page">
      <header className="topbar">
        <NavLink to="/" className="wordmark">
          Love Letter Strategy
        </NavLink>
        <span className="version">v1.0</span>

        <nav className="navigation" aria-label="Main navigation">
          <NavLink to="/play" className="navigation__link">
            Play
          </NavLink>
          <NavLink to="/simulate" className="navigation__link">
            Simulate
          </NavLink>
          <NavLink to="/stats" className="navigation__link">
            Statistics
          </NavLink>
        </nav>
      </header>

      <main className="game-layout">
        <PlayTable />
        <ActionLog />
      </main>

      <footer className="footer">made with {"<3"} by timone34</footer>
    </div>
  );
}
