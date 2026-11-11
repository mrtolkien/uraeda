// The order of a list being moved: plain functions over ids, so the keys, a drag, and the words
// that say where a row went agree on one count.

/** `ids` with `id` taken out and put at `to`, its place in the new order. */
export function moved(ids: ReadonlyArray<string>, id: string, to: number): Array<string> {
  const rest = ids.filter((other) => other !== id);
  const at = Math.max(0, Math.min(rest.length, to));
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

/** Where a row went, in words a person reads once: "Inbox moved to 3 of 8." */
export function wentWords(label: string, to: number, count: number): string {
  return `${label} moved to ${to + 1} of ${count}.`;
}

/** Where a row dragged by `by` points lands, from `from`, over rows of these heights. */
export function landing(heights: ReadonlyArray<number>, from: number, by: number): number {
  let at = from;
  let left = by;
  // A row is passed once the drag reaches past its middle.
  while (left > 0 && at + 1 < heights.length && left > (heights[at + 1] ?? 0) / 2) {
    left -= heights[at + 1] ?? 0;
    at += 1;
  }
  while (left < 0 && at > 0 && -left > (heights[at - 1] ?? 0) / 2) {
    left += heights[at - 1] ?? 0;
    at -= 1;
  }
  return at;
}
