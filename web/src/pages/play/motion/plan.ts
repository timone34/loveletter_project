import { cardName, type CardId } from "../../../components/cardData";
import type { FeedEntry } from "../useGame";
import type { PlayerView, TableView } from "../types";
import type { Speed } from "../config";

// ----- What an animation is made of ----- //
//
// The table itself is always drawn straight from the newest snapshot. The
// animations are drawn on top of it (FlightLayer.tsx): a "ghost" copy of a
// card flies from where it was (in the old snapshot) to where it is now, and
// the real card at the destination stays hidden until the ghost lands.
//
// Cards are just names ("guard"), so with two Guards on the table a diff of
// the snapshots couldn't tell which one moved. That's why the moves are worked
// out from the event instead: a turn_end says exactly what was played, on
// whom, and what happened.
//
// Places on the table are "slots", the data-slot attribute of each card:
//   "s2-h0"  seat 2, hand, first card
//   "s2-d3"  seat 2, discard pile, fourth card
//   "deck"   the top of the deck
//   "burn"   the burned card, set aside next to the deck
//
// Times are in beats; FlightLayer turns them into seconds by the table speed.

export type Slot = string;

export type Flight = {
  kind: "move" | "peek"; // peek: goes partway toward `to` and comes back to `from`
  from: Slot;
  to: Slot;
  fromCard: CardId | null; // the face shown at the start (null = face down)
  toCard: CardId | null; // the face shown at the end: the ghost flips over if they differ
  delay: number; // beats
  duration: number; // beats
};

export type Badge = {
  seat: number;
  text: string;
  tone: "good" | "bad" | "neutral";
  delay: number; // beats
};

export type MotionPlan = { flights: Flight[]; badges: Badge[] };

// Seconds per beat, by table speed. A turn_end takes at most three beats,
// which fits in the server's pause after it (PACE in server.py).
export const BEAT: Record<Speed, number> = { slow: 0.6, normal: 0.42, fast: 0.22 };
export const BROWSE_BEAT = 0.26; // stepping through the log: a bit quicker than live

// How long a plan's card flights take, in beats (badges may outlast it).
export function planLength(plan: MotionPlan | null): number {
  return plan ? Math.max(0, ...plan.flights.map((f) => f.delay + f.duration)) : 0;
}

// The same moves played backwards, for stepping back through the log: every
// card flies from where it ended up to where it came from, last move first.
// No badges: they describe what happened, which is being undone.
export function reversePlan(plan: MotionPlan | null): MotionPlan | null {
  if (!plan) return null;
  const end = planLength(plan);
  const flights = plan.flights.map((f): Flight => {
    const delay = end - f.delay - f.duration;
    return f.kind === "peek"
      ? { ...f, delay }
      : { ...f, from: f.to, to: f.from, fromCard: f.toCard, toCard: f.fromCard, delay };
  });
  return flights.length ? { flights, badges: [] } : null;
}

// "Reveal hands" toggled: every card that changes between face down and face
// up turns over where it lies, one after another.
export function planFlip(before: TableView, after: TableView): MotionPlan | null {
  const flights: Flight[] = [];
  const turn = (slot: Slot, fromCard: CardId | null, toCard: CardId | null) => {
    if ((fromCard === null) === (toCard === null)) return;
    flights.push({ kind: "move", from: slot, to: slot, fromCard, toCard, delay: 0.3 * flights.length, duration: 1.2 });
  };
  for (const p of after.players) {
    p.hand.forEach((card, i) => turn(hand(p.seat, i), before.players[p.seat]?.hand[i] ?? null, card));
  }
  if (after.round > 0 && !after.burnTaken) turn(BURN, before.burn ?? null, after.burn ?? null);
  return flights.length ? { flights, badges: [] } : null;
}

export const hand = (seat: number, i: number): Slot => `s${seat}-h${i}`;
export const discard = (seat: number, i: number): Slot => `s${seat}-d${i}`;
export const DECK: Slot = "deck";
export const BURN: Slot = "burn";

