// The reading place, kept as the page changes around it. A browser's scroll anchoring may keep it on
// its own, but WebKit's, in the tests, held only on the first page drawn, and let go once the page's
// content was replaced, as each page change does (R25). So the page puts it back itself, once the
// change is drawn: where the browser already did, nothing is left to move.

/** Resolves on the next animation frame. */
export const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/**
 * Reads a place on screen with `read`, a distance from the window's top in px, makes `change`, and
 * once two frames have drawn it, scrolls the window so the place is back where it was.
 */
export async function keepPlace(read: () => number, change?: () => void) {
  const before = read();
  change?.();
  await frame();
  await frame();
  const moved = read() - before;
  // A place gone from the page reads NaN: nothing to keep.
  if (Number.isFinite(moved) && Math.abs(moved) >= 0.5) {
    window.scrollBy({ behavior: "instant", top: moved });
  }
}

/** The top of an element on screen, in px, NaN once it left the page: a block's place. */
export const topOf = (element: Element) => () =>
  element.isConnected ? element.getBoundingClientRect().top : Number.NaN;
