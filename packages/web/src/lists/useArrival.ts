// The row a page opens on, as a note just moved to the priorities: named by the history entry the
// page opened on, at once, or once the move that placed it answers, the page already open.
import { useEffect, useState, useSyncExternalStore } from "react";
import { subscribeArrival } from "../routeHistory.ts";
import { currentEntry } from "../routes.tsx";

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
