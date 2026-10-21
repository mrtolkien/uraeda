// Following a session's transcript: it opens at its end, and keeps its end in view as it grows
// while the human is there.
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

/** How far `box`, or the window without one, goes on past what it shows, in pixels. */
function past(box?: HTMLElement) {
  return box
    ? box.scrollHeight - box.scrollTop - box.clientHeight
    : document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
}

/** Whether `box`, or the window without one, shows its end, within `AT_END`. */
export function atEnd(box?: HTMLElement) {
  return past(box) <= AT_END;
}

/**
 * Shows the end of a session's transcript as it opens, unless Back or a reload brings a saved
 * position, or the address names a turn. `element` is the transcript, or what it is drawn in.
 */
export function openAtEnd(element: HTMLElement) {
  if (currentEntry().scroll !== undefined || window.location.hash.startsWith("#turn-")) {
    return;
  }
  toEnd(scroller(element));
}

/**
 * `openAtEnd`, as the page opens, unless `away` says the human scrolled away from the end while it
 * waited for its data (R110).
 */
export function useOpenAtEnd(ref: RefObject<HTMLElement | null>, away?: ScrolledAway) {
  useLayoutEffect(() => {
    if (ref.current && !away?.isAway()) {
      openAtEnd(ref.current);
    }
    // Once, as the view opens.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Keeps the end in view as an element at the transcript's end first draws, when the human was at
 * the end before it: what is past the end once it draws is no more than its own height. A card
 * drawn after the page opened at its end, as an offer's, would otherwise sit under the composer.
 */
export function keepsEnd(element: HTMLElement) {
  const box = scroller(element);
  if (past(box) - element.getBoundingClientRect().height <= AT_END) {
    toEnd(box);
  }
}

/** Where each scroller, or the window, was last moved to its end, by `toEnd`. */
const ownEnds = new WeakMap<EventTarget, number>();

/** Scrolls `box`, or the window without one, to its end, and says where that put it. */
function toEnd(box: HTMLElement | undefined) {
  if (box) {
    box.scrollTo(0, box.scrollHeight);
  } else {
    window.scrollTo(0, document.documentElement.scrollHeight);
  }
  const at = position(box);
  ownEnds.set(box ?? window, at);
  return at;
}

/**
 * Whether the human scrolled away from the end of a session's page before its log drew: `isAway`
 * says it once the session is watched, and `settle` stops watching, as the log draws.
 */
export type ScrolledAway = { isAway: () => boolean; settle: () => void };

/**
 * Whether the human scrolled away from the end of the page that `ref`'s element is in, for the
 * `session` it shows, from the moment the page shows it until the session's log draws and settles
 * it (R110). Kept outside the log, which waits for its data, so that a scroll made meanwhile counts;
 * once the log draws, its own following says where the human is, and this stops reading scrolls. A
 * log that draws in the same commit as its session opens, before the session is watched, finds the
 * human not away. The last scroll says: one that leaves the page short of its end, away; one at the
 * end, not. The first scroll that finds the page where it opened, as a link's move to the top, and
 * any that finds it where a move to the end put it, are the page's own, read late, maybe after the
 * page grew under it, and say nothing.
 */
export function useScrolledAway(
  ref: RefObject<HTMLElement | null>,
  session: string | undefined,
): ScrolledAway {
  const away = useRef(false);
  const stop = useRef<() => void>(() => {});
  const settled = useRef<string | undefined>(undefined);
  const watched = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    away.current = false;
    watched.current = undefined;
    if (!ref.current || session === undefined || settled.current === session) {
      return;
    }
    watched.current = session;
    const box = scroller(ref.current);
    const target = box ?? window;
    let opened: number | undefined = position(box);
    const read = () => {
      const at = position(box);
      const own = at === opened || at === ownEnds.get(target);
      // Only the first scroll can be the opening's, read late.
      opened = undefined;
      if (!own) {
        away.current = !atEnd(box);
      }
    };
    target.addEventListener("scroll", read, { passive: true });
    stop.current = () => target.removeEventListener("scroll", read);
    return () => stop.current();
  }, [ref, session]);
  return useMemo(
    () => ({
      isAway: () => watched.current === session && away.current,
      settle: () => {
        settled.current = session;
        stop.current();
      },
    }),
    [session],
  );
}

/** Where `box`, or the window without one, is scrolled to. */
function position(box: HTMLElement | undefined) {
  return box ? box.scrollTop : window.scrollY;
}

/**
 * Scrolls `box`, or the window without one, to its end, and says where that put it when it moved
 * there: the browser then sends a scroll of its own, dispatched at its next rendering update.
 */
function movedToEnd(box: HTMLElement | undefined) {
  const from = position(box);
  const to = toEnd(box);
  return to === from ? undefined : to;
}

/**
 * Holds the height of a transcript's column, so that the page never ends above the bottom of the
 * view: what leaves at the column's end leaves blank space instead of shortening the page under the
 * view, which would move the position and send a scroll the human did not make. `following` says
 * whether the human follows the end; `held` is the height held now, in pixels, and the new one is
 * returned.
 */
function holdEnd(
  column: HTMLElement,
  box: HTMLElement | undefined,
  following: boolean,
  held: number | undefined,
) {
  const height = column.getBoundingClientRect().height;
  // The column's height that keeps the page's end at the bottom of the view.
  const view = height - Math.max(0, past(box));
  // A column taller than what it holds: its content fills the space, and the hold does nothing.
  const filled = held === undefined || height > held + 0.5;
  // Following, the view's bottom is held; scrolled up, what is under the view goes, so the human's
  // scroll up takes the blank space away.
  const next = following ? view : filled ? undefined : Math.min(held, view);
  const kept = next !== undefined && next > 0 ? next : undefined;
  if (kept === held || (kept !== undefined && held !== undefined && Math.abs(kept - held) < 0.5)) {
    return held;
  }
  const style = getComputedStyle(column);
  // `min-height` sizes the content box, unless the column sizes its border box.
  const frame =
    style.boxSizing === "border-box"
      ? 0
      : ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"].reduce(
          (sum, side) => sum + (Number.parseFloat(style[side as "paddingTop"]) || 0),
          0,
        );
  column.style.minHeight = kept === undefined ? "" : `${kept - frame}px`;
  return kept;
}

