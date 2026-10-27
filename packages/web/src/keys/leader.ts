// The leader's runtime: the pending sequence of `sequence.ts`, and the two delays that act on it.
// The menu shows 300 ms after the last key while it is hidden, and once shown it stays and
// follows each key at once; a pending `g` ends two seconds after its key. A step of the leader
// (Space, or Ctrl or Cmd+K) has no end of its own: it is closed by Escape, a layer, a page change, or
// the switch. A plain store, read through `useSyncExternalStore`.
import { CHORD, LEADER, next, type Step } from "./sequence.ts";
import type { KeyStore } from "./store.ts";

/** How long after the last key a hidden menu shows: quick typing shows nothing. */
export const SHOW_AFTER = 300;
/** How long a pending `g` waits for its second key. */
export const WAIT = 2000;

export type Pressed = {
  /** The key belongs to the sequence: the page does not hear it. */
  consumed: boolean;
  /** The keys of the binding the key completed, for the caller to run. */
  ran: string | null;
};

export function createLeader() {
  let step: Step | null = null;
  let showing: ReturnType<typeof setTimeout> | undefined;
  let ending: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };
  const disarm = () => {
    clearTimeout(showing);
    clearTimeout(ending);
  };
  /** Starts the delays of the step a key just left. */
  const arm = () => {
    disarm();
    if (step === null) {
      return;
    }
    if (!step.isShown) {
      showing = setTimeout(() => {
        if (step !== null) {
          step = { ...step, isShown: true };
          notify();
        }
      }, SHOW_AFTER);
    }
    if (step.path[0] !== LEADER) {
      ending = setTimeout(() => change(null), WAIT);
    }
  };
  const change = (to: Step | null) => {
    step = to;
    arm();
    notify();
  };

  return {
    dispose: disarm,
    /** Ends the sequence, if one is pending. */
    end() {
      if (step !== null) {
        change(null);
      }
    },
    get: () => step,
    /**
     * Feeds a key to the sequence. A step already pending, or begun by the chord, walks every
     * binding, the single-key ones too: only the chord can have begun it with the switch off.
     */
    press(token: string, event: KeyboardEvent, store: KeyStore): Pressed {
      const pending = step !== null;
      const bindings = (pending || token === CHORD ? store.all() : store.active()).filter(
        (binding) => binding.when?.(event.target) ?? true,
      );
      const result = next(bindings, step, token);
      if (event.repeat) {
        // A held key never starts a sequence, nor moves one on: Space held would run "Find anything".
        return { consumed: result.consumed, ran: null };
      }
      if (pending || result.step !== null) {
        change(result.step);
      }
      return { consumed: result.consumed, ran: result.ran };
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type Leader = ReturnType<typeof createLeader>;
