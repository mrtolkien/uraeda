// The list's writes, one after another, each over the version the one before it left (see
// `useOutline`).
import { useEffect, useLayoutEffect, useRef } from "react";

/** The refusal of a write dropped after an earlier one was refused: the earlier one says why. */
export const DROPPED = "";

/**
 * The list's writes, one after another, as the keys made them ahead of the file: each reads the
 * list as the write before it left it, once drawn, for its version and its rows' places, so that a
 * second delete is not refused for the first. `write` resolves with its refusal, if any; `latest`
 * is the list as last drawn. `held` is the list's version as the browser holds it, the last write's
 * answer in it, drawn or not.
 */
export function useWritesInTurn<Data extends { hash: string }>(
  data: Data,
  held: () => Promise<string>,
) {
  const latest = useRef(data);
  const waiting = useRef(new Set<{ hash: string; resolve: () => void }>());
  useLayoutEffect(() => {
    latest.current = data;
    for (const waiter of waiting.current) {
      if (waiter.hash !== data.hash) {
        waiting.current.delete(waiter);
        waiter.resolve();
      }
    }
  }, [data]);
  // A list no longer drawn draws no other version: its writes go on, over the last one drawn.
  useEffect(() => {
    const all = waiting.current;
    return () => {
      for (const waiter of all) {
        waiter.resolve();
      }
      all.clear();
    };
  }, []);
  /**
   * Once the list shows another version than `hash`: the write's answer, which fate holds as it
   * resolves, drawn. At once when the browser holds no other version, as after a write that left the
   * file as it was.
   */
  const drawnAfter = async (hash: string) => {
    if (latest.current.hash !== hash) {
      return;
    }
    const now = await held().catch(() => hash);
    if (now === hash || latest.current.hash !== hash) {
      return;
    }
    await new Promise<void>((resolve) => waiting.current.add({ hash, resolve }));
  };
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // Counts the refusals: a write asked before one is dropped, as it was placed after what was refused.
  const refusals = useRef(0);
  const inTurn = (write: (now: Data) => Promise<string | undefined>) => {
    const asked = refusals.current;
    const turn = queue.current.then(async () => {
      if (refusals.current !== asked) {
        return DROPPED;
      }
      const now = latest.current;
      // A write that throws is refused too: what it showed ahead of the file goes.
      const failed = await write(now).catch(String);
      if (failed === undefined) {
        await drawnAfter(now.hash);
      } else {
        refusals.current += 1;
      }
      return failed;
    });
    queue.current = turn.catch(() => undefined);
    return turn;
  };
  /** `then` with the list as the writes asked so far left it, drawn. */
  const afterWrites = (then: (now: Data) => void) => {
    void queue.current.then(() => then(latest.current));
  };
  return { afterWrites, inTurn, latest };
}
