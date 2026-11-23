// Table settings: chosen on the setup page (/play), used by the table (/play/table).
// The same shape is sent to the server with "new_game" (server.py's TableConfig).

export type Speed = "slow" | "normal" | "fast";
export type Visibility = "private" | "public";

export type Opponent = { name: string; bot: string }; // bot = strategy id, e.g. "CardCounter"

export type TableConfig = {
  name: string;
  you: string;
  seat: number | null; // your seat, 0-3; null = random
  opponents: Opponent[]; // always 3, in seat order
  targetRoundWins: number;
  speed: Speed;
  deckSeed: string; // "" = fresh shuffles
  visibility: Visibility;
};

export const DEFAULT_CONFIG: TableConfig = {
  name: "The Royal Court",
  you: "You",
  seat: 3,
  opponents: [
    { name: "Alice", bot: "NoPrincess" },
    { name: "Bob", bot: "RandomChoice" },
    { name: "Charlie", bot: "RandomChoice" },
  ],
  targetRoundWins: 3,
  speed: "normal",
  deckSeed: "",
  visibility: "private",
};

export const NAME_LIMIT = 24; // matches the server

const STORAGE_KEY = "loveletter.tableConfig";

// The last settings used, so the setup page and "New game" remember them.
// Storage can be unavailable (private windows), so every access is guarded.
export function loadConfig(): TableConfig {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && Array.isArray(saved.opponents) && saved.opponents.length === 3) {
      return { ...DEFAULT_CONFIG, ...saved };
    }
  } catch {
    // fall through to the defaults
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(config: TableConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // not saved; the game still starts with these settings
  }
}

// null = fine, otherwise what to fix. The server checks the same things.
export function validate(config: TableConfig): string | null {
  const names = [config.you, ...config.opponents.map((o) => o.name)].map((n) => n.trim());
  if (names.some((n) => n === "")) return "Every player needs a name.";
  if (new Set(names.map((n) => n.toLowerCase())).size < names.length) {
    return "Every player needs a different name.";
  }
  return null;
}

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8);
}
