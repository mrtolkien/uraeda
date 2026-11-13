// The leader's runtime: the pending sequence of `sequence.ts`, and the delay that acts on it. The
// menu shows 300 ms after the last key while it is hidden, and once shown it stays and follows each
// key at once. A pending step has no end of its own, a `g` as the leader's (Space, or Ctrl+K): its
// menu, being read, waits for its key, as LazyVim's which-key does. It is closed by Escape, a key
// none of its (which the status line then names for a moment), a layer, a page change, or the
// switch.
import { signal } from "nsh";
import { next, type Step } from "./sequence";
import type { KeyStore } from "./store";
import { CHORD } from "./token";

/** How long after the last key a hidden menu shows: quick typing shows nothing. */
export const SHOW_AFTER = 300;

/** How long the status line says a key was none of the menu's. */
export const MISSED_FOR = 2000;

export type Pressed = {
  /** The key belongs to the sequence: the page does not hear it. */
  consumed: boolean;
  /** The keys of the binding the key completed, for the caller to run. */
  ran: string | null;
};

export function createLeader(store: KeyStore) {
  const step = signal<Step | null>(null);
  /** The keys of a sequence its last key was none of, "space x", for a moment. */
  const missed = signal<string | null>(null);
  let showing: ReturnType<typeof setTimeout> | undefined;
  let forgetting: ReturnType<typeof setTimeout> | undefined;

  const change = (to: Step | null) => {
    clearTimeout(showing);
    step.set(to);
    if (to !== null && !to.isShown) {
      showing = setTimeout(
        () => step.update((now) => now && { ...now, isShown: true }),
        SHOW_AFTER,
      );
    }
  };

  return {
    /** Ends the sequence, if one is pending. */
    end() {
      if (step() !== null) {
        change(null);
      }
    },
    /**
     * Feeds a key to the sequence. A step already pending, or begun by the chord, walks every key
     * that is on, the single-key ones too: only the chord can have begun it with the switch off.
     */
    press(token: string): Pressed {
      const pending = step();
      const walked = pending !== null || token === CHORD ? store.on() : store.active();
      const result = next(
        walked.filter(({ spec }) => spec.when?.() ?? true).map(({ spec }) => spec),
        pending,
        token,
      );
      if (pending !== null || result.step !== null) {
        change(result.step);
      }
      clearTimeout(forgetting);
      missed.set(
        result.missed === true && pending !== null ? [...pending.path, token].join(" ") : null,
      );
      if (result.missed === true) {
        forgetting = setTimeout(() => missed.set(null), MISSED_FOR);
      }
      return { consumed: result.consumed, ran: result.ran };
    },
    /** Shows the menu of the sequence pending now, with no wait: a press on its hint asked. */
    show() {
      const pending = step();
      if (pending !== null && !pending.isShown) {
        change({ ...pending, isShown: true });
      }
    },
    /** The keys of a sequence that ended on a key none of its, read as a signal, for a moment. */
    missed: (): string | null => missed(),
    /** The sequence pending, read as a signal: `null` for none. */
    step: (): Step | null => step(),
  };
}

export type Leader = ReturnType<typeof createLeader>;
