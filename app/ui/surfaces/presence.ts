// How what comes and goes stays drawn for its way out. Motion means a change of state: a light or
// an overlay moves when its state just changed, once, and then rests. What is already there as
// its view appears does not move.
import {
  type Accessor,
  type AnimatedValue,
  cleanup,
  createAnimatedValue,
  createMotion,
  effect,
  type MotionSpec,
  reduceMotion,
  signal,
  untracked,
} from "nsh";
import { tokens } from "../tokens";

/** Calls `changed` with each new value of `on`, never with its first. */
export function onChange(on: () => boolean, changed: (now: boolean) => void) {
  let was = untracked(on);
  effect(() => {
    const now = on();
    if (now !== was) {
      was = now;
      untracked(() => changed(now));
    }
  });
}

/**
 * A light that fades in as `on` turns true and out as it turns false, over `duration`
 * milliseconds: `shown` says whether it is still drawn, and `opacity` is its share. With reduced
 * motion it switches.
 */
export function fading(
  on: () => boolean,
  duration: () => number,
): { opacity: AnimatedValue; shown: Accessor<boolean> } {
  const shown = signal(untracked(on));
  const opacity = createAnimatedValue(untracked(on) ? 1 : 0);
  onChange(on, (now) => {
    if (now) {
      shown.set(true);
    }
    // A fade that starts interrupts the one that ran, which then did not finish.
    void opacity
      .timing(now ? 1 : 0, { duration: reduceMotion() ? 0 : duration() })
      .then(({ finished }) => {
        if (finished && !now) {
          shown.set(false);
        }
      });
  });
  cleanup(() => void opacity.stop());
  return { opacity, shown };
}

/** How far, and which way, something travels as it comes: an overlay rises, a sheet rises more. */
export type Travel = { x?: number; y?: number };

const frames = (travel: Travel, coming: boolean): MotionSpec["keyframes"] => {
  // With reduced motion nothing travels: an overlay only fades.
  if (reduceMotion()) {
    return { opacity: coming ? [0, 1] : [1, 0] };
  }
  const [x, y] = [travel.x ?? 0, travel.y ?? 0];
  return {
    opacity: coming ? [0, 1] : [1, 0],
    translateX: coming ? [x, 0] : [0, x],
    translateY: coming ? [y, 0] : [0, y],
  };
};

/**
 * What an overlay comes and goes with: in, slowing down, as `open` turns true or as it appears
 * open; out, speeding up, as `open` turns false. `shown` stays true for its way out, and `style`
 * is the opacity and the transform of its box.
 */
export function presence(open: () => boolean, travel: () => Travel) {
  const shown = signal(untracked(open));
  const motion = createMotion({ initial: { opacity: 0 } });
  let leaving: ReturnType<typeof setTimeout> | undefined;
  const play = (coming: boolean) => {
    const timing = coming ? tokens.motion.in : tokens.motion.out;
    void motion.play({
      duration: timing.duration,
      easing: [...timing.curve],
      ignoreReduceMotion: true,
      keyframes: frames(travel(), coming),
    });
    return timing.duration;
  };
  const change = (now: boolean) => {
    clearTimeout(leaving);
    if (now) {
      shown.set(true);
      play(true);
    } else {
      leaving = setTimeout(() => shown.set(false), play(false));
    }
  };
  if (untracked(open)) {
    play(true);
  }
  onChange(open, change);
  cleanup(() => clearTimeout(leaving));
  return { shown: shown as Accessor<boolean>, style: motion.style };
}
