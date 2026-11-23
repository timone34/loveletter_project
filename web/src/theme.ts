// Light/dark theme. The theme is the data-theme attribute on <html>; index.css
// swaps the colour tokens on :root[data-theme="dark"]. The choice is kept in
// localStorage; without one, the system setting decides. index.html applies
// it before React starts, so a dark page never flashes light on load.

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "theme"; // same key as the script in index.html

function current(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(current);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage blocked: the theme still switches, it just isn't remembered
    }
    setTheme(next);
  };

  return [theme, toggle];
}
