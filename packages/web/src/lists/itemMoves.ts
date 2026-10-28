// Where the keys that move the selected item send it, as the drop of a drag would: `K` and `J` one
// place up or down, past a section's edge to the end of the section before it or the start of the
// one after it; `H` and `L` to the end of the previous or next section that takes drops; a pick of
// a section, `to:<id>`, to its end. The result is what `onMove` is called with (see `useDragOrder`).
import { runEnd } from "./nesting.ts";
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
 * the first row of the first section up, the last row of the last down, no section further left or
 * right, the section it is in picked, or a row that stays put.
 */
export function itemTarget(sections: ReadonlyArray<Placed>, key: string, move: ItemMove) {
  const from = sections.findIndex((section) => linesOf(section).some((row) => row.key === key));
  const section = sections[from];
  if (section === undefined || section.isFixed) {
    return undefined;
  }
  if (move.startsWith("to:")) {
    const target = sections.find((other) => other.id === move.slice(3) && !other.isFixed);
    return target === undefined || target === section
      ? undefined
      : { index: linesOf(target).length, section: target.id };
  }
  const lines = linesOf(section);
  const index = lines.findIndex((row) => row.key === key);
  const isUp = move === "up" || move === "left";
  const others = isUp ? sections.slice(0, from).reverse() : sections.slice(from + 1);
  const target = others.find((other) => !other.isFixed);
  if (move === "up" || move === "down") {
    const to = index + (isUp ? -1 : 1);
    if (to >= 0 && to < lines.length) {
      return { index: to, section: section.id };
    }
    // Past the section's edge: into the next one, at its end going up, at its start going down.
    return target === undefined
      ? undefined
      : { index: isUp ? linesOf(target).length : 0, section: target.id };
  }
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
    // The line with its nested rows, which name it their line.
    const end = runEnd(from, at, (one) => rowOf(one).parent === key);
    const moved = from.splice(at, end - at);
    // Before the line now at its place, or at the section's end.
    const before = into.filter((one) => rowOf(one).parent === undefined)[target.index];
    into.splice(before === undefined ? into.length : into.indexOf(before), 0, ...moved);
  }
  return now;
}
