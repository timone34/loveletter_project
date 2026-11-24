// Light/dark theme. The theme is the data-theme attribute on <html>; index.css
// swaps the colour tokens on :root[data-theme="dark"]. The choice (light,
// dark or system) is kept in localStorage; "system" follows the OS setting,
// also when it changes while the page is open. index.html applies it before
// React starts, so a dark page never flashes light on load.

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
export type ThemeChoice = Theme | "system";

export const THEME_CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const KEY = "theme"; // same key as the script in index.html
const SYSTEM_DARK = "(prefers-color-scheme: dark)";

function savedChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // storage blocked: fall back to the system setting
  }
  return "system";
}

export function useTheme(): { choice: ThemeChoice; theme: Theme; setChoice: (c: ThemeChoice) => void } {
  const [choice, setChoiceState] = useState<ThemeChoice>(savedChoice);
  const [systemDark, setSystemDark] = useState(() => matchMedia(SYSTEM_DARK).matches);

  // follow the OS setting live (only matters while the choice is "system")
  useEffect(() => {
    const mq = matchMedia(SYSTEM_DARK);
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const theme: Theme = choice === "system" ? (systemDark ? "dark" : "light") : choice;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setChoice = (c: ThemeChoice) => {
    try {
      localStorage.setItem(KEY, c);
    } catch {
      // storage blocked: the theme still switches, it just isn't remembered
    }
    setChoiceState(c);
  };

  return { choice, theme, setChoice };
}
