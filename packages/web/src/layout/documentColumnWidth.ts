// The document's column's one width and fold, kept in the browser under `uraeda.documentColumn`
// for every document page: a third of the window, between 400 and 600 px, until the human drags its
// edge, then the width they chose, between 400 and 720 px. A kept width outside those, from a hand
// edit or an older build, is clamped as it is read (plan, Review focus 6). The open tab never
// changes it. A session's column shares that width and fold, but is narrower at semi-wide, so the
// chat keeps the weight (approval comment C2 of the session's spec, its ruling R9).
import { useCallback, useEffect } from "react";
import { autoWidthOf, readStored, type StoredWidth, useFollowedWidth } from "./followedWidth.ts";
import { useWidthClass } from "./useWidthClass.ts";

/** Where the column's width and fold are kept. */
export const COLUMN_KEY = "uraeda.documentColumn";

/** The least and the most the column's edge drags to, in px. */
export const LIMITS = { max: 720, min: 400 };

/** The column's width before any drag: a third of the window, within its own limits, in px. */
const AUTO = { max: 600, min: 400, share: 1 / 3 };

/** The least and the most a session's column's edge drags to, in px. */
const SESSION_LIMITS = { max: 720, min: 300 };

/** A session's column's width at semi-wide before any drag: 30% of the window, in px. */
const SESSION_AUTO = { max: 360, min: 300, share: 0.3 };

/** What the browser keeps of the column: the width dragged to, and whether it is folded. */
type StoredDocumentColumn = StoredWidth;

/** The column's width before any drag, for a window `windowWidth` px wide. */
export const autoWidth = (windowWidth: number) => autoWidthOf(AUTO, windowWidth);

/** A session's column's width at semi-wide before any drag, for a window `windowWidth` px wide. */
export const sessionAutoWidth = (windowWidth: number) => autoWidthOf(SESSION_AUTO, windowWidth);

/** The column as the browser keeps it, its width clamped: nothing when nothing is readable. */
export const readDocumentColumn = (): StoredDocumentColumn => readStored(COLUMN_KEY, LIMITS);

/** The drawn columns' ways to unfold, which `showDocumentColumn` calls. */
const unfolds = new Set<() => void>();

/**
 * Unfolds the document's column, from outside it, as asking the agent does to open Session: each
 * column drawn shows, and keeps the fold. Without one drawn, nothing changes.
 */
export function showDocumentColumn() {
  for (const unfold of unfolds) {
    unfold();
  }
}

/**
 * The column's width, its resize, and its fold: the width follows the window until the human drags
 * the edge, which keeps the width they chose, for every document; the fold is kept too.
 */
export function useDocumentColumnWidth() {
  return useKeptColumn(AUTO, LIMITS);
}

/**
 * A session's column's width, its resize, and its fold, the documents' column's own, under its key:
 * at wide, the documents' width; at semi-wide, `sessionAutoWidth`; dragged, between 300 and 720 px.
 * A kept width is clamped to those as it is read.
 */
export function useSessionColumnWidth() {
  return useKeptColumn(useWidthClass() === "semi" ? SESSION_AUTO : AUTO, SESSION_LIMITS);
}

/**
 * A column kept under `COLUMN_KEY`, by `auto` until dragged within `limits`, which
 * `showDocumentColumn` unfolds.
 */
function useKeptColumn(auto: typeof AUTO, limits: typeof LIMITS) {
  const { keep, resizable, stored } = useFollowedWidth({ auto, key: COLUMN_KEY, limits });
  const setShown = useCallback(
    (shown: boolean) => keep((column) => ({ ...column, folded: !shown })),
    [keep],
  );
  useEffect(() => {
    const unfold = () => setShown(true);
    unfolds.add(unfold);
    return () => {
      unfolds.delete(unfold);
    };
  }, [setShown]);
  return { isShown: stored.folded !== true, resizable, setShown };
}
