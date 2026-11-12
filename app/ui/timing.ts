// How long an interaction takes to draw: from a key the registry heard, or a `navigate`, to the
// frame that draws its result, with the records it reads. The performance decision's target is 100
// ms: a development build warns in the console when an interaction passes it, with what was done
// and how long it took. A release build times nothing.
//
// An interaction ends at the second frame after the first one at which nothing the app reads is
// still waiting for the server's first value (`settledWhen`, which the store says): the first
// frame's callback runs before that frame is painted, so the next one's comes after it. It may
// overstate by a frame, never understate. A new interaction ends the one before it, unmeasured.
// The navigation benchmark listens (`onTimed`), and prints every interaction it caused.

/**
 * An interaction drawn: what started it, the milliseconds from it to the frame drawn, to the first
 * frame after it (what its own JavaScript cost), and to the first frame with every record come.
 */
export type Timed = { what: string; ms: number; first: number; settled: number };

/** The decision's target, in milliseconds. */
export const TARGET = 100;

/** How long an interaction is followed at most, past which it is left untimed: 10 s. */
const LONGEST = 10_000;

const timing = process.env.NODE_ENV !== "production";
let settled: () => boolean = () => true;
const listeners = new Set<(timed: Timed) => void>();
let current = 0;
/** Whether an interaction started in this turn of the JavaScript, which a second one joins. */
let joining = false;
/** Whether an interaction is followed now, which one that `joins` leaves to finish. */
let following = false;

/** Says whether nothing the app reads waits for the server now: the store gives it once. */
export function settledWhen(check: () => boolean) {
  settled = check;
}

/** Hears every interaction drawn, until the returned function is called. */
export function onTimed(listener: (timed: Timed) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Starts timing `what`, a key's name or a route, unless one started in this same turn of the
 * JavaScript: `g h` names its key, and the `navigate` it calls joins it. One that `joins`, a key
 * typed in a field, also leaves an interaction still followed to finish: the field a key opened
 * takes its text as it shows.
 */
export function interaction(what: string, options: { joins?: boolean } = {}) {
  if (!timing) return;
  if (joining || (options.joins === true && following)) return;
  joining = true;
  void Promise.resolve().then(() => (joining = false));
  const id = ++current;
  following = true;
  const start = performance.now();
  let first: number | undefined;
  let ready: number | undefined;
  const frame = () => {
    if (id !== current) return;
    const ms = performance.now() - start;
    if (ms > LONGEST) return void (following = false);
    first ??= ms;
    if (ready !== undefined) return done({ first, ms, settled: ready, what });
    if (settled()) ready = ms;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function done(timed: Timed) {
  following = false;
  if (timed.ms > TARGET) {
    console.warn(
      `[uraeda] ${timed.what} took ${Math.round(timed.ms)} ms to draw, over the ${TARGET} ms target`,
    );
  }
  for (const listener of listeners) listener(timed);
}
