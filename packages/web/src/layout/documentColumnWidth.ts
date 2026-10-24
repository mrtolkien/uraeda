// The document's column's one width and fold, kept in the browser under `uraeda.documentColumn`
// for every document page: a third of the window, between 400 and 600 px, until the human drags its
// edge, then the width they chose, between 400 and 720 px. A kept width outside those, from a hand
// edit or an older build, is clamped as it is read (plan, Review focus 6). The open tab never
// changes it.
import { useResizable } from "@astryxdesign/core/Resizable";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWindowWidth } from "../shell/columnWidth.ts";

/** Where the column's width and fold are kept. */
export const COLUMN_KEY = "uraeda.documentColumn";

/** The least and the most the column's edge drags to, in px. */
export const LIMITS = { max: 720, min: 400 };

/** The column's width before any drag: a third of the window, within its own limits, in px. */
const AUTO = { max: 600, min: 400, share: 1 / 3 };

/** What the browser keeps of the column: the width dragged to, and whether it is folded. */
export type StoredDocumentColumn = { folded?: boolean; width?: number };

/** A width within the drag's limits, in whole pixels. */
export function clampWidth(width: number): number {
  return Math.min(LIMITS.max, Math.max(LIMITS.min, Math.round(width)));
}

/** The column's width before any drag, for a window `windowWidth` px wide. */
export function autoWidth(windowWidth: number): number {
  return Math.min(AUTO.max, Math.max(AUTO.min, Math.round(windowWidth * AUTO.share)));
}

/** The browser's storage, or none when it is refused. */
function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** The column as the browser keeps it, its width clamped: nothing when nothing is readable. */
export function readDocumentColumn(): StoredDocumentColumn {
  try {
    const raw = storage()?.getItem(COLUMN_KEY);
    const parsed: unknown = raw == null ? null : JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    const { folded, width } = parsed as Record<string, unknown>;
    const kept =
      typeof width === "number" && Number.isFinite(width) && width > 0
        ? clampWidth(width)
        : undefined;
    return {
      ...(folded === true ? { folded } : {}),
      ...(kept === undefined ? {} : { width: kept }),
    };
  } catch {
    return {};
  }
}

/** Keeps the column in the browser, when its storage allows. */
function writeDocumentColumn(column: StoredDocumentColumn) {
  try {
    storage()?.setItem(COLUMN_KEY, JSON.stringify(column));
  } catch {
    // Refused: the column keeps its state for this page only.
  }
}

/**
 * The column's width, its resize, and its fold: the width follows the window until the human drags
 * the edge, which keeps the width they chose, for every document; the fold is kept too.
 */
export function useDocumentColumnWidth() {
  const [stored, setStored] = useState(readDocumentColumn);
  const auto = autoWidth(useWindowWidth());
  const width = stored.width ?? auto;
  // Set while the column follows the window: a resize of its own, not the human's.
  const following = useRef(false);
  const keep = useCallback((change: (column: StoredDocumentColumn) => StoredDocumentColumn) => {
    setStored((column) => {
      const next = change(column);
      writeDocumentColumn(next);
      return next;
    });
  }, []);
  const resizable = useResizable({
    defaultSize: width,
    maxSize: LIMITS.max,
    minSize: LIMITS.min,
    onSizeChange: (size: number) => {
      if (!following.current && size > 0) {
        keep((column) => ({ ...column, width: clampWidth(size) }));
      }
    },
  });
  const { resize, size } = resizable;
  useEffect(() => {
    // Not dragged yet: the edge starts its next drag from the width drawn.
    if (stored.width === undefined && size !== auto) {
      following.current = true;
      resize(auto);
      following.current = false;
    }
  }, [auto, resize, size, stored.width]);
  const setShown = useCallback(
    (shown: boolean) => keep((column) => ({ ...column, folded: !shown })),
    [keep],
  );
  return { isShown: stored.folded !== true, resizable, setShown };
}
