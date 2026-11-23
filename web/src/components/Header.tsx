import { NavLink } from "react-router-dom";
import { useTheme } from "../theme";
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

    <ThemeToggle />
  </header>
  )
}

// Sun in dark mode (click for light), moon in light mode (click for dark).
function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        )}
      </svg>
    </button>
  )
}

export function Footer() {
  return (
    <footer className="footer">
        made with {"<3"} by timone34
    </footer>
  )
}