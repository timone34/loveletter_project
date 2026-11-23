import type { Cause } from "./types";

// What each cause of a lost round means (stats/tally.py, loss_cause).
export const CAUSE_LABELS: Record<Cause, { label: string; note: string }> = {
  guard: { label: "Guard", note: "an opponent guessed their card" },
  baron: { label: "Baron", note: "lost an opponent's Baron comparison" },
  ownBaron: { label: "Own Baron", note: "lost the comparison of their own Baron" },
  prince: { label: "Prince", note: "an opponent's Prince made them discard the Princess" },
  ownPrince: { label: "Own Prince", note: "Princed themselves while holding the Princess" },
  princess: { label: "Princess", note: "played the Princess" },
  showdown: { label: "Showdown", note: "still in at the end, but a higher card won" },
};
