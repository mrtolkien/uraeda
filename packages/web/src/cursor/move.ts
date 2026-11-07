// Where a cursor's key takes it among a page's stops, and how far the page scrolls for it: a pure
// function of where the stops are, so it is tested without a browser. The page scrolls only when a
// stop comes within `MARGIN` of the screen's top or bottom edge, the top bar and the status line
// counted, or enters another pane that fits inside the margins, which then shows whole inside them
// (R13). A stop taller than the screen less the margins is read a screen at a time before the
// cursor leaves it, and shows its top or its end as the cursor moves onto it down or up (R5). The
// stops nested in another, an embed's buttons in a question card, are passed by when the cursor
// leaves it forward, and lead to it backward: Tab reaches them (R12). With no cursor, or one
// scrolled off screen, either key takes the topmost stop whose top is on screen (R4).

/** The room kept between a stop and the screen's top or bottom edge, in px. */
export const MARGIN = 100;

/** Where a pane is: what tells it apart from another, and its edges. */
export type PaneBox = { bottom: number; id: unknown; top: number };

/**
 * Where a stop is, in window pixels, the pane holding it, if any, and the index of the stop holding
 * it among the same list, if any, as an embed's button inside a question card.
 */
export type Box = { bottom: number; pane?: PaneBox; parent?: number; top: number };

/** The room between the top bar and the status line, in window pixels. */
export type View = { bottom: number; top: number };

/** Where a key moves the cursor, by the index of its stop, and how far the page scrolls, in px. */
export type Step = { focus: number; scrollBy: number };

/** The room a stop has inside the margins: taller than it, a stop is read a screen at a time. */
const roomOf = (view: View) => view.bottom - view.top - 2 * MARGIN;

const isOutside = (box: Box, view: View) => box.bottom <= view.top || box.top >= view.bottom;

/**
 * The scroll that brings a stop inside the margins, whichever edge it crosses; a stop taller than
 * the room shows its top when the cursor moves down onto it, 1, and its end when it moves up, -1,
 * so the next key in that direction reads through its body.
 */
export function placed(box: Box, view: View, direction: 1 | -1 = 1): number {
  const top = view.top + MARGIN;
  const bottom = view.bottom - MARGIN;
  if (direction === -1) {
    if (box.bottom > bottom) {
      return box.bottom - bottom;
    }
    return box.top < top ? Math.max(box.top - top, box.bottom - bottom) : 0;
  }
  if (box.top < top) {
    return box.top - top;
  }
  return box.bottom > bottom ? Math.min(box.bottom - bottom, box.top - top) : 0;
}

/**
 * The least scroll that shows a pane whole inside the margins, `null` when it is taller than the
 * room: such a pane is placed by its stop alone.
 */
function shownWhole(pane: PaneBox, view: View) {
  if (pane.bottom - pane.top > roomOf(view)) {
    return null;
  }
  if (pane.top < view.top + MARGIN) {
    return pane.top - (view.top + MARGIN);
  }
  return Math.max(pane.bottom - (view.bottom - MARGIN), 0);
}

/**
 * How far the page scrolls for the cursor to take `next` from `held`, moving in `direction`: the
 * least that shows the pane it enters whole, if that pane fits the view, else what brings the stop
 * inside the margins.
 */
export function scrollFor(next: Box, held: Box | undefined, view: View, direction: 1 | -1 = 1) {
  const whole =
    next.pane !== undefined && next.pane.id !== held?.pane?.id ? shownWhole(next.pane, view) : null;
  return whole ?? placed(next, view, direction);
}

/** Whether the stop at `index` is nested, at any depth, in the stop at `outer`. */
function isWithin(stops: ReadonlyArray<Box>, index: number, outer: number) {
  for (let at = stops[index]?.parent; at !== undefined; at = stops[at]?.parent) {
    if (at === outer) {
      return true;
    }
  }
  return false;
}

/**
 * The stop a move in `direction` from `current` takes: forward, the next not nested in the held
 * stop; backward, the previous, or the outermost stop holding it that does not hold the held one,
 * so a card is landed on, not the last of its inner buttons.
 */
function nextOf(stops: ReadonlyArray<Box>, current: number, direction: 1 | -1) {
  let focus = current + direction;
  if (direction === 1) {
    while (focus < stops.length && isWithin(stops, focus, current)) {
      focus += 1;
    }
    return focus;
  }
  for (let at = stops[focus]?.parent; at !== undefined; at = stops[at]?.parent) {
    if (!isWithin(stops, current, at)) {
      focus = at;
    }
  }
  return focus;
}

/**
 * The scroll that reads on through a tall stop in `direction`, 0 at its end: what is left past the
 * margin, in one step when it is no more than the view, as what was at one edge comes to the other
 * and nothing is passed by, else a room at a time, keeping 200 px of the last in view (R5).
 */
function readOn(held: Box, view: View, direction: 1 | -1) {
  const past =
    direction === 1 ? held.bottom - (view.bottom - MARGIN) : view.top + MARGIN - held.top;
  // Less than a pixel is read: a scroll cannot move by it, and the cursor would stay.
  if (past < 1) {
    return 0;
  }
  return direction * (past <= view.bottom - view.top ? past : roomOf(view));
}

/**
 * The stop the cursor starts from: the first whose top is inside the view, so a stop that only
 * peeks under the top bar is passed by, else the first that reaches into it or lies under it.
 */
function startOf(stops: ReadonlyArray<Box>, view: View) {
  const inside = stops.findIndex((box) => box.top >= view.top && box.top < view.bottom);
  return inside === -1 ? stops.findIndex((box) => box.bottom > view.top) : inside;
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
    const start = startOf(stops, view);
    const box = stops[start];
    return box === undefined ? null : { focus: start, scrollBy: scrollFor(box, undefined, view) };
  }
  if (held.bottom - held.top > roomOf(view)) {
    const scrollBy = readOn(held, view, direction);
    if (scrollBy !== 0) {
      return { focus: current, scrollBy };
    }
  }
  const focus = nextOf(stops, current, direction);
  const next = stops[focus];
  if (next === undefined) {
    return null;
  }
  return { focus, scrollBy: scrollFor(next, held, view, direction) };
}
