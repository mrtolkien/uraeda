import { useEffect, useState } from "react";

/**
 * How far the page scrolls, in pixels, before a bar over it moves: a finger's tremor is no scroll.
 * The phone's bottom bar's, and the floating row bar's (`RowBar`).
 */
export const SCROLLED_PX = 8;

/**
 * Whether the phone's bar is out of the way: the page scrolled down since it last went up, past
 * `SCROLLED_PX`. It is back as the page scrolls up, at the page's top, and at its end, where
 * nothing more is under it. A jump of more than a screen at once, as a reload's restored place or
 * a jump to a question, is no scroll of the human's: it moves the bar neither way.
 */
export function useHidesOnScroll() {
  const [isHidden, setHidden] = useState(false);
  useEffect(() => {
    const page = document.scrollingElement ?? document.documentElement;
    // Where the page turned last: the scroll counts from there.
    let turn = page.scrollTop;
    let last = turn;
    const onScroll = () => {
      const top = page.scrollTop;
      if (Math.abs(top - last) > page.clientHeight) {
        turn = top;
        last = top;
        return;
      }
      if ((top - last) * (last - turn) < 0) {
        turn = last;
      }
      last = top;
      const atEnd = top + page.clientHeight >= page.scrollHeight - 1;
      if (top <= 0 || atEnd || turn - top > SCROLLED_PX) {
        setHidden(false);
      } else if (top - turn > SCROLLED_PX) {
        setHidden(true);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return isHidden;
}
