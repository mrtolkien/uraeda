// Where the keys that move the selected item send it, as the drop of a drag would: `K` and `J` one
// place up or down inside the section, `H` and `L` to the end of the previous or next section that
// takes drops. The result is what `onMove` is called with (see `useDragOrder`).
import type { ItemMove } from "./useListKeys.ts";

/**
 * A section as the keys see it: its rows as they show, and whether nothing is dropped in it. A row
 * that adds is no line: it never moves, and no line moves past it.
 */
export type Placed = {
  id: string;
  isFixed?: boolean;
  rows: ReadonlyArray<{ isAdd?: boolean; key: string }>;
};

/** A section's lines, without its rows that add. */
const linesOf = (section: Placed) => section.rows.filter((row) => !row.isAdd);

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
 * before their writes show: a move with nowhere to go is left out. The sections of `sections` that
 * stay put keep their rows.
 */
export function withMoves(
  order: Readonly<Record<string, ReadonlyArray<string>>>,
  sections: ReadonlyArray<Placed>,
  moves: ReadonlyArray<{ key: string; move: ItemMove }>,
) {
  const now = Object.fromEntries(Object.entries(order).map(([id, keys]) => [id, [...keys]]));
  for (const { key, move } of moves) {
    const placed = sections.map((section) => ({
      ...section,
      rows: section.isFixed ? section.rows : (now[section.id] ?? []).map((one) => ({ key: one })),
    }));
    const target = itemTarget(placed, key, move);
    const from = Object.values(now).find((keys) => keys.includes(key));
    if (target === undefined || from === undefined || now[target.section] === undefined) {
      continue;
    }
    from.splice(from.indexOf(key), 1);
    now[target.section].splice(target.index, 0, key);
  }
  return now;
}
