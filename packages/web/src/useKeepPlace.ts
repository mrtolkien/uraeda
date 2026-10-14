// The window's reading place, kept as the width class changes: for a moment, the browser lays the
// layout drawn for the old width out at the new one, a column beside the content squeezing it, which
// moves the scroll position or clamps it at the end. The place is put back once the new layout is
// drawn.
import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { useWidthClass, widthClassNow } from "./layout/useWidthClass.ts";
import { AT_END } from "./Transcript.tsx";

/** How far down the window the place is read: below the top bar, above the sticky composer. */
const READ_AT = 1 / 3;

/** Whether the window shows the end of the page, by following's measure. */
function atEnd() {
  const page = document.documentElement;
  return page.scrollHeight - window.scrollY - window.innerHeight <= AT_END;
}

/**
 * The first innermost element of `parent` that reaches `line` or lies below it: the text read
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
    // A child whose own padding reaches the line, its content above it: the place is further on.
    const inner = firstFrom(child, line);
    if (inner) {
      return inner;
    }
  }
  return undefined;
}

/** The text of `content` read a third down the window, and how far from the window's top it is. */
function placeIn(content: HTMLElement): { element: Element; top: number } | undefined {
  const element = firstFrom(content, window.innerHeight * READ_AT);
  return element && { element, top: element.getBoundingClientRect().top };
}

/**
 * Keeps the place the human reads in `content` as the window crosses the width breakpoint: the
 * element a third down the window stays there, or the end stays in view.
 */
export function useKeepPlace(content: RefObject<HTMLElement | null>) {
  const width = useWidthClass();
  const drawn = useRef(width);
  const place = useRef<{ element: Element; top: number } | "end" | undefined>(undefined);

  useEffect(() => {
    let frame: number | undefined;
    const read = () => {
      frame = undefined;
      // A layout drawn for the other width class: its positions are not the human's.
      const element = content.current;
      if (!element || widthClassNow() !== drawn.current) {
        return;
      }
      place.current = atEnd() ? "end" : placeIn(element);
    };
    const onScroll = () => {
      frame ??= requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
      window.removeEventListener("scroll", onScroll);
    };
  }, [content]);

  useLayoutEffect(() => {
    if (drawn.current === width) {
      return;
    }
    drawn.current = width;
    const kept = place.current;
    if (kept === "end") {
      window.scrollTo(0, document.documentElement.scrollHeight);
    } else if (kept?.element.isConnected) {
      window.scrollBy(0, kept.element.getBoundingClientRect().top - kept.top);
    }
  }, [width]);
}
