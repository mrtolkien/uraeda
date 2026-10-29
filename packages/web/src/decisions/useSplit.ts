// Whether the decisions page has room for its list and its reader side by side: the list showing
// about 40 characters a line at least, in the UI's font, and the reader 60, in the reading one.
// Narrower, the list is the page, and what is open is a page of its own, as on the phone.
import { type RefObject, useLayoutEffect, useState } from "react";
import { isNarrow, widthClassNow } from "../layout/useWidthClass.ts";

/**
 * Whether `box`, the page's room, is at least as wide as `least`, an unseen element sized to the
 * two columns' least widths, as either changes: never on the phone.
 */
export function useSplit(
  box: RefObject<HTMLElement | null>,
  least: RefObject<HTMLElement | null>,
): boolean {
  const [isSplit, setSplit] = useState(() => !isNarrow(widthClassNow()));
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const needed = least.current?.getBoundingClientRect().width ?? 0;
      setSplit(!isNarrow(widthClassNow()) && element.getBoundingClientRect().width >= needed);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [box, least]);
  return isSplit;
}
