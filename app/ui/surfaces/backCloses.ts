// On a phone, a sheet is a visit of its own over its page (the phone guide: "each in the address,
// so Back closes it"): the browser's Back, or a swipe from the screen's edge, closes the sheet
// and stays on the page, where it left the page before. Closed any other way, by its Close, its
// Save, or a tap above it, its visit goes, so the next Back leaves the page as it would have, and a
// page its action opens takes its visit's place (the history's `closeOverlay` and `open`).
//
// The visits are the app's history's, which its entry binds here (`bindVisits`, `App.tsx`): the
// component library imports nothing of the app's store, as an extension's page is built from
// `app/ui/` alone, and there no history is bound and a sheet is no visit.
import { cleanup, effect, untracked } from "nsh";
import { onChange } from "./presence";

/** The history's visits, as a sheet needs them. */
export type Visits = {
  /** Opens a visit of the page shown, named `label`, over it. */
  open: (label: string) => void;
  /** Closes the visit `label`, if it is the one shown: the page under it shows at once. */
  close: (label: string) => void;
  /** The name of the visit shown, if it is one `open` made: a signal. */
  shown: () => string | undefined;
};

let visits: Visits | undefined;

/** Binds the app's history (`overlayVisits`): its entry, `App.tsx`, does. */
export function bindVisits(bound: Visits) {
  visits = bound;
}

let made = 0;
/** The visits of the floats open in one, by their number: one opened from another comes after it. */
const alive = new Set<number>();
const numberOf = (label: string | undefined) =>
  label?.startsWith("float-") === true ? Number(label.slice(6)) : undefined;

/**
 * Makes each opening of `open`, while `wanted` says so as it opens, a visit of the history, and
 * calls `close` when Back leaves it.
 */
export function backCloses(open: () => boolean, wanted: () => boolean, close: () => void) {
  // The number of the visit this float opened, while it is open in it.
  let mine: number | undefined;
  const opened = () => {
    if (visits === undefined || !untracked(wanted)) return;
    made += 1;
    mine = made;
    alive.add(mine);
    visits.open(`float-${mine}`);
  };
  // Closed by its owner: its visit goes, unless another visit is shown already, as a page its
  // Save opened.
  const closed = () => {
    const was = mine;
    mine = undefined;
    if (was === undefined) return;
    alive.delete(was);
    visits?.close(`float-${was}`);
  };
  if (untracked(open)) opened();
  onChange(open, (now) => (now ? opened() : closed()));
  // Left by Back: the visit shown is neither its own nor one a float opened over it.
  effect(() => {
    const shown = numberOf(visits?.shown());
    if (mine === undefined || shown === mine) return;
    if (shown !== undefined && shown > mine && alive.has(shown)) return;
    alive.delete(mine);
    mine = undefined;
    untracked(close);
  });
  cleanup(closed);
}
