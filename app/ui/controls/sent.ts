// A value the human sets on a control and the server keeps: the control moves the moment it is
// touched, the changes go to the server one after another, in the order they were made, and a
// refusal puts the control back and says why under it. One home for what every form does:
//
//     const night = sent(() => settings().night, (on) => call("setNight", { on }));
//     <Switch label="Night" value={night.value()} onChange={night.set}
//       pending={night.pending()} refusal={night.refusal()} />
//
// `send` refuses by throwing, its error's message the words shown: they name the cause and the
// way out, "A time is from 00:00 to 23:59."
import { type Accessor, effect, signal, untracked } from "nsh";

export type Sent<T> = {
  /** What the control shows: the value set last while the server has not answered, else its own. */
  value: Accessor<T>;
  /** Whether a change is on its way. */
  pending: Accessor<boolean>;
  /** Why the server refused the last change, until the next one. */
  refusal: Accessor<string | null>;
  /** Shows `next` at once, and sends it after the changes before it. */
  set: (next: T) => void;
};

/** The words of a refusal: an error's message, or what was thrown. */
export function refusalOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function sent<T>(truth: Accessor<T>, send: (next: T) => Promise<unknown>): Sent<T> {
  // The value set last, kept until the server's own value is it, or changes after it landed: a
  // value the server normalised, "3:00" kept as "03:00".
  const shown = signal<{ landed: boolean; value: T } | null>(null);
  const waiting = signal(0);
  const refusal = signal<string | null>(null);
  let queue: Promise<unknown> = Promise.resolve();
  let made = 0;

  effect(() => {
    const now = truth();
    const set = untracked(shown);
    if (set !== null && untracked(waiting) === 0 && (set.landed || Object.is(now, set.value))) {
      shown.set(null);
    }
  });

  return {
    pending: () => waiting() > 0,
    refusal,
    set: (next: T) => {
      made += 1;
      const mine = made;
      shown.set({ landed: false, value: next });
      refusal.set(null);
      waiting.update((n) => n + 1);
      queue = queue.then(() =>
        send(next).then(
          () => {
            waiting.update((n) => n - 1);
            // Landed: the server's value follows, if it has not come already.
            if (mine === made) {
              shown.set(Object.is(untracked(truth), next) ? null : { landed: true, value: next });
            }
          },
          (error: unknown) => {
            waiting.update((n) => n - 1);
            refusal.set(refusalOf(error));
            // Put back, unless a later change stands over it.
            if (mine === made) {
              shown.set(null);
            }
          },
        ),
      );
    },
    value: () => {
      const set = shown();
      return set === null ? truth() : set.value;
    },
  };
}
