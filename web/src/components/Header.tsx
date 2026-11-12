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
  )
}

export function Footer() {
  return (
    <footer className="footer">
        made with {"<3"} by timone34
    </footer>
  )
}