// What the keys that move an item do in a list of cards (R30): the move a drop would ask for, one
// at a time.
import { useEffect, useLayoutEffect, useRef } from "react";
import { itemTarget, type Placed } from "./itemMoves.ts";
import type { ItemMove } from "./useListKeys.ts";
import type { OnMove } from "./useDragOrder.ts";

/** How long a move waits for the list to show it before the next key's move goes on (R30). */
const SETTLE_MS = 2000;

/** The order the rows show in, as text: what a written move changes. */
const orderOfSections = (sections: ReadonlyArray<Placed>) =>
  JSON.stringify(sections.map((section) => [section.id, section.rows.map((row) => row.key)]));

/**
 * What the keys that move an item do: the move a drop would ask `onMove` for, one at a time. A key
 * pressed while an earlier move is being written waits for it, and for the list to show it, and
 * its target is read from the list as that move left it, so a held `J` goes down one place at a
 * time; a move the list never shows (refused, or a no-op) holds the keys after it for `SETTLE_MS`
 * at most. A move whose write fails is dropped, and the ones after it still run. `sections` are
 * those on screen, in order, and the moved row is selected. Absent where the list has no
 * `onMove`: its items cannot move.
 */
export function useItemMoves(
  onMove: OnMove | undefined,
  sections: ReadonlyArray<Placed>,
  select: (key: string) => void,
) {
  const latest = useRef({ onMove, order: orderOfSections(sections), sections });
  const shown = useRef<Array<() => void>>([]);
  useLayoutEffect(() => {
    const order = orderOfSections(sections);
    const isChanged = order !== latest.current.order;
    latest.current = { onMove, order, sections };
    if (isChanged) {
      shown.current.splice(0).forEach((resolve) => resolve());
    }
  });
  const waiting = useRef<Array<() => Promise<void>>>([]);
  const isWriting = useRef(false);
  // The list going takes its queue and its waits with it: no move is written for a list nobody
  // sees, and no settle timer outlives it.
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const isMounted = useRef(false);
  useEffect(() => {
    const pending = timers.current;
    const queue = waiting.current;
    const settled = shown.current;
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      queue.splice(0);
      pending.forEach(clearTimeout);
      pending.clear();
      settled.splice(0).forEach((resolve) => resolve());
    };
  }, []);
  if (onMove === undefined) {
    return undefined;
  }
  const run = async (key: string, move: ItemMove) => {
    const { onMove: write, order, sections: now } = latest.current;
    const target = itemTarget(now, key, move);
    if (target === undefined) {
      return;
    }
    select(key);
    await write?.(key, target.section, target.index);
    await new Promise<void>((resolve) => {
      if (latest.current.order !== order || !isMounted.current) {
        resolve();
        return;
      }
      shown.current.push(resolve);
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        resolve();
      }, SETTLE_MS);
      timers.current.add(timer);
    });
  };
  const drain = async () => {
    if (isWriting.current) {
      return;
    }
    isWriting.current = true;
    try {
      for (let next = waiting.current.shift(); next; next = waiting.current.shift()) {
        // A refused write is the caller's to show (see `onMoveRefused`): here it only ends the move.
        await next().catch(() => undefined);
      }
    } finally {
      isWriting.current = false;
    }
  };
  return (move: ItemMove, row: number) => {
    const key = sections.flatMap((section) => section.rows)[row]?.key;
    if (key !== undefined) {
      waiting.current.push(() => run(key, move));
      void drain();
    }
  };
}
