// Following a session's transcript: it opens at its end, and keeps its end in view as it grows
// while the human is there.
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWidthClass, widthClassNow } from "./layout/useWidthClass.ts";
import { currentEntry } from "./routes.tsx";

/** How close to its end, in pixels, the transcript still counts as read to the end. */
const AT_END = 24;

/** The element that scrolls an element: the nearest that scrolls on its own, or the window. */
function scroller(element: HTMLElement): HTMLElement | undefined {
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
 * window. `following` says whether the human was at the end when they last scrolled, enabled or
 * not, and `jumpToLatest` brings them back there, following again.
 */
export function useFollowEnd(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const [following, setFollowing] = useState(true);
  // Read by the observer between draws: the last position the human scrolled to, at the end or not.
  const followingNow = useRef(true);
  const box = useRef<HTMLElement | undefined>(undefined);
  const width = useWidthClass();
  const drawn = useRef(width);
  // The positions are the human's again a frame after the layout for the width commits, once
  // `useKeepPlace` has put the place back: until then, the end the new layout's height clamps the
  // window at is not one the human scrolled to.
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      drawn.current = width;
    });
    return () => cancelAnimationFrame(frame);
  }, [width]);

  // Only a scroll sets whether the human follows: growing does not, so a message sent from the end
  // of an idle session keeps them following once the session works.
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
    return () => target.removeEventListener("scroll", read);
  }, [ref]);

  // Only a session at work scrolls: to its end as it starts working, and as it grows.
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) {
      return;
    }
    const follow = () => {
      if (followingNow.current) {
        toEnd(box.current);
      }
    };
    follow();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(follow);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [ref, enabled]);

  const jumpToLatest = useCallback(() => {
    followingNow.current = true;
    setFollowing(true);
    toEnd(box.current);
  }, []);
  return { following, jumpToLatest };
}
