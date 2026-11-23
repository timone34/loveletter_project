import { cardName } from "../../components/cardData";
import type { GameEvent, TableView, TurnEvent } from "./types";

// One sentence per game event. Used for the caption on the felt now,
// and ready to feed the action log later.
export function describe(event: GameEvent, table: TableView): string {
  const you = table.youSeat;
  const name = (seat: number) => (seat === you ? "You" : table.players[seat].name);
  // "Alice plays" / "You play"
  const verb = (seat: number, base: string, third = `${base}s`) => (seat === you ? base : third);
  const isAre = (seat: number) => verb(seat, "are", "is");
  const list = (seats: number[]) => seats.map(name).join(" and ");

  switch (event.type) {
    case "game_start":
      return "A new game. Shuffling the deck…";

    case "round_start":
      return `Round ${event.number}. ${name(event.dealer)} ${verb(event.dealer, "deal")} the cards.`;

    case "turn_start":
      if (event.seat === you) return `Your turn. You drew the ${cardName(event.drawn)}.`;
      return event.drawn
        ? `${name(event.seat)} draws the ${cardName(event.drawn)}.`
        : `${name(event.seat)} draws a card.`;

    case "turn_end":
      return describeTurn(event, you, name, verb, isAre);

    case "turn_skipped":
      return `${name(event.seat)} ${isAre(event.seat)} out of this round.`;

    case "showdown": {
      const hands = Object.entries(event.contender_hands)
        .map(([seat, card]) => `${name(Number(seat))} ${verb(Number(seat), "have", "has")} the ${cardName(card)}`)
        .join(", ");
      const tie = Object.keys(event.discard_totals).length > 0 ? " Tied, so discards decide." : "";
      return `Showdown! ${hands}.${tie}`;
    }

    case "round_end": {
      const [first] = event.winners;
      const wins = event.winners.length === 1 ? verb(first, "win") : "win";
      return `${list(event.winners)} ${wins} round ${event.number}.`;
    }

    case "game_end":
      return `${name(event.winner)} ${verb(event.winner, "win")} the game!`;
  }
}

function describeTurn(
  t: TurnEvent,
  you: number | null, // null when watching
  name: (seat: number) => string,
  verb: (seat: number, base: string, third?: string) => string,
  isAre: (seat: number) => string,
): string {
  if (!t.played) return "";
  const who = name(t.seat);
  const does = (base: string, third?: string) => verb(t.seat, base, third);

  let line = `${who} ${does("play")} the ${cardName(t.played)}`;

  if (t.target === null) {
    line += t.played === "handmaid" ? ` and ${isAre(t.seat)} protected.` : ".";
  } else {
    const target = t.target;
    const object =
      target === t.seat
        ? (t.seat === you ? "yourself" : "themself")
        : target === you ? "you" : name(target);

    if (t.outcome === "PROTECTED") {
      line += ` on ${object}, but ${target === you ? "you are" : "they are"} protected.`;
    } else {
      switch (t.played) {
        case "guard":
          line += ` on ${object} and ${does("guess", "guesses")} ${cardName(t.guess)}. ${t.outcome === "CORRECT" ? "Correct!" : "Wrong."}`;
          break;
        case "priest":
          line += t.seen ? ` on ${object} and ${does("see")} the ${cardName(t.seen)}.` : ` on ${object}.`;
          break;
        case "baron": {
          const result =
            t.outcome === "WIN" ? `${who} ${does("win")} the comparison.`
            : t.outcome === "LOSE" ? `${who} ${does("lose")} the comparison.`
            : "It's a tie.";
          line += ` on ${object}. ${result}`;
          break;
        }
        case "prince":
          line += ` on ${object}. ${name(target)} ${verb(target, "discard")} the ${cardName(t.discarded)}`;
          line += t.redrawn ? ` and ${verb(target, "draw")} the ${cardName(t.redrawn)}.` : ".";
          break;
        case "king":
          line += ` and ${does("swap")} hands with ${object}.`;
          break;
        default:
          line += ` on ${object}.`;
      }
    }
  }

  for (const seat of t.rejected) {
    line += ` ${name(seat)} ${isAre(seat)} rejected.`;
  }
  return line;
}
