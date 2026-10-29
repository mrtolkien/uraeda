// Where a dragged row lands sideways, in a list that nests: the depth the pointer asks for, one tab
// a level, the depth its neighbours allow, and its frame drawn tabbed to it under the pointer.
import type { DragDropManager, DragMoveEvent } from "@dnd-kit/react";
import { type Order, spotOf } from "../drop.ts";
import { depthByKey } from "./nesting.ts";

/** A row as its landing sees it: its depth, and whether nothing nests under it. */
type Landed = { depth?: number; isFixed?: boolean; staysLine?: boolean };

/** How far a depth is tabbed in: a nested row's padding (see `Card`), in rem. */
const INDENT_REM = 1.5;

/** How far a depth is tabbed in, in pixels, at the page's font size. */
const tabOf = () =>
  Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * INDENT_REM;

/** The row of a dragged element, the frame it draws in: what is tabbed to the depth it would land at. */
export const frameOf = (element: Element | undefined) =>
  element?.querySelector<HTMLElement>(":scope > [data-row-frame]") ?? undefined;

/**
 * The depth `key` lands at in `now` when dragged to `depth`: at most one deeper than the row above
 * it, never under a row that stays as it is, and at least as deep as the row below it. Where the
 * list does not nest, `canNest`, or the row is in no section, it keeps the depth its drag started
 * at, `from`.
 */
export function landingOf(
  {
    canNest,
    from,
    rows,
  }: { canNest: boolean; from: number | undefined; rows: ReadonlyMap<string, Landed> },
  now: Order,
  key: string,
  depth: number,
) {
  const spot = spotOf(now, key);
  if (!spot || !canNest) {
    return from ?? 0;
  }
  const depthOf = depthByKey(rows);
  const keys = now[spot.section];
  const above = keys[spot.index - 1];
  const below = keys[spot.index + 1];
  // A line that stays one, as a proposal with a file, lands as a line wherever it goes.
  if (rows.get(key)?.staysLine) {
    return 0;
  }
  const deepest = above === undefined ? 0 : depthOf(above) + (rows.get(above)?.isFixed ? 0 : 1);
  const least = below === undefined ? 0 : Math.min(depthOf(below), deepest);
  return Math.max(least, Math.min(deepest, depth));
}

/**
 * Draws the dragged row tabbed to where it lands, `depth`, under the pointer `by` sideways from
 * where its frame's left was as the drag started, `from`. Only where the list nests, `canNest`.
 */
export function snapTo(
  element: Element | undefined,
  depth: number,
  by: number,
  from: number | undefined,
  canNest: boolean,
) {
  const frame = frameOf(element);
  const list = document.querySelector("[data-dnd-placeholder]")?.closest("ul");
  if (!frame || !list || !canNest) {
    return;
  }
  const left = list.getBoundingClientRect().left;
  const at = (from ?? left) + by;
  // Written on the element, not a StyleX style: it follows the pointer frame by frame, outside the
  // drag's renders.
  frame.style.translate = `${left + depth * tabOf() - at}px 0`;
}

/**
 * How far sideways the pointer went, which the operation has not taken in yet, and the depth it
 * asks for: where the row is, where it started, `from`, as far sideways as the pointer goes, one
 * tab a level against its `list`.
 */
export function sidewaysOf(
  event: DragMoveEvent,
  manager: DragDropManager,
  list: Element,
  from: number | undefined,
) {
  const { position } = manager.dragOperation;
  const sideways = (event.to?.x ?? position.current.x) - position.initial.x;
  const left = list.getBoundingClientRect().left;
  const at = (from ?? left) + sideways;
  return { sideways, wanted: Math.round((at - left) / tabOf()) };
}
