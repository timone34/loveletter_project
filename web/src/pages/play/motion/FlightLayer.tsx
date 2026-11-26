import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Card } from "../../../components/Card";
import type { FeedEntry } from "../useGame";
import { planMotion, type Badge, type Flight, type MotionPlan } from "./plan";
import "./FlightLayer.css";

// One event to animate: the newest one while live, or one step through the
// log while browsing.
export type MotionStep = {
  key: number; // a new key = a new animation
  entry?: FeedEntry; // the event to animate; its `before` must be the table that was on screen
  plan?: MotionPlan | null; // or a ready-made plan (e.g. turning cards over for "reveal hands")
  beat: number; // seconds per beat
};

type Rects = Map<string, DOMRect>; // data-slot / data-seat -> where it is on screen

type Ghost = Flight & { id: number; start: DOMRect; end: DOMRect };
type Pop = Badge & { id: number; rect: DOMRect };

type Props = {
  step: MotionStep | null; // null: nothing to animate
  root: RefObject<HTMLElement | null>; // the felt: where the data-slot cards are
  dim?: boolean; // an earlier turn is shown: dim the ghosts like the felt
};

// Draws the animation of one event on top of the table (see plan.ts).
//
// How it works, per event:
// 1. render: planMotion() lists the flights, and a <style> hides each
//    flight's destination card, in the same paint as the new snapshot.
// 2. layout effect (after React updated the DOM, before the browser paints):
//    measure where every slot is now. Together with the measurement of the
//    previous render (the old snapshot) that gives each ghost its start and
//    end rectangle.
// 3. motion animates each ghost; when one lands it's removed and the real
//    card underneath shows again.
export function FlightLayer({ step, root, dim = false }: Props) {
  const reduced = useReducedMotion();
  const plan = useMemo(() => {
    if (!step || reduced) return null;
    return step.plan !== undefined ? step.plan : step.entry ? planMotion(step.entry) : null;
  }, [step, reduced]);

  const [active, setActive] = useState<{ seq: number; ghosts: Ghost[]; pops: Pop[] }>({ seq: -1, ghosts: [], pops: [] });
  const rects = useRef<Rects>(new Map());
  const started = useRef(-1); // the step key whose ghosts were built
  const ids = useRef(0);

  // Runs after every render (no dependency list on purpose): the positions
  // measured now are the "before" positions of the next event.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const now = measure(root.current);
    let next: typeof active | null = null;
    if (plan && step && started.current !== step.key) {
      started.current = step.key;
      const old = rects.current;
      const ghosts: Ghost[] = [];
      for (const f of plan.flights) {
        const start = (f.from === "deck" ? now : old).get(f.from);
        const end = (f.kind === "peek" ? old : now).get(f.to);
        if (start && end) ghosts.push({ ...f, id: ++ids.current, start, end });
      }
      const pops: Pop[] = [];
      for (const b of plan.badges) {
        const rect = now.get(`seat${b.seat}`);
        if (rect) pops.push({ ...b, id: ++ids.current, rect });
      }
      next = { seq: step.key, ghosts, pops };
    } else if (!plan && (active.ghosts.length || active.pops.length)) {
      // browsing the log, or a new event without animations: drop what's left
      next = { seq: -1, ghosts: [], pops: [] };
    }
    rects.current = now;
    // Setting state here is deliberate: it renders the ghosts again before the
    // browser paints, so they appear in the same frame as the new snapshot.
    if (next) setActive(next);
  });

  const current = plan && step && active.seq === step.key ? active : null;

  // destinations stay hidden until their ghost lands (before the ghosts exist: all of them)
  // (a peek hides the card it lifts, which stays where it is)
  // (and never the deck: cards flying back onto it land on the pile)
  const spot = (f: Flight) => (f.kind === "peek" ? f.from : f.to);
  const hidden = (!plan ? [] : current ? current.ghosts.map(spot) : plan.flights.map(spot)).filter((s) => s !== "deck");
  const css = hidden.map((slot) => `[data-slot="${slot}"]{visibility:hidden}`).join("\n");

  const land = (id: number) =>
    setActive((a) => ({ ...a, ghosts: a.ghosts.filter((g) => g.id !== id) }));
  const fade = (id: number) =>
    setActive((a) => ({ ...a, pops: a.pops.filter((p) => p.id !== id) }));

  const beat = step?.beat ?? 0.4;

  return (
    <>
      {css && <style>{css}</style>}
      {current && (
        <div className={dim ? "flights flights--past" : "flights"} aria-hidden="true">
          {current.ghosts.map((g) => (
            <GhostCard key={g.id} ghost={g} beat={beat} onDone={() => land(g.id)} />
          ))}
          {current.pops.map((p) => (
            <BadgePop key={p.id} pop={p} beat={beat} onDone={() => fade(p.id)} />
          ))}
        </div>
      )}
    </>
  );
}

