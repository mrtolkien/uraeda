// The phone's sheet of the spec's and the plan's column, kept in the address's `?tab=`, as the
// column's open tab is on wide screens: a reload keeps it, and crossing to a wide screen opens its
// tab.
import { useLayoutEffect } from "react";
import { overlayOf } from "../layout/useBackCloses.ts";
import { redirect } from "../routeHistory.ts";
import { useSearch } from "../routes.tsx";

/** The phone's sheets, by their tab's key, each named by its overlay's label. */
export const SHEETS = { contents: "Contents", review: "Review" } as const;

/** The phone's sheet open over the page, if any. */
export type Sheet = keyof typeof SHEETS;

/** The address with `?tab=` set to `sheet`, or without it. */
function addressWith(sheet: Sheet | undefined) {
  const search = new URLSearchParams(window.location.search);
  if (sheet) {
    search.set("tab", sheet);
  } else {
    search.delete("tab");
  }
  const query = search.toString();
  return `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
}

/**
 * The sheet the address opens, Review only while `hasReview`, and what opens or closes one. An
 * open sheet's tab is in its overlay's history entry alone: the entry under it, where Back lands,
 * has none, even after a reload or a width change opened it. Its overlay's entry is pushed here,
 * before the overlay would push its own, so closing it, by taking the tab out of the address, goes
 * back over it.
 */
export function useSheetTab(hasReview: boolean): [Sheet | undefined, (sheet?: Sheet) => void] {
  const asked = new URLSearchParams(useSearch()).get("tab");
  const sheet = asked === "contents" || (asked === "review" && hasReview) ? asked : undefined;
  useLayoutEffect(() => {
    if (sheet && overlayOf(window.history.state) !== SHEETS[sheet]) {
      window.history.replaceState(window.history.state, "", addressWith(undefined));
      window.history.pushState({ overlay: SHEETS[sheet] }, "", addressWith(sheet));
    }
  }, [sheet]);
  const set = (next?: Sheet) => {
    if (next || new URLSearchParams(window.location.search).has("tab")) {
      redirect(addressWith(next));
    }
  };
  return [sheet, set];
}
