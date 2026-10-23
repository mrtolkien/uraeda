// The column's width and fold, kept in the browser under `uraeda.nav`: 14% of the window, between
// 256 and 340 px, until the human drags its edge, then the width they chose, between 220 and 480 px.
// A width and a fold Astryx's old navigation kept, under `astryx-resizable:uraeda.nav`, are read
// once, the width clamped, and moved to the new key, so they survive the upgrade (plan, Review
// focus 4).
import { useResizable } from "@astryxdesign/core/Resizable";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Where the column's width and fold are kept. */
export const NAV_KEY = "uraeda.nav";

/** Where Astryx's navigation kept its width, as `{ size, isCollapsed }`. */
const OLD_KEY = "astryx-resizable:uraeda.nav";

/** The least and the most the column's edge drags to, in px. */
export const LIMITS = { max: 480, min: 220 };

/** The column's width before any drag: a share of the window, within its own limits, in px. */
const AUTO = { max: 340, min: 256, share: 0.14 };

/** What the browser keeps of the column: the width dragged to, and whether it is folded. */
export type StoredColumn = { folded?: boolean; width?: number };

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

/** A kept value as the column reads it: a width in px, or nothing. */
function widthOf(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? clampWidth(value)
    : undefined;
}

/** The column as kept under `uraeda.nav`, or nothing readable. */
function readNew(raw: string): StoredColumn {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) {
    return {};
  }
  const { folded, width } = parsed as Record<string, unknown>;
  const kept = widthOf(width);
  return { ...(folded === true ? { folded } : {}), ...(kept === undefined ? {} : { width: kept }) };
}

/**
 * Astryx's width and fold, `{ size, isCollapsed }` or a bare number, moved to the new key, the width
 * clamped.
 */
function readOld(store: Storage, raw: string): StoredColumn {
  const parsed: unknown = JSON.parse(raw);
  const kept =
    typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : { size: parsed };
  const width = widthOf(kept.size);
  const column: StoredColumn = {
    ...(kept.isCollapsed === true ? { folded: true } : {}),
    ...(width === undefined ? {} : { width }),
  };
  store.removeItem(OLD_KEY);
  if (column.folded !== undefined || column.width !== undefined) {
    store.setItem(NAV_KEY, JSON.stringify(column));
  }
  return column;
}

/** The column as the browser keeps it: nothing when it keeps nothing, or nothing readable. */
export function readColumn(): StoredColumn {
  const store = storage();
  if (!store) {
    return {};
  }
  try {
    const raw = store.getItem(NAV_KEY);
    if (raw !== null) {
      return readNew(raw);
    }
    const old = store.getItem(OLD_KEY);
    return old === null ? {} : readOld(store, old);
  } catch {
    return {};
  }
}

/** Keeps the column in the browser, when its storage allows. */
function writeColumn(column: StoredColumn) {
  try {
    storage()?.setItem(NAV_KEY, JSON.stringify(column));
  } catch {
    // Refused: the column keeps its state for this page only.
  }
}

/** Calls `onChange` as the window resizes. */
function subscribeResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

/** The window's width, followed as it resizes. */
function useWindowWidth(): number {
  return useSyncExternalStore(subscribeResize, () => window.innerWidth);
}

/**
 * The column's width, its resize, and its fold: the width follows the window until the human drags
 * the edge, which keeps the width they chose; the fold is kept too.
 */
export function useColumnWidth() {
  const [stored, setStored] = useState(readColumn);
  const auto = autoWidth(useWindowWidth());
  const width = stored.width ?? auto;
  // Set while the column follows the window: a resize of its own, not the human's.
  const following = useRef(false);
  const keep = useCallback((change: (column: StoredColumn) => StoredColumn) => {
    setStored((column) => {
      const next = change(column);
      writeColumn(next);
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
  const toggle = useCallback(
    () => keep((column) => ({ ...column, folded: !column.folded })),
    [keep],
  );
  return { isFolded: stored.folded === true, resizable, toggle, width };
}
