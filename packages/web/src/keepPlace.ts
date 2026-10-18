// The reading place, kept as the page changes around it. A browser's scroll anchoring may keep it on
// its own, but WebKit's, in the tests, held only on the first page drawn, and let go once the page's
// content was replaced, as each page change does (R25). So the page puts it back itself, once the
// change is drawn: where the browser already did, nothing is left to move.

/** Resolves on the next animation frame. */
export const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** The total, in px, of the instant corrections made so far, which a reader's scroll never includes. */
let corrected = 0;

/**
 * A mark on the window's scroll: the function it returns says how far the reader scrolled since,
 * in px, without the instant corrections made by `scrollInstantly` meanwhile, which put places
 * back. A place put back by hand is kept at the shift of the page alone, never against the reader's
 * own scroll.
 */
export function scrollMark() {
  const scroll = window.scrollY;
  const was = corrected;
  return () => window.scrollY - scroll - (corrected - was);
}

/** Scrolls the window by `top` px at once, as a correction: the reader did not make it. */
export function scrollInstantly(top: number) {
  const scroll = window.scrollY;
  window.scrollBy({ behavior: "instant", top });
  corrected += window.scrollY - scroll;
}

/**
 * A place being kept: where it was before the first change, the last change's number, and the
 * reader's scroll since the first change.
 */
type Keep = { before: number; last: number; scrolled: () => number };

/** The places kept while a change is drawn, by their reader, which the changes made meanwhile join. */
const pending = new Map<() => number, Keep>();

/**
 * Reads a place on screen with `read`, a distance from the window's top in px, makes `change`, and
 * once two frames have drawn it, scrolls the window so the place is back where it was. A change
 * made while the same place is being kept, read with the same `read`, joins it: that place is put
 * back once, two frames after the last change, so no change is corrected twice. A place read with
 * another `read` is kept on its own, from where it is read then: its correction reads the page
 * after the others' scrolls.
 */
export async function keepPlace(read: () => number, change?: () => void) {
  const joined = pending.get(read);
  // A place already gone keeps nothing: a new one is kept instead.
  const keep =
    joined && Number.isFinite(joined.before)
      ? joined
      : { before: read(), last: 0, scrolled: scrollMark() };
  pending.set(read, keep);
  const mine = ++keep.last;
  change?.();
  await frame();
  await frame();
  if (keep.last !== mine) {
    return;
  }
  if (pending.get(read) === keep) {
    pending.delete(read);
  }
  // What the reader scrolled meanwhile is theirs: only the page's own shift is put back.
  const moved = read() - keep.before + keep.scrolled();
  // A place gone from the page reads NaN: nothing to keep.
  if (Number.isFinite(moved) && Math.abs(moved) >= 0.5) {
    scrollInstantly(moved);
  }
}

/** Each element's reader, so the same place is read with the same function. */
const tops = new WeakMap<Element, () => number>();
const bottoms = new WeakMap<Element, () => number>();

/** A reader of an element's edge, the same function for the same element. */
function readerOf(
  readers: WeakMap<Element, () => number>,
  element: Element,
  edge: "bottom" | "top",
) {
  let read = readers.get(element);
  if (!read) {
    read = () => (element.isConnected ? element.getBoundingClientRect()[edge] : Number.NaN);
    readers.set(element, read);
  }
  return read;
}

/** The top of an element on screen, in px, NaN once it left the page: a block's place. */
export const topOf = (element: Element) => readerOf(tops, element, "top");

/** The bottom of an element on screen, in px, NaN once it left the page: a story frame's place. */
export const bottomOf = (element: Element) => readerOf(bottoms, element, "bottom");
