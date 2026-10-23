// Whether the shell's column is drawn folded, as its 52 px rail of icons, and the fold the `[` key
// toggles: the rows read it to draw an icon alone, or their whole line. Outside the column, on the
// sessions' page, nothing is folded.
import { createContext, use } from "react";

export type ColumnFold = {
  /** Whether the column is drawn as its rail: folded on a wide screen, or closed on a semi-wide one. */
  isFolded: boolean;
  /** Folds the wide column to its rail, or unfolds it. */
  toggle: () => void;
};

export const ColumnFoldContext = createContext<ColumnFold>({ isFolded: false, toggle: () => {} });

/** The column's fold, as the rows inside it draw by. */
export function useColumnFold(): ColumnFold {
  return use(ColumnFoldContext);
}
