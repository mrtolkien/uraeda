// A thing of several fields that the server keeps whole, as a job's form saves its job: each
// field's control moves the moment it is touched, its change is a patch queued behind the ones
// before it, and each patch applies on what the one before wrote, not on what the record said
// when it was made. A refusal puts that field back, unless a later change stands over it, and
// says why under that field alone. `sent` is the same for one value; this is it for a whole.
//
//     const job = patched(() => valuesOf(record()), (next, before) => save(before.name, next));
//     const on = job.field("reportOnly", (all) => all.reportOnly, (all, value) => ({ ...all, reportOnly: value }));
//     <Switch value={on.value()} onChange={on.set} pending={on.pending()} refusal={on.refusal()} />
//
// `send` refuses by throwing, its error's message the words shown.
import { type Accessor, batch, effect, signal, untracked } from "nsh";
import { refusalOf, type Sent } from "./sent";

export type Patched<T> = {
  /** What the controls show: the server's value with every change not answered yet on it. */
  value: Accessor<T | undefined>;
  /**
   * Queues `patch` for the field `at`: shown at once, sent once the changes before it are
   * answered, on what they wrote. Gives the refusal's words, or `null` once it is kept.
   */
  change: (at: string, patch: (all: T) => T) => Promise<string | null>;
  /** Whether a change of the field `at` is on its way. */
  pending: (at: string) => boolean;
  /** Why the server refused the field's last change, until its next one. */
  refusal: (at: string) => string | null;
  /** Sets or clears a field's refusal: a whole that is refused before it is sent, as a new job's. */
  refuse: (at: string, words: string | null) => void;
  /** One field as a `Sent`, for a control that takes one. */
  field: <V>(at: string, get: (all: T) => V, set: (all: T, value: V) => T) => Sent<V>;
};

type Queued<T> = { at: string; id: number; patch: (all: T) => T };

/**
 * `truth` is the server's value, `undefined` while it is not there; `send` writes `next`, made
 * from `before`, the value the server held as far as the queue knows. `key` tells two values
 * apart, as JSON unless given.
 */
export function patched<T>(
  truth: Accessor<T | undefined>,
  send: (next: T, before: T) => Promise<unknown>,
  key: (value: T) => string = (value) => JSON.stringify(value),
): Patched<T> {
  const queue = signal<ReadonlyArray<Queued<T>>>([]);
  // What the last kept change wrote, until the server's value shows it: `seen` is the server's
  // value as it was when the change was kept, which a change of the server's ends.
  const kept = signal<{ seen: string | null; value: T } | null>(null);
  const refusals = signal<Readonly<Record<string, string | null>>>({});
  let chain: Promise<unknown> = Promise.resolve();
  let made = 0;

  const keyOf = (value: T | undefined) => (value === undefined ? null : key(value));
  const refuse = (at: string, words: string | null) =>
    refusals.update((all) => ({ ...all, [at]: words }));

  // Idle, the server's own value takes over once it changed since the last change was kept.
  effect(() => {
    const now = keyOf(truth());
    const held = untracked(kept);
    if (held !== null && untracked(queue).length === 0 && now !== held.seen) kept.set(null);
  });

  const base = () => untracked(kept)?.value ?? untracked(truth);

  const save = async (queued: Queued<T>): Promise<string | null> => {
    const before = base();
    if (before === undefined) {
      queue.update((all) => all.filter((one) => one.id !== queued.id));
      return null;
    }
    const next = queued.patch(before);
    const sentOver = keyOf(untracked(truth));
    try {
      await send(next, before);
      batch(() => {
        const now = keyOf(untracked(truth));
        // The server's value already moved, to this change or past it: it is the truth again.
        const shows = now === key(next) || now !== sentOver;
        kept.set(shows ? null : { seen: now, value: next });
        queue.update((all) => all.filter((one) => one.id !== queued.id));
      });
      return null;
    } catch (error) {
      const words = refusalOf(error);
      batch(() => {
        refuse(queued.at, words);
        queue.update((all) => all.filter((one) => one.id !== queued.id));
      });
      return words;
    }
  };

  const change = (at: string, patch: (all: T) => T) => {
    made += 1;
    const queued = { at, id: made, patch };
    batch(() => {
      refuse(at, null);
      queue.update((all) => [...all, queued]);
    });
    const done = chain.then(() => save(queued));
    chain = done.catch(() => undefined);
    return done;
  };

  const value = () => {
    const start = kept()?.value ?? truth();
    return start === undefined ? undefined : queue().reduce<T>((all, one) => one.patch(all), start);
  };
  const pending = (at: string) => queue().some((one) => one.at === at);
  const refusal = (at: string) => refusals()[at] ?? null;

  return {
    change,
    field: (at, get, set) => ({
      pending: () => pending(at),
      refusal: () => refusal(at),
      set: (next) => void change(at, (all) => set(all, next)),
      value: () => {
        const all = value();
        return all === undefined ? (undefined as never) : get(all);
      },
    }),
    pending,
    refusal,
    refuse,
    value,
  };
}
