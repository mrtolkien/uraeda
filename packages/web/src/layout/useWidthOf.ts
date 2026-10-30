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

/**
 * The theme's size `token` in px, as it resolves inside `element`: a probe as wide as it, as a
 * token made of others, as `--size-split-card`, is a `calc()` its text alone does not give.
 */
function widthOfToken(element: HTMLElement, token: string): number {
  const probe = document.createElement("div");
  probe.style.cssText = `position: absolute; visibility: hidden; width: var(${token});`;
  element.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

/**
 * Whether an element is at least as wide as the theme's size `token`, as `--size-split-card`. The
 * token is read again whenever the element's width changes, not only once on mount.
 */
export function useAtLeast(ref: RefObject<HTMLElement | null>, token: `--size-${string}`) {
  const width = useWidthOf(ref);
  const [least, setLeast] = useState(Number.POSITIVE_INFINITY);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element) {
      setLeast(widthOfToken(element, token) || Number.POSITIVE_INFINITY);
    }
  }, [ref, token, width]);
  return width >= least;
}
