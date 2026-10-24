// The reading place, kept as the width class changes, in the window or in the box that scrolls the
// content on its own: for a moment, the browser lays the layout drawn for the old width out at the
// new one, a column beside the content squeezing it, which moves the scroll position or clamps it at
// the end. The place is put back once the new layout is drawn.
import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { atEnd, scroller } from "./following.ts";
import { scrollInstantly } from "./keepPlace.ts";
import { isNarrow, useWidthClass, widthClassNow } from "./layout/useWidthClass.ts";

/** How far down the view the place is read: below the top bar, above the sticky composer. */
const READ_AT = 1 / 3;

/** Whether an element holds text of its own, besides its children's. */
function holdsText(element: Element) {
  return [...element.childNodes].some(
    (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
  );
}

/**
 * The innermost element of `parent` that reaches `line` first, or lies below it: the text read
 * there. Elements wholly above it are passed over without looking inside them.
 */
function firstFrom(parent: Element, line: number): Element | undefined {
  for (const child of parent.children) {
    if (child.getBoundingClientRect().bottom < line) {
      continue;
    }
    if (child.children.length === 0) {
      return child;
    }
    const inner = firstFrom(child, line);
    if (inner) {
      return inner;
    }
    // A child across the line whose children are all above it: a paragraph whose inline code
    // comes first is the place itself, while a message's padding under its text is passed.
    if (holdsText(child)) {
      return child;
    }
  }
  return undefined;
}

/**
 * The text of `content` read a third down its view, `box` or the window without one, and how far
 * from the window's top it is.
 */
function placeIn(
  content: HTMLElement,
  box: HTMLElement | undefined,
): { element: Element; top: number } | undefined {
  const line = box
    ? box.getBoundingClientRect().top + box.clientHeight * READ_AT
    : window.innerHeight * READ_AT;
  const element = firstFrom(content, line);
  return element && { element, top: element.getBoundingClientRect().top };
}

/** Moves `box`, or the window without one, by `by` pixels, or to its end. */
function moveBy(box: HTMLElement | undefined, by: number | "end") {
  if (!box) {
    if (by === "end") {
      window.scrollTo(0, document.documentElement.scrollHeight);
    } else {
      scrollInstantly(by);
    }
  } else {
    box.scrollTop = by === "end" ? box.scrollHeight : box.scrollTop + by;
  }
}

/**
 * Keeps the place the human reads in `content` as the window crosses the narrow breakpoint: the
 * element a third down its view, the box that scrolls it or the window, stays there, or the end
 * stays in view.
 */
export function useKeepPlace(content: RefObject<HTMLElement | null>) {
  // Pages lay out alike at semi-wide and wide: only crossing into or out of narrow moves the place.
  const narrow = isNarrow(useWidthClass());
  const drawn = useRef(narrow);
  const place = useRef<{ element: Element; top: number } | "end" | undefined>(undefined);
  const box = useRef<HTMLElement | undefined>(undefined);

  useEffect(() => {
    let frame: number | undefined;
    box.current = content.current ? scroller(content.current) : undefined;
    const target = box.current ?? window;
    const read = () => {
      frame = undefined;
      // A layout drawn for the other width class: its positions are not the human's.
      const element = content.current;
      if (!element || isNarrow(widthClassNow()) !== drawn.current) {
        return;
      }
      place.current = atEnd(box.current) ? "end" : placeIn(element, box.current);
    };
    const later = () => {
      frame ??= requestAnimationFrame(read);
    };
    read();
    // Read again as the human scrolls, and as what is drawn moves without a scroll: the line
    // opening above the transcript, or a group of tool calls in it.
    target.addEventListener("scroll", later, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(later);
    observer?.observe(document.documentElement);
    if (content.current) {
      observer?.observe(content.current);
    }
    return () => {
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
      observer?.disconnect();
      target.removeEventListener("scroll", later);
    };
  }, [content]);

  useLayoutEffect(() => {
    if (drawn.current === narrow) {
      return;
    }
    drawn.current = narrow;
    const kept = place.current;
    // Put back before the frame is drawn, once every component drawn for the width has committed:
    // each media query's listener commits on its own, and the shell's navigation may follow this.
    const frame = requestAnimationFrame(() => {
      if (kept === "end") {
        moveBy(box.current, "end");
      } else if (kept?.element.isConnected) {
        moveBy(box.current, kept.element.getBoundingClientRect().top - kept.top);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [narrow]);
}
