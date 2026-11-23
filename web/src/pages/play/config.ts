// Table settings: chosen on the setup page (/new, see pages/setup/config.ts),
// used by the table (/play/table). The same shape is sent to the server with
// "new_game" (server.py's TableConfig).

export type Speed = "slow" | "normal" | "fast";
export type Visibility = "private" | "public";

export type Opponent = { name: string; bot: string }; // bot = strategy id, e.g. "CardCounter"

export type TableConfig = {
  mode: "play" | "watch"; // watch: four bots, nobody to ask
  name: string;
  you: string;
  seat: number | null; // your seat, 0-3; null = random
  opponents: Opponent[]; // play: the 3 bots, in seat order
  players?: Opponent[]; // watch: the 4 bots, in seat order
  reveal?: boolean; // watch: start with every hand face up
  targetRoundWins: number;
  speed: Speed;
  deckSeed: string; // "" = fresh shuffles
  visibility: Visibility;
};

export const DEFAULT_CONFIG: TableConfig = {
  mode: "play",
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

// The settings of the last game started from the setup page, so the table's
// "New game" can start another one. In memory only, like the setup page's
// choices: a reload starts from the defaults.
let current: TableConfig = DEFAULT_CONFIG;

export function loadConfig(): TableConfig {
  return current;
}

export function saveConfig(config: TableConfig): void {
  current = config;
}

// The bots at the table, for texts like "Alice, Bob and Charlie are waiting".
export function botsAtTable(config: TableConfig): Opponent[] {
  return config.mode === "watch" ? config.players ?? [] : config.opponents;
}

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8);
}