// Every [data-slot] and [data-seat] under root, by name.
function measure(root: HTMLElement | null): Rects {
  const rects: Rects = new Map();
  if (!root) return rects;
  root.querySelectorAll<HTMLElement>("[data-slot]").forEach((el) => rects.set(el.dataset.slot!, el.getBoundingClientRect()));
  root.querySelectorAll<HTMLElement>("[data-seat]").forEach((el) => rects.set(`seat${el.dataset.seat}`, el.getBoundingClientRect()));
  return rects;
}

// One card in flight: positioned at its start, moved with x/y and scaled to
// the destination's size. Two faces back to back (CSS backface-visibility),
// so turning it 180° shows the other one.
function GhostCard({ ghost, beat, onDone }: { ghost: Ghost; beat: number; onDone: () => void }) {
  const { start, end } = ghost;
  const dx = end.left - start.left;
  const dy = end.top - start.top;
  const scale = end.width / start.width;
  const flips = ghost.fromCard !== ghost.toCard;
  const timing = { delay: ghost.delay * beat, duration: ghost.duration * beat };

  // a peek leans 40% of the way toward the looker, holds, and goes back
  const target =
    ghost.kind === "peek"
      ? { x: [0, dx * 0.4, dx * 0.4, 0], y: [0, dy * 0.4, dy * 0.4, 0], scale: [1, 1.25, 1.25, 1] }
      : { x: dx, y: dy, scale: [1, Math.max(1, scale) * 1.12, scale] };
  const turn = ghost.kind === "peek" ? [0, 180, 180, 0] : 180;
  const times = ghost.kind === "peek" ? [0, 0.25, 0.75, 1] : undefined;

  const width = `${start.width}px`;
  return (
    <motion.div
      className="flight"
      style={{ left: start.left, top: start.top, width: start.width }}
      initial={{ x: 0, y: 0, scale: 1 }}
      animate={target}
      transition={{ ...timing, ease: [0.3, 0.7, 0.2, 1], times }}
      onAnimationComplete={onDone}
    >
      <motion.div
        className="flight__turn"
        initial={{ rotateY: 0 }}
        animate={{ rotateY: flips ? turn : 0 }}
        transition={{ ...timing, times }}
      >
        <Card id={ghost.fromCard ?? undefined} faceDown={ghost.fromCard === null} width={width} className="flight__face" />
        {flips && (
          <Card id={ghost.toCard ?? undefined} faceDown={ghost.toCard === null} width={width} className="flight__face flight__face--back" />
        )}
      </motion.div>
    </motion.div>
  );
}

// A word popping up over a seat: "Rejected", "Priest? No", "Wins the round".
function BadgePop({ pop, beat, onDone }: { pop: Pop; beat: number; onDone: () => void }) {
  const { rect } = pop;
  return (
    <motion.div
      className={`flight-badge flight-badge--${pop.tone}`}
      style={{ left: rect.left + rect.width / 2, top: rect.top + rect.height / 2 }}
      initial={{ opacity: 0, scale: 0.6, x: "-50%", y: "-50%" }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.08, 1, 0.96] }}
      transition={{ delay: pop.delay * beat, duration: Math.max(1.4, 3 * beat), times: [0, 0.15, 0.8, 1] }}
      onAnimationComplete={onDone}
    >
      {pop.text}
    </motion.div>
  );
}
