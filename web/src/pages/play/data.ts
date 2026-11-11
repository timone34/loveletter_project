import type { GameAction, Opponent } from "./types";

export const OPPONENTS: Opponent[] = [
  { name: "The Oracle", avatar: "O", detail: "Bot · 2 tokens", tilt: "-8deg", discard: "guard" },
  { name: "The Regent", avatar: "R", detail: "Bot · 1 token", tilt: "0deg", discard: "priest" },
  { name: "The Scribe", avatar: "S", detail: "Bot · 3 tokens", tilt: "8deg", discard: "baron" },
];

export const ACTIONS: GameAction[] = [
  { player: "The Oracle", action: "played Guard", time: "just now", tone: "guard" },
  { player: "The Regent", action: "drew a card", time: "1 min ago" },
  { player: "You", action: "joined the round", time: "2 min ago", tone: "you" },
];
