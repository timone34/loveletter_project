import { NavLink } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { THEME_CHOICES, useTheme, type ThemeChoice } from "../theme";
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

    <ThemeMenu />
  </header>
  )
}

// The theme menu: the button shows the current choice's icon, clicking it
// opens a small list (Light / Dark / System). Closes on a pick, a click
// elsewhere, or Escape.
function ThemeMenu() {
  const { choice, setChoice } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="theme-menu" ref={ref}>
      <button
        type="button"
        className="theme-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Theme"
        title="Theme"
      >
        <ThemeIcon choice={choice} />
      </button>

      {open && (
        <div className="theme-menu__list" role="menu">
          {THEME_CHOICES.map((c) => (
            <button
              key={c.value}
              type="button"
              role="menuitemradio"
              aria-checked={choice === c.value}
              className="theme-menu__option"
              onClick={() => {
                setChoice(c.value);
                setOpen(false);
              }}
            >
              <ThemeIcon choice={c.value} />
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// sun = light, moon = dark, screen = follow the system
function ThemeIcon({ choice }: { choice: ThemeChoice }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {choice === "light" && (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      )}
      {choice === "dark" && <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />}
      {choice === "system" && (
        <>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </>
      )}
    </svg>
  )
}

export function Footer() {
  return (
    <footer className="footer">
        made with {"<3"} by timone34
    </footer>
  )
}