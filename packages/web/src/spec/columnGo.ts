// How a panel of the spec's and the plan's column takes the reader somewhere on the page.
import { createContext, use } from "react";

/**
 * `go(run)` runs a jump at once in the column, and in a phone's sheet once the sheet is closed
 * and the page can scroll again.
 */
export const ColumnGo = createContext<(run: () => void) => void>((run) => run());

/** How the column's panels jump to the page: see `ColumnGo`. */
export function useColumnGo() {
  return use(ColumnGo);
}

/**
 * `commit(verdict)` commits a verdict from the Review panel: at once in the column; from a phone's
 * sheet once the sheet is closed and its history entry gone, so the page that follows the verdict
 * leaves no entry of it, and the sheet opens again on a refusal, to show it.
 */
export const ColumnVerdict = createContext<(verdict: () => Promise<boolean>) => Promise<boolean>>(
  (verdict) => verdict(),
);
