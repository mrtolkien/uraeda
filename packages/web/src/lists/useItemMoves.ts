// What the keys that move an item do in a list of cards (R30): the move a drop would ask for, one
// at a time.
import { useEffect, useLayoutEffect, useRef } from "react";
import { itemTarget, type Placed } from "./itemMoves.ts";
import type { ItemMove } from "./useListKeys.ts";
import type { OnMove } from "./useDragOrder.ts";

/** How long a move waits for the list to show it before the next key's move goes on (R30). */
const SETTLE_MS = 2000;

/** Ends every wait for the list. */
const settle = (waiters: Set<() => void>) => {
  const all = [...waiters];
  waiters.clear();
  all.forEach((resolve) => resolve());
};

/** The order the rows show in, as text: what a written move changes. */
export const orderOfSections = (sections: ReadonlyArray<Placed>) =>
  JSON.stringify(sections.map((section) => [section.id, section.rows.map((row) => row.key)]));

/**
 * Waits for the list to show a move: `waiters` are the resolvers a reorder calls, and the wait
 * ends on its own after `ms`. The timer ends the wait and takes its resolver out of `waiters`.
 */
export function waitForList(
  waiters: Set<() => void>,
  timers: Set<ReturnType<typeof setTimeout>>,
  ms: number,
): Promise<void> {
  return new Promise<void>((resolve) => {
    waiters.add(resolve);
    const timer = setTimeout(() => {
      timers.delete(timer);
      waiters.delete(resolve);
      resolve();
    }, ms);
    timers.add(timer);
  });
}

/**
 * A move made by a key whose write has not shown yet: the list shows it ahead of its write. Once
 * written, `base` is the file's order it was written over: a list in another order shows it.
 */
export type Ahead = { base?: string; id: number; key: string; move: ItemMove };

/**
 * The moves still ahead of the file in `live`'s order: not one whose write the file already
 * shows, in the very render it does, for no move to be made twice on screen.
 */
export const stillAhead = (ahead: ReadonlyArray<Ahead>, live: ReadonlyArray<Placed>) => {
  const order = orderOfSections(live);
  return ahead.filter((one) => one.base === undefined || one.base === order);
};

/**
 * What the keys that move an item do: the move a drop would ask `onMove` for. With `setAhead`, the
 * list shows each move at once, and its writes follow in the background, one at a time: a write
 * waits for the one before it, and for the list to show it, and its target is read from the list as
 * that move left it; a move the list never shows (a no-op) holds the writes after it for `SETTLE_MS`
 * at most. A refused write drops the moves after it, which were made from it, and the list goes
 * back to the file's order. `sections` are those on screen, in order, the moves ahead made, and the
 * moved row is selected; `live` are the same as the file has them, `sections` by default. Absent
 * where the list has no `onMove`: its items cannot move.
 */
export function useItemMoves(
  onMove: OnMove | undefined,
  sections: ReadonlyArray<Placed>,
  select: (key: string) => void,
  {
    live = sections,
    setAhead,
  }: {
    live?: ReadonlyArray<Placed>;
    setAhead?: (change: (ahead: ReadonlyArray<Ahead>) => ReadonlyArray<Ahead>) => void;
  } = {},
) {
  const latest = useRef({ onMove, order: orderOfSections(live), sections: live });
  const shown = useRef(new Set<() => void>());
  const made = useRef(0);
  useLayoutEffect(() => {
    const order = orderOfSections(live);
    const isChanged = order !== latest.current.order;
    latest.current = { onMove, order, sections: live };
    if (isChanged) {
      settle(shown.current);
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
      settle(settled);
    };
  }, []);
  if (onMove === undefined) {
    return undefined;
  }
  const drop = (id: number) => setAhead?.((ahead) => ahead.filter((one) => one.id !== id));
  const run = async ({ id, key, move }: Ahead) => {
    const { onMove: write, order, sections: now } = latest.current;
    const target = itemTarget(now, key, move);
    if (target === undefined) {
      drop(id);
      return;
    }
    if (setAhead === undefined) {
      select(key);
    }
    setAhead?.((ahead) => ahead.map((one) => (one.id === id ? { ...one, base: order } : one)));
    try {
      const isWritten = await write?.(key, target.section, target.index);
      if (isWritten === false) {
        // Refused: the moves made after it were made from it.
        waiting.current.splice(0);
        setAhead?.(() => []);
        return;
      }
      if (latest.current.order !== order || !isMounted.current) {
        return;
      }
      await waitForList(shown.current, timers.current, SETTLE_MS);
    } finally {
      drop(id);
    }
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
    if (key === undefined || (setAhead && itemTarget(sections, key, move) === undefined)) {
      return;
    }
    made.current += 1;
    const ahead = { id: made.current, key, move };
    if (setAhead) {
      setAhead((before) => [...before, ahead]);
      select(key);
    }
    waiting.current.push(() => run(ahead));
    void drain();
  };
}
