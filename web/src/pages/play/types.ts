import type { CardId, GameCardId } from "../../components/cardData";

export type PlayerView = {
    seat: number;
    name: string;
    strategy: string;
    roundWins: number;
    hand: (CardId | null)[]; // null = face down; [] when rejected
    discards: CardId[];
    active?: boolean;
    protected?: boolean;
    rejected?: boolean;

};

export type TableView = {
    name: string;
    round: number;
    dealer: number; // seat
    deckCount: number;
    winsNeeded: number;
    youSeat: number;
    players: PlayerView[]; // in seat order
    burn?: CardId | null;
    showdown?: boolean;
}

// ----- Messages from server.py's /ws/play ----- //

// Card names in events are display names ("Guard"); the table uses ids ("guard").
type CardName = string;

export type Outcome = "NONE" | "PROTECTED" | "CORRECT" | "INCORRECT" | "WIN" | "LOSE" | "DRAW";

export type TurnEvent = {
    type: "turn_start" | "turn_end";
    cycle: number;
    seat: number;
    held: CardName | null;
    drawn: CardName | null;
    played: CardName | null;
    target: number | null;
    guess: CardName | null;
    outcome: Outcome;
    seen: CardName | null;
    discarded: CardName | null;
    redrawn: CardName | null;
    rejected: number[];
};

// JSON turns the server's int dict keys into strings
type BySeat<T> = Record<string, T>;

export type GameEvent =
    | { type: "game_start"; players: string[]; strategies: string[] }
    | { type: "round_start"; number: number; dealer: number; burn: CardName | null; starting_hands: BySeat<CardName> }
    | TurnEvent
    | { type: "turn_skipped"; cycle: number; seat: number }
    | { type: "showdown"; hands: BySeat<CardName>; discard_totals: BySeat<number>; winners: number[] }
    | { type: "round_end"; number: number; winners: number[] }
    | { type: "game_end"; winner: number; scores: BySeat<number> };

export type Prompt =
    | { kind: "card"; options: GameCardId[]; playable: boolean[]; forced: boolean }
    | { kind: "target"; options: number[]; card: GameCardId }
    | { kind: "guess"; options: GameCardId[]; target: number };

export type ServerMessage =
    | (GameEvent & { table: TableView })
    | { type: "prompt"; prompt: Prompt; table: TableView }
    | { type: "table"; table: TableView }
    | { type: "status"; running: boolean; paused: boolean; revealHands: boolean; revealBurn: boolean }
    | { type: "error"; message: string };