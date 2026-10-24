// The column's width and fold, kept in the browser under `uraeda.nav`: 14% of the window, between
// 256 and 340 px, until the human drags its edge, then the width they chose, between 220 and 480 px.
// A width and a fold Astryx's old navigation kept, under `astryx-resizable:uraeda.nav`, are read
// once, the width clamped, and moved to the new key, so they survive the upgrade (plan, Review
// focus 4).
import { useCallback } from "react";
import {
  keptWidth,
  parseStored,
  type StoredWidth,
  storage,
  useFollowedWidth,
} from "../layout/followedWidth.ts";

/** Where the column's width and fold are kept. */
export const NAV_KEY = "uraeda.nav";

/** Where Astryx's navigation kept its width, as `{ size, isCollapsed }`. */
const OLD_KEY = "astryx-resizable:uraeda.nav";

/** The least and the most the column's edge drags to, in px. */
export const LIMITS = { max: 480, min: 220 };

/** The column's width before any drag: a share of the window, within its own limits, in px. */
const AUTO = { max: 340, min: 256, share: 0.14 };

/** What the browser keeps of the column: the width dragged to, and whether it is folded. */
export type StoredColumn = StoredWidth;

/**
 * Astryx's width and fold, `{ size, isCollapsed }` or a bare number, moved to the new key, the
 * width clamped.
 */
function readOld(store: Storage, raw: string): StoredColumn {
  const parsed: unknown = JSON.parse(raw);
  const kept =
    typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : { size: parsed };
  const width = keptWidth(LIMITS, kept.size);
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
      return parseStored(LIMITS, raw);
    }
    const old = store.getItem(OLD_KEY);
    return old === null ? {} : readOld(store, old);
  } catch {
    return {};
  }
}

/**
 * The column's width, its resize, and its fold: the width follows the window until the human drags
 * the edge, which keeps the width they chose; the fold is kept too.
 */
export function useColumnWidth() {
  const { keep, resizable, stored, width } = useFollowedWidth({
    auto: AUTO,
    key: NAV_KEY,
    limits: LIMITS,
    read: readColumn,
  });
  const toggle = useCallback(
    () => keep((column) => ({ ...column, folded: !column.folded })),
    [keep],
  );
  return { isFolded: stored.folded === true, resizable, toggle, width };
}
