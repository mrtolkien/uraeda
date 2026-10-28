// Where the keys that move the selected item send it, as the drop of a drag would: `K` and `J` one
// place up or down inside the section, `H` and `L` to the end of the previous or next section that
// takes drops. The result is what `onMove` is called with (see `useDragOrder`).
import type { ItemMove } from "./useListKeys.ts";

/**
 * A section as the keys see it: its rows as they show, and whether nothing is dropped in it. A row
 * that adds is no line: it never moves, and no line moves past it; nor is a row nested under a
 * line, which moves with it.
 */
export type Placed = {
  id: string;
  isFixed?: boolean;
  rows: ReadonlyArray<{ isAdd?: boolean; key: string; parent?: string }>;
};

/** A section's lines, without its rows that add and its nested rows. */
const linesOf = (section: Placed) =>
  section.rows.filter((row) => !row.isAdd && row.parent === undefined);

/**
 * The move of the row `key` among `sections`, in the order they show: its section and its index
 * among that section's rows once the row is taken out, or `undefined` where there is nowhere to go:
 * the first row up, the last row down, no section further left or right, or a row that stays put.
 */
export function itemTarget(sections: ReadonlyArray<Placed>, key: string, move: ItemMove) {
  const from = sections.findIndex((section) => linesOf(section).some((row) => row.key === key));
  const section = sections[from];
  if (section === undefined || section.isFixed) {
    return undefined;
  }
  const lines = linesOf(section);
  const index = lines.findIndex((row) => row.key === key);
  if (move === "up" || move === "down") {
    const to = index + (move === "up" ? -1 : 1);
    return to < 0 || to >= lines.length ? undefined : { index: to, section: section.id };
  }
  const others = move === "left" ? sections.slice(0, from).reverse() : sections.slice(from + 1);
  const target = others.find((other) => !other.isFixed);
  return target === undefined ? undefined : { index: linesOf(target).length, section: target.id };
}

/**
 * Each section's keys, in `order`, once `moves` are made one after another, as the keys made them
 * before their writes show: a move with nowhere to go is left out. A line moves with its nested
 * rows, which follow it in `order`. The sections of `sections` that stay put keep their rows.
 */
export function withMoves(
  order: Readonly<Record<string, ReadonlyArray<string>>>,
  sections: ReadonlyArray<Placed>,
  moves: ReadonlyArray<{ key: string; move: ItemMove }>,
) {
  const now = Object.fromEntries(Object.entries(order).map(([id, keys]) => [id, [...keys]]));
  const rows = new Map(sections.flatMap((section) => section.rows.map((row) => [row.key, row])));
  const rowOf = (key: string) => rows.get(key) ?? { key };
  for (const { key, move } of moves) {
    const placed = sections.map((section) => ({
      ...section,
      rows: section.isFixed ? section.rows : (now[section.id] ?? []).map(rowOf),
    }));
    const target = itemTarget(placed, key, move);
    const from = Object.values(now).find((keys) => keys.includes(key));
    const into = target === undefined ? undefined : now[target.section];
    if (target === undefined || from === undefined || into === undefined) {
      continue;
    }
    const at = from.indexOf(key);
    const end = from.findIndex((one, index) => index > at && rowOf(one).parent !== key);
    const moved = from.splice(at, (end === -1 ? from.length : end) - at);
    // Before the line now at its place, or at the section's end.
    const before = into.filter((one) => rowOf(one).parent === undefined)[target.index];
    into.splice(before === undefined ? into.length : into.indexOf(before), 0, ...moved);
  }
  return now;
}
