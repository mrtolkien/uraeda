import { useCallback, useEffect, useRef, useState } from "react";

/** What a save did: the text now in the file, or the core's refusal. */
type SaveResult = { ok: true; saved: string } | { message: string; ok: false };

export type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

/**
 * Saves a value after `delay` without changes, or at once, one save after the other: each save
 * carries the text the last one wrote as `previous`, so quick edits are never taken for changes
 * made elsewhere.
 */
export function useSave<T>(
  run: (value: T, previous: string) => Promise<SaveResult>,
  initial: string,
  delay = 400,
) {
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const previous = useRef(initial);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const saved = useRef(true);
  // Saves sent and not returned yet, during which the file's text is not taken as the last one.
  const running = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef<T | undefined>(undefined);
  const runRef = useRef(run);
  // oxlint-disable-next-line react/refs -- before the code quality decision: the latest save function, kept for its timer to call
  runRef.current = run;

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

  /** Saves what waits at once; resolves with whether the value shown is saved. */
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    const value = latest.current;
    latest.current = undefined;
    if (value !== undefined) {
      enqueue((previous) => runRef.current(value, previous));
    }
    return queue.current.then(() => saved.current);
  }, [enqueue]);

  /**
   * Writes the file another way than saving the value, such as setting one field, in the same
   * queue: after what waits is saved, and before any save or flush that comes later. Resolves with
   * whether it wrote.
   */
  const write = useCallback(
    (change: (previous: string) => Promise<SaveResult>) => {
      void flush();
      enqueue(change);
      return queue.current.then(() => saved.current);
    },
    [enqueue, flush],
  );

  const schedule = useCallback(
    (value: T, immediately = false) => {
      latest.current = value;
      clearTimeout(timer.current);
      if (immediately) {
        void flush();
      } else {
        timer.current = setTimeout(() => void flush(), delay);
      }
    },
    [delay, flush],
  );

  useEffect(() => () => void flush(), [flush]);

  /** Whether nothing waits to be saved, or is being saved. */
  const idle = useCallback(
    () => latest.current === undefined && timer.current === undefined && running.current === 0,
    [],
  );

  /**
   * Takes the file's text as the last one written, when nothing waits to be saved: the caller
   * shows the file's text then, which is saved, even after a save that failed.
   */
  const settle = useCallback((text: string) => {
    if (latest.current === undefined && timer.current === undefined) {
      previous.current = text;
      if (running.current === 0) {
        saved.current = true;
      }
    }
  }, []);

  /**
   * Takes a file read again as the one shown, as after a conflict: nothing waits to be saved, and
   * its text is the last one written.
   */
  const load = useCallback((text: string) => {
    clearTimeout(timer.current);
    timer.current = undefined;
    latest.current = undefined;
    previous.current = text;
    saved.current = true;
    setState({ kind: "idle" });
  }, []);

  return { flush, idle, load, schedule, settle, state, write };
}
