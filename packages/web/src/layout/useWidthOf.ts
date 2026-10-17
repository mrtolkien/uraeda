import { type RefObject, useLayoutEffect, useState } from "react";

/**
 * The width of an element in px, updated as it changes, 0 until it is drawn: what lays out a part
 * by the room it has, rather than by the window's width class. The ref's element is the same for
 * the component's life.
 */
export function useWidthOf(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const measure = () => setWidth(element.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
