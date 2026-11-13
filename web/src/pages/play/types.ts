import type { CardId } from "../../components/cardData";

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
    youSeat: number;
    players: PlayerView[]; // in seat order
}