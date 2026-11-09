// An agent's message's tables, on semi-wide and wide screens: the message grows to the right into
// the empty room beside the session's column, as far as its widest table needs, its border around
// it, while its prose keeps the measure. A table wider than that room starts at the text's edge,
// and its scroll region reaches into the room on the left too, so scrolling it moves its left side
// past the message's, out of the column, as its right side is.
import { type RefObject, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GAP, observeUpTo, px, room } from "../embedLayout.ts";
import { PageColumn } from "../layout/Page.tsx";

/** Astryx's markdown table's block, which the theme's `markdown-table` rule sizes by the vars. */
const TABLES = ".astryx-markdown-table";

/** The vars the theme's `markdown-table` rule reads. */
const VARS = ["--message-table-width", "--message-table-most", "--message-table-start"];

/**
 * How many px the message grows past its right side, for its widest table, measured from `box`, its
 * markdown's element, the message's content box: none on the phone, outside a page, or without a
 * table. It sets the vars its tables read on `box`: `--message-table-width`, their width, as wide
 * as their text at most; `--message-table-most`, the widest they grow, to the room's right; and
 * `--message-table-start`, how far their scroll region reaches left, to the room's left. `text` is
 * the message's: each change measures its tables again.
 */
export function useMessageTables(
  box: RefObject<HTMLElement | null>,
  wide: boolean,
  text: string,
): number {
  const column = useContext(PageColumn);
  const [grow, setGrow] = useState(0);
  // The growth drawn, which the message's padding at its end holds: read as the observer measures,
  // whose call may come before the effect of a new growth runs.
  const applied = useRef(0);
  useLayoutEffect(() => {
    applied.current = grow;
  }, [grow]);
  // Each change of the text, as the tables it draws stream in; and only for a message holding a
  // table, every box from the message up to the page's container, as the window or a column
  // resizes.
  useEffect(() => {
    const page = column?.current;
    const own = box.current;
    const outer = page?.parentElement;
    const bubble = own?.parentElement;
    if (!own) {
      return;
    }
    const measure = () => {
      const tables = [...own.querySelectorAll<HTMLElement>(TABLES)];
      if (!wide || !page || !outer || !bubble || !page.contains(own) || tables.length === 0) {
        for (const name of VARS) {
          own.style.removeProperty(name);
        }
        setGrow(0);
        return false;
      }
      // Its content box, which the growth leaves alone.
      const natural = own.getBoundingClientRect();
      // The message's padding and border at its end, which stay inside the room.
      const style = getComputedStyle(bubble);
      const frame = px(style.paddingRight) + px(style.borderRightWidth) - applied.current;
      const inset = px(getComputedStyle(page).paddingLeft);
      const free = room(natural, bubble.parentElement ?? bubble, page, outer, inset);
      // A side with less room than the gap is not reached into, as an embed's (`useOutgrow`).
      const end = free.end - frame < GAP ? 0 : free.end - frame;
      const start = free.start < GAP ? 0 : free.start;
      own.style.setProperty("--message-table-width", "max-content");
      own.style.setProperty("--message-table-most", `${natural.width + end}px`);
      own.style.setProperty("--message-table-start", `${start}px`);
      const widest = Math.max(...tables.map((table) => table.getBoundingClientRect().width));
      const next = Math.min(end, Math.max(0, widest - natural.width));
      setGrow((known) => (Math.abs(known - next) < 0.5 ? known : next));
      return true;
    };
    if (!measure() || !outer || !bubble?.parentElement) {
      return;
    }
    return observeUpTo(bubble.parentElement, outer, () => void measure());
  }, [box, column, text, wide]);
  return grow;
}
