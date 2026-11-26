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
    round: number;
    dealer: number; // seat
    deckCount: number;
    winsNeeded: number;
    name: string; // table name, from the setup page
    visibility: "private" | "public";
    youSeat: number | null; // null when watching: nobody at the table is you
    players: PlayerView[]; // in seat order
    burn?: CardId | null; // null unless "reveal hands" is on
    burnTaken?: boolean; // a Prince on an empty deck handed out the burned card
    showdown?: boolean;
}

// ----- Messages from server.py's /ws/play ----- //

// Cards are ids ("guard") everywhere; look up display names with cardName().
// A turn's fields are TurnHistory's (engine/history.py), sent as-is.
type CardRef = GameCardId;

export type Outcome = "NONE" | "PROTECTED" | "CORRECT" | "INCORRECT" | "WIN" | "LOSE" | "DRAW";

export type TurnEvent = {
    type: "turn_start" | "turn_end" | "turn_skipped"; // skipped: only cycle and seat are set
    cycle: number;
    seat: number;
    held: CardRef | null;
    drawn: CardRef | null;
    played: CardRef | null;
    target: number | null;
    guess: CardRef | null;
    outcome: Outcome;
    seen: CardRef | null;
    discarded: CardRef | null;
    redrawn: CardRef | null;
    given: CardRef | null;    // King: the card the player handed over in the swap
    received: CardRef | null; // King: the card the player got in the swap
    rejected: number[];
    revealed: CardRef | null; // the card a rejected player had to show (null for a Princed Princess)
    lln?: string; // turn_end and turn_skipped: the turn in long-form LLN, e.g. "3.2. g1:H"
};

// JSON turns the server's int dict keys into strings
type BySeat<T> = Record<string, T>;

export type GameEvent =
    | { type: "game_start"; players: string[]; strategies: string[] }
    | { type: "round_start"; number: number; dealer: number }
    | TurnEvent
    | { type: "showdown"; contender_hands: BySeat<CardRef>; discard_totals: BySeat<number>; winners: number[] }
    | { type: "round_end"; number: number; winners: number[] }
    | { type: "game_end"; winner: number; scores: BySeat<number> };

export type Prompt =
    | { kind: "card"; options: GameCardId[]; playable: boolean[]; forced: boolean }
    | { kind: "target"; options: number[]; card: GameCardId; cancellable?: boolean }
    | { kind: "guess"; options: GameCardId[]; target: number; cancellable?: boolean }; // cancellable: "Back" picks a card again

export type ServerMessage =
    | (GameEvent & { table: TableView })
    | { type: "prompt"; prompt: Prompt; table: TableView }
    | { type: "table"; table: TableView }
    | { type: "status"; running: boolean; paused: boolean; reveal: boolean }
    | { type: "error"; message: string };