// What to animate for one event, comparing entry.before with entry.table.
// Returns null when there is nothing to animate.
export function planMotion(entry: FeedEntry): MotionPlan | null {
  const { event, table: after, before } = entry;
  if (!before) return null;

  const flights: Flight[] = [];
  const badges: Badge[] = [];
  const A = (seat: number) => after.players[seat];
  const B = (seat: number) => before.players[seat];

  switch (event.type) {
    case "round_start": {
      // the deal: one card set aside (burned), then one card each, starting left of the dealer
      flights.push(move(DECK, BURN, null, after.burn ?? null, 0));
      const n = after.players.length;
      for (let k = 0; k < n; k++) {
        const seat = (event.dealer + 1 + k) % n;
        if (A(seat).hand.length === 0) continue;
        flights.push(move(DECK, hand(seat, 0), null, A(seat).hand[0], 0.35 * (k + 1)));
      }
      break;
    }

    case "turn_start": {
      // the draw: deck -> the new last card in the hand
      const h = A(event.seat).hand;
      if (h.length > B(event.seat).hand.length) {
        flights.push(move(DECK, hand(event.seat, h.length - 1), null, h[h.length - 1], 0));
      }
      break;
    }

    case "turn_end":
      planTurn(entry, flights, badges);
      break;

    case "showdown":
      // the remaining hands turn face up
      for (const key of Object.keys(event.contender_hands)) {
        const seat = Number(key);
        const was = B(seat).hand[0] ?? null;
        const now = A(seat).hand[0] ?? null;
        if (was === null && now !== null) {
          flights.push({ kind: "move", from: hand(seat, 0), to: hand(seat, 0), fromCard: null, toCard: now, delay: 0.3 * seat, duration: 1 });
        }
      }
      break;

    case "round_end":
      for (const seat of event.winners) badges.push({ seat, text: "Wins the round", tone: "good", delay: 0 });
      break;

    case "game_end":
      badges.push({ seat: event.winner, text: "Wins the game!", tone: "good", delay: 0 });
      break;
  }

  return flights.length || badges.length ? { flights, badges } : null;
}

