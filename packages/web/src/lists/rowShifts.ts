// The rows of a list gliding to their new places, as a key moved one or a row before it went, the
// way a drag glides them (see `WorkList`).
import { type RefObject, useLayoutEffect, useRef } from "react";

/** The glide of a row that changed place: as a key moved it, or a row before it went. */
const SHIFT = { duration: 200, easing: "cubic-bezier(0.25, 1, 0.5, 1)" };

/** Where each row of a list was, by key, in the list's own content, and the glides that run. */
type Shifts = {
  places: Map<string, { x: number; y: number }>;
  running: WeakMap<Element, Animation>;
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
}

/**
 * Glides each row of `list` that changed place since the last render from where it was, as a drag
 * does: dnd-kit animates only during one. Where it was is read in the list's own content, so the
 * page's scroll and the columns' are no move. Nothing glides while `isStill`, during a drag and as
 * it ends, nor as `layout` changes or the list resizes, nor for a human who asked for less motion.
 */
export function useRowShifts(
  list: RefObject<HTMLElement | null>,
  isStill: boolean,
  layout: string,
) {
  const shifts = useRef<Shifts>({ places: new Map(), running: new WeakMap() });
  const last = useRef({ isStill, layout });
  useLayoutEffect(() => {
    const isMoving =
      !isStill &&
      !last.current.isStill &&
      last.current.layout === layout &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    last.current = { isStill, layout };
    if (list.current) {
      shiftRows(list.current, shifts.current, isMoving);
    }
  });
  // A resize moves every row with no render: their places are read again, still.
  useLayoutEffect(() => {
    const root = list.current;
    if (!root) {
      return undefined;
    }
    const observer = new ResizeObserver(() => shiftRows(root, shifts.current, false));
    observer.observe(root);
    return () => observer.disconnect();
  }, [list]);
}
