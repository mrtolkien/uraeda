import { useCallback, useEffect, useRef, useState } from "react";

/** What a save did: the text now in the file, or the core's refusal. */
export type SaveResult = { ok: true; saved: string } | { ok: false; message: string };

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
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef<T | undefined>(undefined);
  const runRef = useRef(run);
  runRef.current = run;

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    if (latest.current === undefined) {
      return queue.current;
    }
    const value = latest.current;
    latest.current = undefined;
    queue.current = queue.current.then(async () => {
      setState({ kind: "saving" });
      const result = await runRef.current(value, previous.current);
      if (result.ok) {
        previous.current = result.saved;
        setState({ kind: "saved" });
      } else {
        setState({ kind: "error", message: result.message });
      }
    });
    return queue.current;
  }, []);

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

  /** Takes the file's text as the last one written, when nothing waits to be saved. */
  const settle = useCallback((text: string) => {
    if (latest.current === undefined && timer.current === undefined) {
      previous.current = text;
    }
  }, []);

  return { state, schedule, flush, settle };
}