function planTurn(entry: FeedEntry, flights: Flight[], badges: Badge[]) {
  const { event, table: after, before } = entry;
  if (event.type !== "turn_end" || !before || !event.played) return;

  const s = event.seat;
  const t = event.target;
  const played = event.played;
  const actorBefore = before.players[s];
  const actorAfter = after.players[s];
  const protectedTarget = event.outcome === "PROTECTED";
  const rejected = new Set(event.rejected);
  const princed = new Set<number>(); // seats whose last card the Prince already sent to their discards

  // 1. The played card: from the hand onto the discard pile, turning face up.
  // An opponent's hand is face down, so which of their two cards it was isn't
  // known; then it leaves from the newest (drawn) slot.
  const pi = indexOf(actorBefore, played);
  const ri = actorBefore.hand.length === 2 ? 1 - pi : -1; // the card the actor keeps
  const playedAt = actorBefore.discards.length;
  flights.push(move(hand(s, pi), discard(s, playedAt), actorBefore.hand[pi] ?? null, played, 0));

  // the kept card slides over when the left one was played
  const slideKept = () => {
    if (ri === 1 && actorAfter.hand.length === 1 && !rejected.has(s)) {
      flights.push(move(hand(s, 1), hand(s, 0), actorBefore.hand[1], actorAfter.hand[0], 0));
    }
  };

  if (t !== null && protectedTarget) {
    badges.push({ seat: t, text: "Protected", tone: "neutral", delay: 1 });
    slideKept();
  } else {
    switch (played) {
      case "guard": {
        slideKept();
        if (t === null) break; // nobody to target
        const guess = cardName(event.guess);
        const correct = event.outcome === "CORRECT";
        badges.push({ seat: t, text: correct ? `${guess}? Yes!` : `${guess}? No`, tone: correct ? "bad" : "neutral", delay: 1 });
        break;
      }

      case "priest":
        slideKept();
        if (t === null) break;
        // the target's card leans toward the actor, face up if you may see it
        flights.push({
          kind: "peek",
          from: hand(t, 0),
          to: hand(s, 0),
          fromCard: before.players[t].hand[0] ?? null,
          toCard: event.seen ?? before.players[t].hand[0] ?? null,
          delay: 1,
          duration: 2,
        });
        break;

      case "baron": {
        slideKept();
        if (t === null) break;
        const tie = event.outcome === "DRAW";
        const won = event.outcome === "WIN";
        badges.push({ seat: s, text: tie ? "Tie" : won ? "Higher" : "Lower", tone: tie ? "neutral" : won ? "good" : "bad", delay: 1 });
        badges.push({ seat: t, text: tie ? "Tie" : won ? "Lower" : "Higher", tone: tie ? "neutral" : won ? "bad" : "good", delay: 1 });
        break;
      }

      case "handmaid":
        slideKept();
        badges.push({ seat: s, text: "Protected", tone: "good", delay: 1 });
        break;

      case "prince": {
        if (t === null) break;
        const targetBefore = before.players[t];
        const targetAfter = after.players[t];
        // the target's card goes to their discards (for yourself: the kept card)
        const from = t === s ? hand(s, ri) : hand(t, 0);
        const fromCard = t === s ? actorBefore.hand[ri] ?? null : targetBefore.hand[0] ?? null;
        const at = targetBefore.discards.length + (t === s ? 1 : 0);
        if (t !== s) slideKept();
        flights.push(move(from, discard(t, at), fromCard, event.discarded, 1));
        princed.add(t);
        // and they draw a new one, unless the Princess was discarded:
        // from the deck, or the burned card once the deck is empty
        if (targetAfter.hand.length > 0) {
          const source = after.burnTaken && !before.burnTaken ? BURN : DECK;
          flights.push(move(source, hand(t, 0), source === BURN ? before.burn ?? null : null, targetAfter.hand[0], 2));
        }
        break;
      }

      case "king": {
        if (t === null || t === s) {
          slideKept();
          break;
        }
        // the two hands cross
        flights.push(move(hand(s, ri), hand(t, 0), actorBefore.hand[ri] ?? null, after.players[t].hand[0] ?? null, 1));
        flights.push(move(hand(t, 0), hand(s, 0), before.players[t].hand[0] ?? null, actorAfter.hand[0] ?? null, 1));
        break;
      }

      default: // countess, princess: no target
        if (!rejected.has(s)) slideKept();
    }
  }

  // 2. Rejected players lay down their last card, face up (a Guard's or
  // Baron's victim, or the actor after a Baron or the Princess).
  for (const r of event.rejected) {
    badges.push({ seat: r, text: "Rejected", tone: "bad", delay: 2 });
    if (princed.has(r) || (r === s && ri < 0)) continue;
    const discards = after.players[r].discards;
    const from = r === s ? hand(s, ri) : hand(r, 0);
    const fromCard = r === s ? actorBefore.hand[ri] ?? null : before.players[r].hand[0] ?? null;
    flights.push(move(from, discard(r, discards.length - 1), fromCard, discards[discards.length - 1] ?? null, 2));
  }
}

function move(from: Slot, to: Slot, fromCard: CardId | null, toCard: CardId | null, delay: number): Flight {
  return { kind: "move", from, to, fromCard, toCard, delay, duration: 1 };
}

// Where `card` is in a player's hand; for a face-down hand the last slot.
function indexOf(player: PlayerView, card: CardId): number {
  const i = player.hand.lastIndexOf(card);
  return i >= 0 ? i : Math.max(0, player.hand.length - 1);
}
