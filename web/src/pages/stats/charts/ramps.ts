// Colour scales for the heat tables. Each step is [background, text colour that reads on it].

// One blue, light -> dark: for "more of something" (shares, counts).
export const BLUE = [
  ["#eef4fc", "#2a2829"], ["#cde2fb", "#2a2829"], ["#9ec5f4", "#2a2829"], ["#6da7ec", "#2a2829"],
  ["#3987e5", "#fff"], ["#256abf", "#fff"], ["#184f95", "#fff"],
] as const;

// v from 0 to max -> a step of BLUE
export function blue(v: number, max: number): readonly [string, string] {
  return BLUE[Math.min(BLUE.length - 1, Math.floor((v / Math.max(max, 1e-9)) * (BLUE.length - 1) + 0.5))];
}

// Two poles around a grey middle: for "better or worse than a reference".
const ABOVE = [["#d7e6f9", "#2a2829"], ["#86b6ef", "#2a2829"], ["#2a78d6", "#fff"]] as const;
const BELOW = [["#f8dad9", "#2a2829"], ["#ef9a99", "#2a2829"], ["#d43c3b", "#fff"]] as const;
export const NEUTRAL = ["#efeee8", "#2a2829"] as const;

// diff = value - reference, scaled against the largest |diff| in the table
export function diverging(diff: number, maxAbs: number): readonly [string, string] {
  const step = Math.round((Math.abs(diff) / Math.max(maxAbs, 1e-9)) * ABOVE.length);
  if (step === 0) return NEUTRAL;
  return (diff > 0 ? ABOVE : BELOW)[Math.min(step, ABOVE.length) - 1];
}

export const EMPTY = ["transparent", "var(--text-muted)"] as const;
