// Following a session's transcript: it opens at its end, and keeps its end in view as it grows
// while the human is there.
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWidthClass, widthClassNow } from "./layout/useWidthClass.ts";
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
    toEnd(scroller(element));
    // Once, as the view opens.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Scrolls `box`, or the window without one, to its end. */
function toEnd(box: HTMLElement | undefined) {
  if (box) {
    box.scrollTo(0, box.scrollHeight);
  } else {
    window.scrollTo(0, document.documentElement.scrollHeight);
  }
}

/**
 * Keeps the end of an element in view as it grows, while `enabled` and while the human is at the
 * end: scrolled up, nothing moves. It scrolls the nearest element that scrolls on its own, or the
 * window. `following` says whether the human is at the end, enabled or not, and `jumpToLatest`
 * brings them back there, following again.
 */
export function useFollowEnd(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const [following, setFollowing] = useState(true);
  // Read by the observer between draws: the last position read, at the end or not.
  const followingNow = useRef(true);
  const box = useRef<HTMLElement | undefined>(undefined);
  const width = useWidthClass();
  const drawn = useRef(width);
  useLayoutEffect(() => {
    drawn.current = width;
  }, [width]);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    box.current = scroller(element);
    const read = () => {
      // A layout drawn for the other width class, as the window crosses the breakpoint: its
      // positions are not the human's, and `useKeepPlace` puts the place back.
      if (widthClassNow() !== drawn.current) {
        return;
      }
      followingNow.current = atEnd(box.current);
      setFollowing(followingNow.current);
    };
    read();
    const target = box.current ?? window;
    target.addEventListener("scroll", read, { passive: true });
    // Growing does not scroll: the last position read holds until the human scrolls. Only a session
    // at work follows its end; another reads whether its end moved away.
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => {
            if (enabled && followingNow.current) {
              toEnd(box.current);
            } else {
              read();
            }
          });
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      target.removeEventListener("scroll", read);
    };
  }, [ref, enabled]);

  const jumpToLatest = useCallback(() => {
    followingNow.current = true;
    setFollowing(true);
    toEnd(box.current);
  }, []);
  return { following, jumpToLatest };
}
