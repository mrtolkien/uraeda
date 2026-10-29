// A page's column centred on the screen, not on the room between the sidebars: with a wider column
// open at the right than the sidebar at the left, the room's middle sits left of the screen's, and
// the page drifts with it. Its start margin takes the room the screen's middle asks for, as far as
// the room beside it allows, so a page with no room to spare stays where it was. It follows the
// room as it changes, frame by frame while a column eases open or closed. A margin, not a
// transform: a transform would hold the page's fixed parts, as a list's bar, to the page.
import { useCallback } from "react";

/** The start margin that puts `page` in the screen's middle, as far as its parent's room allows. */
function marginOf(page: HTMLElement, parent: HTMLElement): number {
  const style = getComputedStyle(parent);
  const start = parent.getBoundingClientRect().left + parent.clientLeft;
  const left = start + (Number.parseFloat(style.paddingInlineStart) || 0);
  const room =
    parent.clientWidth -
    (Number.parseFloat(style.paddingInlineStart) || 0) -
    (Number.parseFloat(style.paddingInlineEnd) || 0) -
    page.offsetWidth;
  const wanted = document.documentElement.clientWidth / 2 - page.offsetWidth / 2 - left;
  return Math.round(Math.min(Math.max(room, 0), Math.max(0, wanted)));
}

/** Keeps `page` in the screen's middle, as far as its parent's room allows, until the cleanup. */
function centre(page: HTMLElement): () => void {
  const parent = page.parentElement;
  if (!parent) {
    return () => {};
  }
  // Written on the element, not a StyleX style: it changes frame by frame while a column eases,
  // where a render of the page each frame would stutter.
  const place = () => {
    page.style.marginInlineStart = `${marginOf(page, parent)}px`;
    page.style.marginInlineEnd = "0";
  };
  place();
  const observer = new ResizeObserver(place);
  observer.observe(page);
  observer.observe(parent);
  window.addEventListener("resize", place);
  return () => {
    observer.disconnect();
    window.removeEventListener("resize", place);
    page.style.removeProperty("margin-inline-start");
    page.style.removeProperty("margin-inline-end");
  };
}

/**
 * A ref callback that moves its element to the screen's middle while `isOn`, a wide screen's page:
 * see the file's opening.
 */
export function useScreenCentre(isOn: boolean) {
  return useCallback(
    (page: HTMLElement | null) => (isOn && page ? centre(page) : undefined),
    [isOn],
  );
}
