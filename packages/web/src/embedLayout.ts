// A story embed's room on the page: how far it grows past its column into the empty space beside it,
// on a wide screen, so a desktop story shows nearer its own size; and full screen, the browser's own,
// entered and left from the embed and followed as Escape leaves it, or an overlay where it has none.
import { type RefObject, useContext, useEffect, useState } from "react";
import { useBackCloses } from "./layout/useBackCloses.ts";
import { PageColumn } from "./layout/Page.tsx";

/** A length in px from a style's value, 0 when it has none. */
const px = (value: string) => Number.parseFloat(value) || 0;

/** The space kept between a grown embed and what stops it: a column beside it, or the page's edge. */
const GAP = 16;

/** How far the embed grows on each side, in px. */
export type Outgrow = { end: number; start: number };

/**
 * The limits of the space beside the embed's own box, `own`: the page's container, less its inset,
 * any ancestor that clips, and any element beside the box at the same height, in its column's
 * ancestors up to the page, so no column beside it is covered. Elements above or below it, as other blocks, do not stop it.
 */
function room(own: DOMRect, from: Element, page: Element, outer: Element, inset: number) {
  const bounds = outer.getBoundingClientRect();
  let start = bounds.left + inset;
  let end = bounds.right - inset;
  for (let at: Element | null = from; at && at !== outer; at = at.parentElement) {
    // An ancestor that clips, like a card, stops the growth at its own edges: it would cut it.
    if (getComputedStyle(at).overflowX !== "visible") {
      const box = at.getBoundingClientRect();
      start = Math.max(start, box.left + at.clientLeft);
      end = Math.min(end, box.left + at.clientLeft + at.clientWidth);
    }
    for (const sibling of at.parentElement?.children ?? []) {
      const box = sibling.getBoundingClientRect();
      if (sibling === at || box.width === 0 || box.bottom <= own.top || box.top >= own.bottom) {
        continue;
      }
      if (box.right <= own.left) {
        start = Math.max(start, box.right + GAP);
      } else if (box.left >= own.right) {
        end = Math.min(end, box.left - GAP);
      }
    }
    if (at === page) {
      break;
    }
  }
  return { end: Math.max(0, end - own.right), start: Math.max(0, own.left - start) };
}

/**
 * How many px the embed grows past each side of its box, on a wide screen: up to `width`, the
 * desktop's by default, with its stage's inset, into the empty space beside it within its page's
 * container, more on the side with more room. None outside a page, or on a narrow screen.
 */
export function useOutgrow(
  embed: RefObject<HTMLElement | null>,
  wide: boolean,
  width?: number,
): Outgrow {
  const column = useContext(PageColumn);
  const [grow, setGrow] = useState<Outgrow>({ end: 0, start: 0 });
  // After the commit, once the page's column has its ref, which a parent gets after its children's
  // layout effects ran.
  useEffect(() => {
    const page = column?.current;
    const own = embed.current;
    const outer = page?.parentElement;
    const parent = own?.parentElement;
    if (!page || !own || !outer || !parent) {
      return;
    }
    const measure = () => {
      const style = getComputedStyle(parent);
      const box = parent.getBoundingClientRect();
      const figure = own.getBoundingClientRect();
      // The embed's box without its growth: its parent's content box, at the embed's height.
      const natural = new DOMRect(
        box.left + px(style.paddingLeft),
        figure.top,
        box.width - px(style.paddingLeft) - px(style.paddingRight),
        figure.height,
      );
      const want = wide
        ? Math.max(
            0,
            (width ?? px(getComputedStyle(own).getPropertyValue("--size-story-desktop"))) +
              2 * GAP +
              2 -
              natural.width,
          )
        : 0;
      const free = room(natural, parent, page, outer, px(getComputedStyle(page).paddingLeft));
      // A side with less room than the gap does not grow: a few px would only lay the embed's
      // border over its pane's.
      const [open, close] = [free.start, free.end].map((side) => (side < GAP ? 0 : side));
      const half = want / 2;
      const start = Math.min(open!, Math.max(half, want - close!));
      const end = Math.min(close!, want - start);
      setGrow((known) =>
        Math.abs(known.start - start) < 0.5 && Math.abs(known.end - end) < 0.5
          ? known
          : { end, start },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [column, embed, wide, width]);
  return grow;
}

/**
 * Whether the embed is full screen, and what enters or leaves it: the browser's own full screen, or,
 * where the browser has none for an element, as on an iPhone, an overlay covering the screen,
 * `overlay`, which the button, Escape, and Back leave.
 */
export function useFullScreen(embed: RefObject<HTMLElement | null>) {
  const [native, setNative] = useState(false);
  const [overlay, setOverlay] = useState(false);
  useEffect(() => {
    const onChange = () => setNative(document.fullscreenElement === embed.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [embed]);
  const leave = useBackCloses("Full screen", overlay, () => setOverlay(false));
  useEffect(() => {
    if (!overlay) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // The page's own Escape does not run as well: the overlay was what Escape meant.
        event.preventDefault();
        leave();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [leave, overlay]);
  const toggle =
    typeof document !== "undefined" && document.fullscreenEnabled
      ? async () => {
          if (document.fullscreenElement === embed.current) {
            await document.exitFullscreen();
          } else {
            await embed.current?.requestFullscreen();
          }
        }
      : async () => (overlay ? leave() : setOverlay(true));
  return { full: native || overlay, overlay, toggle };
}
