// Where the keys that move the selected item send it, as the drop of a drag would: `K` and `J` one
// place up or down inside the section, `H` and `L` to the end of the previous or next section that
// takes drops. The result is what `onMove` is called with (see `useDragOrder`).
import type { ItemMove } from "./useListKeys.ts";

/** A section as the keys see it: its rows as they show, and whether nothing is dropped in it. */
export type Placed = {
  id: string;
  isFixed?: boolean;
  rows: ReadonlyArray<{ key: string }>;
};

/**
 * The move of the row `key` among `sections`, in the order they show: its section and its index
 * among that section's rows once the row is taken out, or `undefined` where there is nowhere to go:
 * the first row up, the last row down, no section further left or right, or a row that stays put.
 */
export function itemTarget(sections: ReadonlyArray<Placed>, key: string, move: ItemMove) {
  const from = sections.findIndex((section) => section.rows.some((row) => row.key === key));
  const section = sections[from];
  if (section === undefined || section.isFixed) {
    return undefined;
  }
  const index = section.rows.findIndex((row) => row.key === key);
  if (move === "up" || move === "down") {
    const to = index + (move === "up" ? -1 : 1);
    return to < 0 || to >= section.rows.length ? undefined : { index: to, section: section.id };
  }
  const others = move === "left" ? sections.slice(0, from).reverse() : sections.slice(from + 1);
  const target = others.find((other) => !other.isFixed);
  return target === undefined ? undefined : { index: target.rows.length, section: target.id };
}
