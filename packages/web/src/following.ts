// Following a session's transcript: it opens at its end, and keeps its end in view as it grows
// while the human is there.
import { type RefObject, useEffect, useLayoutEffect } from "react";
import { currentEntry } from "./routes.tsx";

/** How close to its end, in pixels, the transcript still counts as read to the end. */
export const AT_END = 24;

/** The element that scrolls an element: the nearest that scrolls on its own, or the window. */
export function scroller(element: HTMLElement): HTMLElement | undefined {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll") {
      return node;
    }
  }
  return undefined;
}

/** Whether `box`, or the window without one, shows its end, within `AT_END`. */
export function atEnd(box?: HTMLElement) {
  return box
    ? box.scrollHeight - box.scrollTop - box.clientHeight <= AT_END
    : document.documentElement.scrollHeight - window.scrollY - window.innerHeight <= AT_END;
}

/**
 * Shows the end of a session's transcript as it opens, unless Back or a reload brings a saved
 * position, or the address names a turn.
 */
export function useOpenAtEnd(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = ref.current;
    const { scroll } = currentEntry();
    if (!element || scroll !== undefined) {
      return;
    }
    if (window.location.hash.startsWith("#turn-")) {
      return;
    }
    const box = scroller(element);
    if (box) {
      box.scrollTo(0, box.scrollHeight);
    } else {
      window.scrollTo(0, document.documentElement.scrollHeight);
    }
    // Once, as the view opens.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Keeps the end of an element in view as it grows, while `enabled` and while the human is at the
 * end: scrolled up, nothing moves. It scrolls the nearest element that scrolls on its own, or the
 * window.
 */
export function useFollowEnd(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element || typeof ResizeObserver === "undefined") {
      return;
    }
    const box = scroller(element);
    // Growing does not scroll: the last position read, at the end or not, holds until the human
    // scrolls.
    let following = atEnd(box);
    const onScroll = () => {
      following = atEnd(box);
    };
    const target = box ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(() => {
      if (following) {
        if (box) {
          box.scrollTo(0, box.scrollHeight);
        } else {
          window.scrollTo(0, document.documentElement.scrollHeight);
        }
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      target.removeEventListener("scroll", onScroll);
    };
  }, [ref, enabled]);
}