/**
 * The column `useFollowEnd` holds the height of: `attach` names it once drawn, or none, letting the
 * last one go; `hold` holds it as far as the human's place in `box` asks; and `release` lets it go,
 * as the layout changes for another width.
 */
function useHeldEnd(box: RefObject<HTMLElement | undefined>, following: RefObject<boolean>) {
  const column = useRef<HTMLElement | undefined>(undefined);
  const held = useRef<number | undefined>(undefined);
  const hold = useCallback(() => {
    if (column.current) {
      held.current = holdEnd(column.current, box.current, following.current, held.current);
    }
  }, [box, following]);
  const release = useCallback(() => {
    column.current?.style.removeProperty("min-height");
    held.current = undefined;
  }, []);
  const attach = useCallback(
    (element: HTMLElement | undefined) => {
      release();
      column.current = element;
    },
    [release],
  );
  return { attach, hold, release };
}

/**
 * Keeps the end of an element in view as it grows, while `enabled` and while the human is at the
 * end: scrolled up, nothing moves. It scrolls the nearest element that scrolls on its own, or the
 * window. `following` says whether the human was at the end when they last scrolled, enabled or
 * not, `isFollowing` says it between draws, and `jumpToLatest` brings them back there, following
 * again.
 *
 * Only the human's scroll stops following. While they follow, the element's column (its parent,
 * with what is drawn after the transcript, such as a session's banner) never gets shorter: what
 * leaves at its end leaves blank space, until new content fills it or the human scrolls up. A page
 * that got shorter under the view would move the position, and the browser dispatches that scroll
 * only at its next rendering update, after the reply may have drawn: it would read as the human
 * scrolling up. The hook's own scrolls are told by the position they set.
 */
export function useFollowEnd(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const [following, setFollowing] = useState(true);
  // Read by the observer between draws: the last position the human scrolled to, at the end or not.
  const followingNow = useRef(true);
  const box = useRef<HTMLElement | undefined>(undefined);
  // The position the hook last moved the scroller to: the next scroll that finds it there is the
  // hook's own, read late, and says nothing of where the human is.
  const own = useRef<number | undefined>(undefined);
  const { attach, hold, release } = useHeldEnd(box, followingNow);
  const width = useWidthClass();
  const drawn = useRef(width);
  // The positions are the human's again a frame after the layout for the width commits, once
  // `useKeepPlace` has put the place back: until then, the end the new layout's height clamps the
  // window at is not one the human scrolled to. A height held for the other width is not this one's.
  useLayoutEffect(() => {
    if (drawn.current !== width) {
      release();
    }
    const frame = requestAnimationFrame(() => {
      drawn.current = width;
      hold();
    });
    return () => cancelAnimationFrame(frame);
  }, [width, hold, release]);

  // Only a scroll sets whether the human follows: growing does not, so a message sent from the end
  // of an idle session keeps them following once the session works.
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    box.current = scroller(element);
    // The transcript itself when its parent is what scrolls: a scroller's own height is not held.
    const parent = element.parentElement;
    attach(parent && parent !== box.current ? parent : element);
    const read = () => {
      // A layout drawn for the other width class, as the window crosses the breakpoint: its
      // positions are not the human's, and `useKeepPlace` puts the place back.
      if (widthClassNow() !== drawn.current) {
        return;
      }
      const mine = position(box.current) === own.current;
      own.current = undefined;
      if (!mine) {
        followingNow.current = atEnd(box.current);
        setFollowing(followingNow.current);
      }
      hold();
    };
    read();
    const target = box.current ?? window;
    target.addEventListener("scroll", read, { passive: true });
    return () => {
      target.removeEventListener("scroll", read);
      attach(undefined);
    };
  }, [ref, attach, hold]);

  // Only a session at work scrolls: to its end as it starts working, and as it grows, and once more
  // as it stops, for what its end draws with it, as a banner that says why it needs the human.
  const wasEnabled = useRef(false);
  useEffect(() => {
    const element = ref.current;
    const follow = () => {
      if (followingNow.current) {
        own.current = movedToEnd(box.current) ?? own.current;
        hold();
      }
    };
    if (!element || !enabled) {
      if (element && wasEnabled.current) {
        follow();
      }
      wasEnabled.current = false;
      return;
    }
    wasEnabled.current = true;
    follow();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(follow);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [ref, enabled, hold]);

  const jumpToLatest = useCallback(() => {
    followingNow.current = true;
    setFollowing(true);
    own.current = movedToEnd(box.current) ?? own.current;
    hold();
  }, [hold]);
  // Read between draws, as the transcript's tail first draws (R110).
  const isFollowing = useCallback(() => followingNow.current, []);
  return { following, isFollowing, jumpToLatest };
}
