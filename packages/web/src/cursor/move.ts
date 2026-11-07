// Where a cursor's key takes it among a page's stops, and how far the page scrolls for it: a pure
// function of where the stops are, so it is tested without a browser. The page scrolls only when a
// stop comes within `MARGIN` of the screen's top or bottom edge, the top bar and the status line
// counted, or enters another pane that fits the screen, which then shows whole. A stop taller than
// the screen less the margins is read a screen at a time before the cursor leaves it (R5). With no
// cursor, or one scrolled off screen, either key takes the topmost stop on screen (R4).

/** The room kept between a stop and the screen's top or bottom edge, in px. */
export const MARGIN = 100;

/** Where a pane is: what tells it apart from another, and its edges. */
export type PaneBox = { bottom: number; id: unknown; top: number };

/** Where a stop is, in window pixels, and the pane holding it, if any. */
export type Box = { bottom: number; pane?: PaneBox; top: number };

/** The room between the top bar and the status line, in window pixels. */
export type View = { bottom: number; top: number };

/** Where a key moves the cursor, by the index of its stop, and how far the page scrolls, in px. */
export type Step = { focus: number; scrollBy: number };

/** The room a stop has inside the margins: taller than it, a stop is read a screen at a time. */
const roomOf = (view: View) => view.bottom - view.top - 2 * MARGIN;

const isOutside = (box: Box, view: View) => box.bottom <= view.top || box.top >= view.bottom;

/**
 * The scroll that brings a stop inside the margins, whichever edge it crosses; a stop taller than
 * the room shows its top.
 */
export function placed(box: Box, view: View): number {
  const top = view.top + MARGIN;
  const bottom = view.bottom - MARGIN;
  if (box.top < top) {
    return box.top - top;
  }
  return box.bottom > bottom ? Math.min(box.bottom - bottom, box.top - top) : 0;
}

/** The least scroll that shows a pane whole, `null` when it is taller than the view. */
function shownWhole(pane: PaneBox, view: View) {
  if (pane.bottom - pane.top > view.bottom - view.top) {
    return null;
  }
  if (pane.top < view.top) {
    return pane.top - view.top;
  }
  return Math.max(pane.bottom - view.bottom, 0);
}

/**
 * How far the page scrolls for the cursor to take `next` from `held`: the least that shows the pane
 * it enters whole, if that pane fits the view, else what brings the stop inside the margins.
 */
export function scrollFor(next: Box, held: Box | undefined, view: View) {
  const whole =
    next.pane !== undefined && next.pane.id !== held?.pane?.id ? shownWhole(next.pane, view) : null;
  return whole ?? placed(next, view);
}

/**
 * Where `direction`, 1 for `j` and -1 for `k`, takes the cursor from the stop at `current`, `null`
 * for none: the topmost stop on screen with no cursor, the rest of a tall stop, else the next stop.
 * `null` at either end, and with no stop on screen or under it: the key goes on to scroll.
 */
export function cursorStep(
  stops: ReadonlyArray<Box>,
  current: number | null,
  direction: 1 | -1,
  view: View,
): Step | null {
  const held = current === null ? undefined : stops[current];
  if (current === null || held === undefined || isOutside(held, view)) {
    const topmost = stops.findIndex((box) => box.bottom > view.top);
    const box = stops[topmost];
    return box === undefined ? null : { focus: topmost, scrollBy: placed(box, view) };
  }
  const room = roomOf(view);
  if (held.bottom - held.top > room) {
    // What of the tall stop is past the margin in the key's direction, still to read.
    const past =
      direction === 1 ? held.bottom - (view.bottom - MARGIN) : view.top + MARGIN - held.top;
    if (past > 0) {
      return { focus: current, scrollBy: direction * Math.min(past, room) };
    }
  }
  const focus = current + direction;
  const next = stops[focus];
  if (next === undefined) {
    return null;
  }
  return { focus, scrollBy: scrollFor(next, held, view) };
}
