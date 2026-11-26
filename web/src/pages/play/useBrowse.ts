import { useCallback, useEffect, useRef, useState } from "react";
import { isLogged, type FeedEntry, type FlipEvent } from "./useGame";
import type { MotionStep } from "./motion/FlightLayer";
import { BROWSE_BEAT, BEAT, planFlip, planLength, planMotion } from "./motion/plan";
import type { Speed } from "./config";

// Further than this many events away, browsing jumps instead of animating
// every step (one turn is two events: turn_start and turn_end).
const MAX_ANIMATED = 6;

// Browsing the action log, with animations.
//
// `shown` is the feed index on the table (null = live). Going somewhere else
// walks there one event at a time: each step forward replays that event's
// animation, each step back plays it in reverse. Pressing again mid-way
// carries on from where the table is; far jumps (or many quick presses) skip
// the animation.
// A position in the feed of one game (game = the seq of its game_start), so a
// new game never shows an index of the previous one.
type Pos = { game: number; index: number } | null;
const gameOf = (f: FeedEntry[]) => f[0]?.seq ?? 0;
const indexIn = (pos: Pos, f: FeedEntry[]) => (pos && pos.game === gameOf(f) && pos.index < f.length ? pos.index : null);

export function useBrowse(feed: FeedEntry[], speed: Speed, flip: FlipEvent | null) {
  const [cursor, setCursor] = useState<Pos>(null); // the event on the table; null = live
  const [target, setTarget] = useState<Pos>(null); // where it's headed (highlighted in the log)
  const [step, setStep] = useState<MotionStep | null>(null); // the history animation playing
  const [resumedAt, setResumedAt] = useState(0); // back to live at this seq: animate only newer events

  // the timer chain reads these, so it always sees the newest values
  const feedRef = useRef(feed);
  const cursorRef = useRef<Pos>(null);
  const targetRef = useRef<Pos>(null);
  const timer = useRef<number | undefined>(undefined);
  const keys = useRef(1_000_000_000); // history keys never collide with live event seqs
  const flipRef = useRef(flip);
  useEffect(() => {
    feedRef.current = feed;
    flipRef.current = flip;
  }, [feed, flip]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const place = useCallback((index: number | null) => {
    const pos = index === null ? null : { game: gameOf(feedRef.current), index };
    cursorRef.current = pos;
    setCursor(pos);
  }, []);

  // arrive at `to` (null = live) without animating
  const settle = useCallback((to: number | null) => {
    setStep(null);
    place(to);
    // back to live: don't replay what happened meanwhile (an event, or a reveal toggled while browsing)
    if (to === null) setResumedAt(Math.max(feedRef.current[feedRef.current.length - 1]?.seq ?? 0, flipRef.current?.seq ?? 0));
  }, [place]);

  // the timer calls the newest walk through this ref (a callback can't name itself)
  const walkRef = useRef<(from: number, to: number | null, game: number) => void>(() => {});

  // one event toward the target, then wait for its animation and do the next
  const walk = useCallback((from: number, to: number | null, game: number) => {
    const f = feedRef.current;
    if (gameOf(f) !== game) return setStep(null); // a new game started meanwhile: it's live
    const end = to ?? f.length - 1;
    if (from === end || !f[from] || !f[end]) return settle(to);

    const dir = end > from ? 1 : -1;
    const next = from + dir;
    // the entry whose animation plays, with `before` = the table on screen when going forward
    const entry = dir > 0 ? { ...f[next], before: f[from].table } : { ...f[from], before: f[next].table };
    setStep({ key: ++keys.current, entry, reverse: dir < 0, beat: BROWSE_BEAT });
    place(next);
    const seconds = Math.max(0.12, planLength(planMotion(entry)) * BROWSE_BEAT);
    timer.current = window.setTimeout(() => walkRef.current(next, to, game), seconds * 1000);
  }, [place, settle]);
  useEffect(() => {
    walkRef.current = walk;
  }, [walk]);

  const goTo = useCallback((to: number | null) => {
    window.clearTimeout(timer.current);
    const f = feedRef.current;
    const pos = to === null ? null : { game: gameOf(f), index: to };
    targetRef.current = pos;
    setTarget(pos);
    const from = indexIn(cursorRef.current, f) ?? f.length - 1;
    const end = to ?? f.length - 1;
    if (Math.abs(end - from) > MAX_ANIMATED) settle(to);
    else walk(from, to, gameOf(f));
  }, [settle, walk]);

  // positions in an earlier game count as live
  const shown = indexIn(cursor, feed);
  const headed = indexIn(target, feed);
  const live = shown === null && headed === null;

  // one logged line back or forward from where we're headed; past the newest is live
  const stepLog = useCallback((dir: -1 | 1) => {
    const f = feedRef.current;
    const logged = f.map((e, i) => (isLogged(e) ? i : -1)).filter((i) => i >= 0);
    if (!logged.length) return;
    const from = indexIn(targetRef.current, f);
    if (from === null) {
      // live = the newest event; back = the line before it (the newest line, if that's a draw)
      const before = logged.filter((i) => i < f.length - 1);
      if (dir < 0 && before.length) goTo(before[before.length - 1]);
      return;
    }
    const at = logged.findIndex((i) => i >= from);
    const next = at + dir;
    goTo(next >= logged.length ? null : logged[Math.max(0, next)]);
  }, [goTo]);

  const latest = feed[feed.length - 1];
  // live: animate each new event as it arrives (not the one we came back to),
  // or the cards turning over when "reveal hands" was the newest thing
  let motion: MotionStep | null = step;
  if (live) {
    const newest = Math.max(latest?.seq ?? 0, flip?.seq ?? 0);
    if (newest <= resumedAt) motion = null;
    else if (flip && flip.seq === newest) motion = { key: flip.seq, plan: planFlip(flip.before, flip.after), reverse: false, beat: BEAT[speed] };
    else motion = latest ? { key: latest.seq, entry: latest, reverse: false, beat: BEAT[speed] } : null;
  }

  return { shown, headed, live, motion, goTo, stepLog };
}
