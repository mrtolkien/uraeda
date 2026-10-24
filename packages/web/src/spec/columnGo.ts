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
