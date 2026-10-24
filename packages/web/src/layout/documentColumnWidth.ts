// The document's column's one width and fold, kept in the browser under `uraeda.documentColumn`
// for every document page: a third of the window, between 400 and 600 px, until the human drags its
// edge, then the width they chose, between 400 and 720 px. A kept width outside those, from a hand
// edit or an older build, is clamped as it is read (plan, Review focus 6). The open tab never
// changes it.
import { useCallback } from "react";
import { autoWidthOf, readStored, type StoredWidth, useFollowedWidth } from "./followedWidth.ts";

/** Where the column's width and fold are kept. */
export const COLUMN_KEY = "uraeda.documentColumn";

/** The least and the most the column's edge drags to, in px. */
export const LIMITS = { max: 720, min: 400 };

/** The column's width before any drag: a third of the window, within its own limits, in px. */
const AUTO = { max: 600, min: 400, share: 1 / 3 };

/** What the browser keeps of the column: the width dragged to, and whether it is folded. */
type StoredDocumentColumn = StoredWidth;

/** The column's width before any drag, for a window `windowWidth` px wide. */
export const autoWidth = (windowWidth: number) => autoWidthOf(AUTO, windowWidth);

/** The column as the browser keeps it, its width clamped: nothing when nothing is readable. */
export const readDocumentColumn = (): StoredDocumentColumn => readStored(COLUMN_KEY, LIMITS);

/**
 * The column's width, its resize, and its fold: the width follows the window until the human drags
 * the edge, which keeps the width they chose, for every document; the fold is kept too.
 */
export function useDocumentColumnWidth() {
  const { keep, resizable, stored } = useFollowedWidth({
    auto: AUTO,
    key: COLUMN_KEY,
    limits: LIMITS,
  });
  const setShown = useCallback(
    (shown: boolean) => keep((column) => ({ ...column, folded: !shown })),
    [keep],
  );
  return { isShown: stored.folded !== true, resizable, setShown };
}
