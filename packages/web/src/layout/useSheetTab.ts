// The phone's sheet of a document's column, kept in the address's `?tab=`, as the column's open tab
// is on wide screens: a reload keeps it, Back closes it, and crossing to a wide screen opens its
// tab. The questions, spec, and plan pages' status lines open their sheets through it (R22).
import { useLayoutEffect } from "react";
import { askedTabNow, tabAddress, useAskedTab } from "./DocumentColumn.tsx";
import { openOverlayAt, overlayOf } from "./useBackCloses.ts";
import { CHANGE, redirect } from "../routeHistory.ts";

/** The phone's open sheet, by its tab's key, if any, and what opens one, or closes it with none. */
export type SheetState = readonly [string | undefined, (sheet?: string) => void];

/**
 * Opens the sheet `next`, `label`, in a history entry of its own with its tab in the address, or,
 * with none, closes the open one by taking its tab out of the address, which closes its overlay,
 * going back over its entry.
 */
function setSheet(sheets: Readonly<Record<string, string>>, next?: string) {
  const label = next === undefined ? undefined : sheets[next];
  if (next !== undefined && label !== undefined) {
    openOverlayAt(tabAddress(next), label);
  } else if (next === undefined && askedTabNow() !== null) {
    redirect(tabAddress(undefined));
  }
}

/**
 * The sheet the address opens among `sheets`, each key's overlay named by its label, while
 * `isActive`, on narrow screens; and what opens or closes one. An open sheet's tab is in its
 * overlay's history entry alone: the entry under it, where Back lands, has none, even after a
 * reload or a width change opened it. Its overlay's entry is pushed here, before the overlay would
 * push its own, keeping the page's state, so closing it goes back over it, and the leave guard
 * takes Back for the sheet's, not the page's.
 */
export function useSheetTab(
  sheets: Readonly<Record<string, string>>,
  isActive: boolean,
): SheetState {
  const asked = useAskedTab();
  const sheet = isActive && asked !== null && asked in sheets ? asked : undefined;
  const label = sheet === undefined ? undefined : sheets[sheet];
  useLayoutEffect(() => {
    if (sheet && label && overlayOf(window.history.state) !== label) {
      // The page's entry, as the leave guard keeps it, without the tab; the sheet's above it.
      window.history.replaceState(window.history.state, "", tabAddress(undefined));
      window.dispatchEvent(new Event(CHANGE));
      openOverlayAt(tabAddress(sheet), label);
    }
  }, [label, sheet]);
  return [sheet, (next) => setSheet(sheets, next)];
}
