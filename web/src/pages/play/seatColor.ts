// One colour per seat, the same ones the Stats page uses per lineup position
// (--series-1..4 in index.css), so a player is recognisable in the log and at the table.
export const seatColor = (seat: number) => `var(--series-${(seat % 4) + 1})`;
