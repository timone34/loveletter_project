import { NavLink } from "react-router-dom";
import "./Header.css"

export function Header() {
  return (
    <header className="topbar">
    <NavLink to="/" className="wordmark">
        Love Letter Strategy
    </NavLink>
    <span className="version">v1.0</span>

    <nav className="navigation">
      {/* New: play, watch or simulate (pages/setup). History: every simulation run. */}
      <NavLink to="/new" className="navigation__link">
        New
      </NavLink>

      <NavLink to="/stats" className="navigation__link">
        History
      </NavLink>
    </nav>

    
  </header>
  )
}

export function Footer() {
  return (
    <footer className="footer">
        made with {"<3"} by timone34
    </footer>
  )
}