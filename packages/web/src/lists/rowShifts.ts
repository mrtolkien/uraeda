// The rows of a list gliding to their new places, as a key moved one or a row before it went, the
// way a drag glides them (see `WorkList`). Where each row is is read only as something moved it:
// the rows' order changed, or a row, a column, or the list changed size.
import { type RefObject, useLayoutEffect, useRef } from "react";

/** The glide of a row that changed place: as a key moved it, or a row before it went. */
const SHIFT = { duration: 200, easing: "cubic-bezier(0.25, 1, 0.5, 1)" };

/** Where each row of a list was, by key, in the list's own content, and the glides that run. */
type Shifts = {
  places: Map<string, { x: number; y: number }>;
  running: WeakMap<Element, Animation>;
  /** The list's width as its places were read: one that changed is no move. */
  width: number;
};

/**
 * Reads where each row of `root` is now, and with `isMoving`, glides each that changed place from
 * where it was. A row gliding starts again from where it shows; without `isMoving`, it glides on,
 * and its place is read where it lands.
 */
function shiftRows(root: HTMLElement, shifts: Shifts, isMoving: boolean) {
  const origin = root.getBoundingClientRect();
  const left = root.querySelector("[data-list-page]")?.scrollLeft ?? 0;
  const next = new Map<string, { x: number; y: number }>();
  for (const row of root.querySelectorAll<HTMLElement>("[data-row-key]")) {
    const key = row.dataset.rowKey ?? "";
    const placeOf = (box: DOMRect) => ({
      x: box.left - origin.left + left,
      y: box.top - origin.top,
    });
    const running = shifts.running.get(row);
    const isGliding = running?.playState === "running";
    if (!isMoving && isGliding) {
      next.set(key, shifts.places.get(key) ?? placeOf(row.getBoundingClientRect()));
      continue;
    }
    const seen = isGliding ? placeOf(row.getBoundingClientRect()) : undefined;
    // A glide toward the same place runs on: where the row lands is where it shows, its glide aside.
    if (seen) {
      const [x = 0, y = 0] = getComputedStyle(row).translate.split(" ").map(parseFloat);
      const lands = shifts.places.get(key);
      if (lands && Math.abs(seen.x - x - lands.x) < 1 && Math.abs(seen.y - y - lands.y) < 1) {
        next.set(key, lands);
        continue;
      }
    }
    running?.cancel();
    const at = placeOf(row.getBoundingClientRect());
    next.set(key, at);
    const before = seen ?? shifts.places.get(key);
    if (!isMoving || !before) {
      continue;
    }
    const dx = before.x - at.x;
    const dy = before.y - at.y;
    if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
      shifts.running.set(row, row.animate({ translate: [`${dx}px ${dy}px`, "0 0"] }, SHIFT));
    }
  }
  shifts.places = next;
  shifts.width = origin.width;
}

/** What changes a row's size, and so the places of the rows after it: the rows, and the columns. */
const SIZED = "[data-row-key], [data-column]";

/**
 * Has `observer` watch `root`, its rows, and its columns, and no longer the ones gone: `watched`
 * holds them. Watched anew, an element is reported once at once.
 */
function watch(root: HTMLElement, observer: ResizeObserver, watched: Set<Element>) {
  const now = new Set<Element>([root, ...root.querySelectorAll(SIZED)]);
  for (const element of watched) {
    if (!now.has(element)) {
      observer.unobserve(element);
      watched.delete(element);
    }
  }
  for (const element of now) {
    if (!watched.has(element)) {
      observer.observe(element);
      watched.add(element);
    }
  }
}

/** Whether rows that changed place glide: not while `isStill`, nor for less motion. */
const canGlide = (isStill: boolean) =>
  !isStill && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Glides each row of `list` that changed place from where it was, as a drag does: dnd-kit animates
 * only during one. Where it was is read in the list's own content, so the page's scroll and the
 * columns' are no move. Nothing glides while `isStill`, during a drag and as it ends, nor as
 * `layout` changes or the list resizes, nor for a human who asked for less motion.
 *
 * The places are read as `order`, each section's rows in order with their depths, or `isStill` or
 * `layout`, changes, and as the list, a row, or a column changes size, which moves the rows after
 * it: a row's bar or its text, a column's title. Nothing else moves a row, so the places read last
 * are where the rows still are, and the next move glides each from there.
 */
export function useRowShifts(
  list: RefObject<HTMLElement | null>,
  isStill: boolean,
  layout: string,
  order: string,
) {
  const shifts = useRef<Shifts>({ places: new Map(), running: new WeakMap(), width: 0 });
  const last = useRef({ isStill, layout });
  // The elements watched for a change of size, and what watches them, once the list is drawn.
  const watched = useRef(new Set<Element>());
  const observer = useRef<ResizeObserver>(undefined);
  useLayoutEffect(() => {
    const isMoving = canGlide(isStill) && !last.current.isStill && last.current.layout === layout;
    last.current = { isStill, layout };
    if (list.current) {
      shiftRows(list.current, shifts.current, isMoving);
      if (observer.current) {
        watch(list.current, observer.current, watched.current);
      }
    }
  }, [isStill, layout, list, order]);
  // A size changed: the rows after it moved with no change of order, and glide as a move does, but
  // where the list's own width changed, as the window resizes, where their places are read still.
  useLayoutEffect(() => {
    const root = list.current;
    if (!root) {
      return undefined;
    }
    const elements = watched.current;
    const sizes = new ResizeObserver(() => {
      const isResized = Math.abs(root.getBoundingClientRect().width - shifts.current.width) >= 1;
      shiftRows(root, shifts.current, canGlide(last.current.isStill) && !isResized);
      watch(root, sizes, elements);
    });
    observer.current = sizes;
    watch(root, sizes, elements);
    return () => {
      sizes.disconnect();
      elements.clear();
      observer.current = undefined;
    };
  }, [list]);
}
