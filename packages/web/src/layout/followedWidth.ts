// A column's width and fold, kept in the browser under a key of its own: a share of the window,
// within its own limits, until the human drags its edge, then the width they chose, within the
// drag's limits. A kept width outside those, from a hand edit or an older build, is clamped as it
// is read. The shell's navigation and the document's column keep theirs this way.
import { useResizable } from "@astryxdesign/core/Resizable";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** The least and the most a width may be, in px. */
type WidthLimits = { max: number; min: number };

/** A width before any drag: `share` of the window, within its own limits, in px. */
type AutoWidth = WidthLimits & { share: number };

/** What the browser keeps of a column: the width dragged to, and whether it is folded. */
export type StoredWidth = { folded?: boolean; width?: number };

/** A width within `limits`, in whole pixels. */
function clampTo(limits: WidthLimits, width: number): number {
  return Math.min(limits.max, Math.max(limits.min, Math.round(width)));
}

/** The width before any drag, for a window `windowWidth` px wide. */
export function autoWidthOf(auto: AutoWidth, windowWidth: number): number {
  return clampTo(auto, windowWidth * auto.share);
}

/** The browser's storage, or none when it is refused. */
export function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** A kept value as a column reads it: a width in px within `limits`, or nothing. */
export function keptWidth(limits: WidthLimits, value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? clampTo(limits, value)
    : undefined;
}

/** A column as kept under its key, `raw`, its width clamped: nothing when nothing is readable. */
export function parseStored(limits: WidthLimits, raw: string): StoredWidth {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) {
    return {};
  }
  const { folded, width } = parsed as Record<string, unknown>;
  const kept = keptWidth(limits, width);
  return { ...(folded === true ? { folded } : {}), ...(kept === undefined ? {} : { width: kept }) };
}

/** The column kept under `key`, its width clamped: nothing when nothing is readable. */
export function readStored(key: string, limits: WidthLimits): StoredWidth {
  try {
    const raw = storage()?.getItem(key);
    return raw == null ? {} : parseStored(limits, raw);
  } catch {
    return {};
  }
}

/** Keeps the column under `key`, when the browser's storage allows. */
function writeStored(key: string, column: StoredWidth) {
  try {
    storage()?.setItem(key, JSON.stringify(column));
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
 * A column's width, its resize, and its fold, kept under `key`: the width follows the window, by
 * `auto`, until the human drags the edge within `limits`, which keeps the width they chose; `keep`
 * changes and keeps the fold. `read` reads what the browser keeps, `key`'s value by default.
 */
export function useFollowedWidth({
  auto,
  key,
  limits,
  read = () => readStored(key, limits),
}: {
  auto: AutoWidth;
  key: string;
  limits: WidthLimits;
  read?: () => StoredWidth;
}) {
  const [stored, setStored] = useState(read);
  const following = autoWidthOf(auto, useWindowWidth());
  const width = stored.width ?? following;
  // Set while the column follows the window: a resize of its own, not the human's.
  const isFollowing = useRef(false);
  const keep = useCallback(
    (change: (column: StoredWidth) => StoredWidth) => {
      setStored((column) => {
        const next = change(column);
        writeStored(key, next);
        return next;
      });
    },
    [key],
  );
  const resizable = useResizable({
    defaultSize: width,
    maxSize: limits.max,
    minSize: limits.min,
    onSizeChange: (size: number) => {
      if (!isFollowing.current && size > 0) {
        keep((column) => ({ ...column, width: clampTo(limits, size) }));
      }
    },
  });
  const { resize, size } = resizable;
  useEffect(() => {
    // Not dragged yet: the edge starts its next drag from the width drawn.
    if (stored.width === undefined && size !== following) {
      isFollowing.current = true;
      resize(following);
      isFollowing.current = false;
    }
  }, [following, resize, size, stored.width]);
  return { keep, resizable, stored, width };
}
