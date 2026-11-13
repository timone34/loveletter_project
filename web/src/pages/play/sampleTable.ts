import type { TableView } from "./types";

export const SAMPLE_TABLE: TableView = {
    round: 2,
    dealer: 0,
    deckCount: 6,
    winsNeeded: 3,
    youSeat: 1,
    players: [
        {
            seat: 0, name: "Alice", strategy: "Random Strategy", roundWins: 2,
            hand: [], discards: ["handmaid", "princess"], rejected: true,
        },
        {
            seat: 1, name: "You", strategy: "Player Input", roundWins: 1,
            hand: ["prince", "countess"], discards: ["guard", "baron", "prince", "guard"],
        },
        {
            seat: 2, name: "Charlie", strategy: "Random Strategy", roundWins: 1,
            hand: [null, null], discards: ["guard", "priest", "guard", "priest", "guard"],
        },
        {
            seat: 3, name: "Diane", strategy: "No Princess", roundWins: 0,
            hand: [null], discards: ["handmaid"], active: true, protected: true,
        },
    ]
}