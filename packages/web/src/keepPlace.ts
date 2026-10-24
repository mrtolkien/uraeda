// The reading place, kept as the page changes around it. A browser's scroll anchoring may keep it on
// its own, but WebKit's, in the tests, held only on the first page drawn, and let go once the page's
// content was replaced, as each page change does (R25). So the page puts it back itself, once the
// change is drawn: where the browser already did, nothing is left to move.

/** Resolves on the next animation frame. */
export const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** How long after an input of the reader's, in ms, a scroll of the window is theirs. */
const INPUT_WINDOW = 300;

/** What the reader scrolled so far in a scroller, in px, where `watch` saw them at it, and its last place. */
type Scrolled = { last: number; reader: number };

/** What the reader scrolled in each scroller: the window, or a box that scrolls on its own. */
const scrolled = new WeakMap<EventTarget, Scrolled>();
let lastInput = Number.NEGATIVE_INFINITY;
let watching = false;

/** Where `box`, or the window without one, is scrolled to. */
const positionOf = (box?: Element) => (box ? box.scrollTop : window.scrollY);

/** What the reader scrolled in `box`, or the window without one, kept from now on. */
function scrolledIn(box?: Element) {
  const target = box ?? window;
  let state = scrolled.get(target);
  if (!state) {
    state = { last: positionOf(box), reader: 0 };
    scrolled.set(target, state);
  }
  return state;
}

/** Dates the reader's last input. */
const noteInput = () => {
  lastInput = performance.now();
};

/** Counts a scroll as the reader's when an input of theirs came shortly before it. */
const noteScroll = (event: Event) => {
  // The window's scroll comes from the document, a box's from the box.
  const target = event.target as Node | null;
  const box = target?.nodeType === Node.ELEMENT_NODE ? (target as Element) : undefined;
  const state = scrolled.get(box ?? window);
  if (!state) {
    return;
  }
  const scroll = positionOf(box);
  if (performance.now() - lastInput < INPUT_WINDOW) {
    state.reader += scroll - state.last;
  }
  state.last = scroll;
};

/**
 * Starts telling the reader's scrolls from the page's: a scroll shortly after a wheel, a touch, a
 * key, or a press is the reader's. The browser's own scroll anchoring, and the corrections made by
 * `scrollInstantly`, come with no input of theirs, and are not.
 */
function watch() {
  if (watching) {
    return;
  }
  watching = true;
  for (const type of ["keydown", "pointerdown", "touchmove", "touchstart", "wheel"]) {
    window.addEventListener(type, noteInput, { capture: true, passive: true });
  }
  // A box's scroll does not bubble: it is caught on its way down.
  window.addEventListener("scroll", noteScroll, { capture: true, passive: true });
}

/**
 * A mark on the reader's scrolling of `box`, or the window without one: the function it returns
 * says how far they scrolled it since, in px. A place put back by hand is kept at the shift of the
 * page alone, never against the reader's own scroll, nor twice for the browser's anchoring.
 */
export function scrollMark(box?: Element) {
  watch();
  const state = scrolledIn(box);
  state.last = positionOf(box);
  const was = state.reader;
  return () => state.reader - was;
}

/** Scrolls `box`, or the window without one, by `top` px at once, as a correction: the reader did not make it. */
export function scrollInstantly(top: number, box?: Element) {
  (box ?? window).scrollBy({ behavior: "instant", top });
  scrolledIn(box).last = positionOf(box);
}

/**
 * A place being kept: where it was before the first change, the scroller it is in, the last
 * change's number, and the reader's scroll of it since the first change.
 */
type Keep = { before: number; box?: Element; last: number; scrolled: () => number };

/** The places kept while a change is drawn, by their reader, which the changes made meanwhile join. */
const pending = new Map<() => number, Keep>();

/**
 * Reads a place on screen with `read`, a distance from the window's top in px, makes `change`, and
 * once two frames have drawn it, scrolls `box`, the scroller the place is in, or the window without
 * one, so the place is back where it was. A change
 * that returns a promise is drawn once it resolves, however late: the frames count from then. A
 * change made while the same place is being kept, read with the same `read`, joins it: that place
 * is put back once, two frames after the last change, so no change is corrected twice. A place read
 * with another `read` is kept on its own, from where it is read then: its correction reads the page
 * after the others' scrolls.
 */
export async function keepPlace(
  read: () => number,
  change?: () => Promise<void> | void,
  box?: Element,
) {
  const joined = pending.get(read);
  // A place already gone keeps nothing: a new one is kept instead.
  const keep =
    joined && Number.isFinite(joined.before)
      ? joined
      : { before: read(), box, last: 0, scrolled: scrollMark(box) };
  pending.set(read, keep);
  const mine = ++keep.last;
  await change?.();
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
    scrollInstantly(moved, keep.box);
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
