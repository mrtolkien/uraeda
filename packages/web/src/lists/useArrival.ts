// The row a page opens on, as a note just moved to the priorities: named by the history entry the
// page opened on, at once, or once the move that placed it answers, the page already open.
import { useEffect, useState, useSyncExternalStore } from "react";
import { namedCount, subscribeArrival } from "../routeHistory.ts";
import { currentEntry, subscribeLocation } from "../routes.tsx";

/**
 * The page opens on the row its arrival names, with the keyboard's focus on it, once: `arrival` is
 * that row, if any, and `isArriving` holds for the page's first render. A row named later, in the
 * same history entry, as by a move that answers once the page is open, is selected then: `follow`
 * is it, or `written`, the row a write of the page placed, whichever came last.
 */
export function useArrival(written: { key: string } | undefined) {
  const [{ arrival, id }] = useState(() => ({
    arrival: currentEntry().select,
    id: currentEntry().id,
  }));
  // That row in the middle of the screen, once drawn: the page just opened, nothing moves.
  useEffect(() => {
    if (arrival === undefined) {
      return undefined;
    }
    const frame = requestAnimationFrame(() =>
      document
        .querySelector(`[data-row-key="${CSS.escape(arrival)}"]`)
        ?.scrollIntoView({ block: "center" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [arrival]);
  // The first committed render's, and the frame after it: the list's focus is put on the row then,
  // and a later render of the page moves it no more.
  const [isArriving, setArriving] = useState(true);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setArriving(false));
    return () => cancelAnimationFrame(frame);
  }, []);
  return { arrival, follow: useLatest(written, useLateArrival(id, arrival)), isArriving };
}

/** The row the entry `id` names after the page opened on `arrival`, if any. */
function useLateArrival(id: string | undefined, arrival: string | undefined) {
  return useSyncExternalStore(subscribeArrival, () => {
    const now = currentEntry();
    return now.id === id && now.select !== arrival ? now.select : undefined;
  });
}

type Seen = { late?: string; latest?: { key: string }; written?: { key: string } };

/**
 * The row to select of `written` and `late`, whichever changed last: kept from the render before,
 * as React's state from a previous render is, with no effect.
 */
function useLatest(written: { key: string } | undefined, late: string | undefined) {
  const [seen, setSeen] = useState<Seen>({ late, written });
  if (seen.written !== written || seen.late !== late) {
    const latest =
      late !== undefined && seen.late !== late ? { key: late } : (written ?? seen.latest);
    setSeen({ late, latest, written });
    return latest;
  }
  return seen.latest;
}

/** The row last named by `useNamedRow`, with what named it, so a snapshot stays the same object. */
let named: { count: number; id?: string; key?: string; row?: { key: string } } | undefined;

/** The row the current history entry names, a new object for each naming. */
function namedRow() {
  const { id, select } = currentEntry();
  const count = namedCount();
  if (named === undefined || named.id !== id || named.key !== select || named.count !== count) {
    named = { count, id, key: select, row: select === undefined ? undefined : { key: select } };
  }
  return named.row;
}

function subscribeNamed(onChange: () => void) {
  const arrivals = subscribeArrival(onChange);
  const location = subscribeLocation(onChange);
  return () => {
    arrivals();
    location();
  };
}

/**
 * The row the history entry names to select, for a list that selects a new object each time, as
 * the inbox's: as the page opens on the entry, or once `selectOnArrival` names one, the same row
 * again too, as an undo on the page already open does.
 */
export function useNamedRow(): { key: string } | undefined {
  return useSyncExternalStore(subscribeNamed, namedRow);
}
