// Colour scales for the heat tables. Each step is [background, text colour that reads on it].
// The colours themselves live in index.css (--blue-0..6, --above-*, --below-*, --neutral),
// so they switch with the light/dark theme.

const step = (name: string) => [`var(--${name})`, `var(--${name}-ink)`] as const;

// One blue, faint -> strong: for "more of something" (shares, counts).
export const BLUE = [0, 1, 2, 3, 4, 5, 6].map((i) => step(`blue-${i}`));

// v from 0 to max -> a step of BLUE
export function blue(v: number, max: number): readonly [string, string] {
  return BLUE[Math.min(BLUE.length - 1, Math.floor((v / Math.max(max, 1e-9)) * (BLUE.length - 1) + 0.5))];
}

// Two poles around a neutral middle: for "better or worse than a reference".
const ABOVE = [1, 2, 3].map((i) => step(`above-${i}`));
const BELOW = [1, 2, 3].map((i) => step(`below-${i}`));
export const NEUTRAL = step("neutral");

// diff = value - reference, scaled against the largest |diff| in the table
export function diverging(diff: number, maxAbs: number): readonly [string, string] {
  const s = Math.round((Math.abs(diff) / Math.max(maxAbs, 1e-9)) * ABOVE.length);
  if (s === 0) return NEUTRAL;
  return (diff > 0 ? ABOVE : BELOW)[Math.min(s, ABOVE.length) - 1];
}

export const EMPTY = ["transparent", "var(--text-muted)"] as const;
