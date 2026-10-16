/** Where a dragged row of a list goes, as the core counts it. */

type Spot = { index: number; section: string };

/**
 * Where a line dropped above another goes, as the core counts it: among the lines once the
 * dragged one is taken out, so a line moved down its own section lands one place earlier.
 */
export function dropIndex(from: Spot, target: Spot) {
  return from.section === target.section && from.index < target.index
    ? target.index - 1
    : target.index;
}

/** The rows of each section, by key, in order: what a drag reorders. */
export type Order = Record<string, Array<string>>;

/** A line's spot in an order: its section and index, if it is there. */
export function spotOf(order: Order, key: string): Spot | undefined {
  for (const [section, keys] of Object.entries(order)) {
    const index = keys.indexOf(key);
    if (index >= 0) {
      return { index, section };
    }
  }
  return undefined;
}

/**
 * The move a drag asks for, as the core counts it, from the order before the drag and the order
 * it left: `undefined` when the line is back where it started. The line it was dropped above, in
 * the order before the drag, gives `dropIndex` its target; dropped last, it ends its section.
 */
export function dropMove(before: Order, after: Order, key: string) {
  const from = spotOf(before, key);
  const to = spotOf(after, key);
  if (!from || !to || (from.section === to.section && from.index === to.index)) {
    return undefined;
  }
  const next = after[to.section][to.index + 1];
  const above = next === undefined ? undefined : spotOf(before, next);
  return {
    index: above ? dropIndex(from, above) : Number.MAX_SAFE_INTEGER,
    section: to.section,
  };
}
