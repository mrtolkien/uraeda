// On a phone, a sheet is a visit of its own over its page (the phone guide: "each in the address,
// so Back closes it"): the browser's Back, or a swipe from the screen's edge, closes the sheet
// and stays on the page, where it left the page before. Closed any other way, by its Close, its
// Save, or a tap above it, its visit goes, so the next Back leaves the page as it would have.
import { cleanup, effect, untracked } from "nsh";
import { back, entry, openOverlay } from "../../store/history";
import { onChange } from "./presence";

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
    if (!untracked(wanted)) return;
    made += 1;
    mine = made;
    alive.add(mine);
    openOverlay(`float-${mine}`);
  };
  // Closed by its owner: its visit goes, unless another visit is shown already, as a page its
  // Save opened.
  const closed = () => {
    const was = mine;
    mine = undefined;
    if (was === undefined) return;
    alive.delete(was);
    if (numberOf(entry().kept.overlay) === was) back();
  };
  if (untracked(open)) opened();
  onChange(open, (now) => (now ? opened() : closed()));
  // Left by Back: the visit shown is neither its own nor one a float opened over it.
  effect(() => {
    const shown = numberOf(entry().kept.overlay);
    if (mine === undefined || shown === mine) return;
    if (shown !== undefined && shown > mine && alive.has(shown)) return;
    alive.delete(mine);
    mine = undefined;
    untracked(close);
  });
  cleanup(closed);
}
