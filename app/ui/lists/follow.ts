// Whether a list follows its end, a transcript's way: a state the reader holds, never one read
// from where the list happens to be (ruling R519).
//
// - **On** as the list opens at its end, by `G` and "Jump to the latest" (`toEnd`), and as the
//   reader scrolls back to the end.
// - **Off** only by the reader: a key that takes the cursor to another row (`left`), a hand on
//   the list (a drag, a touchpad's swipe, the scroll bar's thumb) that leaves the end, or a scroll
//   up, by a wheel or the keys, that ends away from the end.
// - **While on**, Native Shell pins the list to its end at every layout, however far the end
//   moved (`pins`): the list moves with the content in the frame it changes. A move away from the
//   end the reader did not make is put back, at once, with a jump to the end (`back`).
//
// GTK clamps the offset to the content when the content shrinks, as a reply's finished block
// becomes a row of its own, at its estimated height until measured; Native Shell then scrolls by
// what the content grew from where it thinks the list is, and lands short of the end. The scroll
// that reports it looks like a reader's, and a reader's first wheel notch like it: only the end of
// a scroll (`ended`) says a hand made it. So a move up away from the end, with no hand on the
// list, lets the list go (`pins` off) for a moment, from its last move up: ended within it, the
// reader left; not, the layout moved it, and it goes back to the end.
import { type Accessor, signal, untracked } from "nsh";

/** How near its end a list must be to be at it, in points. */
export const NEAR_END = 48;

/**
 * How long after a move up the end of a scroll says the reader made it, in milliseconds: GTK ends
 * a wheel's scroll 150 ms after its last notch.
 */
export const LEAVING = 300;

/** What a scroll event says: where the list is, how long its content is, how tall it is. */
export type Scrolled = { offset: number; content: number; size: number };

export type Follow = {
  following: Accessor<boolean>;
  /** Native Shell pins the list to its end: while following, and no move of the reader's is in doubt. */
  pins: Accessor<boolean>;
  /** Turns following on or off, for the reader's `G`, a jump, or a key to another row. */
  follows: (now: boolean) => void;
  scrolled: (event: Scrolled) => void;
  /** A hand is on the list, or let go. */
  hand: (on: boolean) => void;
  /** A scroll came to rest: a wheel's, a glide's, a key's. */
  ended: () => void;
};

export function createFollow(options: {
  /** Following as it opens: at its end. */
  atEnd: boolean;
  /** Where it opens, in points. */
  offset: number;
  /** A jump to the end, where it is now. */
  back: () => void;
  onFollowing?: (now: boolean) => void;
  /** Runs `then` after `ms`, and gives what cancels it: a test's clock in place of the timers. */
  later?: (ms: number, then: () => void) => () => void;
}): Follow {
  const later =
    options.later ??
    ((ms: number, then: () => void) => {
      const timer = setTimeout(then, ms);
      return () => clearTimeout(timer);
    });
  const following = signal(options.atEnd);
  const pins = signal(options.atEnd);
  // Where it was at its last scroll, how long its content was, and how tall it was.
  let rested = options.offset;
  let length = 0;
  let size = 0;
  let hand = false;
  // A move up away from the end, not known yet to be the reader's: until it is, or `LEAVING`
  // passes, the list is let go.
  let doubt: (() => void) | undefined;
  const settle = () => {
    doubt?.();
    doubt = undefined;
  };

  const follows = (now: boolean) => {
    settle();
    pins.set(now && !hand);
    if (untracked(following) !== now) {
      following.set(now);
      options.onFollowing?.(now);
    }
  };

  // Whether it was at its end at its last scroll.
  let there = options.atEnd;

  const scrolled = (event: Scrolled) => {
    const end = event.content - event.size;
    // Content that shrinks moves the offset up with it (ruling R473), and GTK pulls back an
    // offset past the content's end to that end: neither is the reader going up.
    const shrunk = Math.max(0, length - event.content);
    const up = event.offset < Math.min(rested, length - size) - shrunk - 1;
    const down = event.offset > rested;
    rested = event.offset;
    length = event.content;
    size = event.size;
    there = event.offset >= end - NEAR_END;
    if (there) {
      // Back at the end by the reader's own scroll down, it follows again; pulled back there as
      // the content shrank under a list let go, it stays let go.
      if (!untracked(following) && down) follows(true);
      return;
    }
    if (!untracked(following)) return;
    if (hand) {
      follows(false);
    } else if (up) {
      // Each move up while in doubt is one more: a wheel's notches, a touchpad's swipe. The doubt
      // runs from the last.
      settle();
      pins.set(false);
      doubt = later(LEAVING, () => {
        doubt = undefined;
        pins.set(true);
        options.back();
      });
    } else if (doubt === undefined) {
      options.back();
    }
  };

  return {
    ended: () => {
      if (doubt !== undefined) follows(there);
    },
    follows,
    following,
    hand: (on) => {
      hand = on;
      // A hand on the list holds it: let go, at the end, it pins again.
      pins.set(untracked(following) && !on && doubt === undefined);
      if (!on && untracked(following)) options.back();
    },
    pins,
    scrolled,
  };
}
