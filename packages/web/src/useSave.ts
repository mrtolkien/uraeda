import { useCallback, useRef, useState } from "react";

/** What a save did: the text now in the file, or the core's refusal. */
type SaveResult = { ok: true; saved: string } | { message: string; ok: false };

export type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

/**
 * Saves a value at once, one save after the other: each save carries the text the last one wrote
 * as `previous`, so quick saves, like a Save and an image's, are never taken for changes made
 * elsewhere.
 */
export function useSave<T>(
  run: (value: T, previous: string) => Promise<SaveResult>,
  initial: string,
) {
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const previous = useRef(initial);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const saved = useRef(true);
  // Saves sent and not returned yet, during which the file's text is not taken as the last one.
  const running = useRef(0);

  /** Queues a write after the saves before it, over the text the last one wrote. */
  const enqueue = useCallback((write: (previous: string) => Promise<SaveResult>) => {
    running.current += 1;
    queue.current = queue.current.then(async () => {
      setState({ kind: "saving" });
      const result = await write(previous.current).finally(() => {
        running.current -= 1;
      });
      saved.current = result.ok;
      if (result.ok) {
        previous.current = result.saved;
        setState({ kind: "saved" });
      } else {
        setState({ kind: "error", message: result.message });
      }
    });
  }, []);

  /** Resolves once the saves queued are done, with whether the last one wrote. */
  const flush = useCallback(() => queue.current.then(() => saved.current), []);

  /**
   * Writes the file another way than saving a value, such as setting one field, in the same queue:
   * after the saves before it, and before any that comes later. Resolves with whether it wrote.
   */
  const write = useCallback(
    (change: (previous: string) => Promise<SaveResult>) => {
      enqueue(change);
      return flush();
    },
    [enqueue, flush],
  );

  // The value of the last save queued, until it is written or refused.
  const queued = useRef<{ value: T } | undefined>(undefined);
  /**
   * Saves `value` at once, after the saves before it; resolves with whether it did. A value queued
   * and not written yet is not queued again, which would write it over the writes queued since:
   * it resolves once the queue is done.
   */
  const save = (value: T) => {
    if (queued.current && Object.is(queued.current.value, value)) {
      return flush();
    }
    const entry = { value };
    queued.current = entry;
    return write((previous) =>
      run(value, previous).finally(() => {
        if (queued.current === entry) {
          queued.current = undefined;
        }
      }),
    );
  };

  /** Whether no save is under way. */
  const idle = useCallback(() => running.current === 0, []);

  /**
   * Takes the file's text as the last one written, even after a failed save; `reloaded`, as after
   * a conflict, clears the failure.
   */
  const settle = useCallback((text: string, reloaded = false) => {
    if (reloaded) {
      setState({ kind: "idle" });
    }
    previous.current = text;
    saved.current ||= reloaded || running.current === 0;
  }, []);

  return { flush, idle, save, settle, state, write };
}
