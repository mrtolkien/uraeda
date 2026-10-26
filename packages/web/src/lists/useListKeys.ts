// The keys of a list whose rows open a pane, as the UI behaviour decision asks: ↑ ↓ or j k move the
// focus to the previous or next row, Home and End to the first and last, across sections; Enter
// edits the selected item; Escape closes the pane. A list in columns keeps them inside the column,
// and adds h l and ← → to the same row of the neighbouring column, or its last row when that is
// shorter. They act only when the focus is on a row or on the page itself: never in a text field, a
// row's handle, an open Selector, a menu, or a dialog.
import { useListFocus } from "@astryxdesign/core/hooks";
import { useCallback, useEffect } from "react";
import { useStatusHints } from "../statusHints.tsx";
import { type Columns, destination, type Move } from "./destination.ts";

export type { Columns };

/** The rows' links, in the list's order: each row marks its item with `data-row`. */
const ROW = "[data-row] a[href]";

/**
 * What shows over the page and owns the keys while open: a dialog, or a popover, a menu, or a
 * Selector, whose trigger says it is expanded. Closed, they may stay in the page, hidden; the
 * toasts' region is a popover of its own, always open, which owns no key.
 */
const DIALOGS = 'dialog[open], [role="dialog"], [role="alertdialog"]';
const EXPANDED = '[aria-expanded="true"][aria-haspopup]';

/** Whether an element shows: closed, a layer may stay in the page, hidden. */
function shown(element: Element) {
  return element.getClientRects().length > 0;
}

/** Whether a layer is open: its own keys are not the list's. */
export function isLayerOpen() {
  if (document.querySelector(EXPANDED) !== null) {
    return true;
  }
  if (Array.from(document.querySelectorAll(DIALOGS)).some(shown)) {
    return true;
  }
  try {
    return document.querySelector(':popover-open:not([popover="manual"])') !== null;
  } catch {
    // A browser without the popover API opens no popover.
    return false;
  }
}

/**
 * The keys, as the status line names them while the list shows: `h l` only with `columns`, then
 * Escape's, `escape`. With `isOff`, a layer the list owns holds the keys, and only Escape's shows.
 */
function hints({
  columns,
  escape,
  isOff,
}: {
  columns: boolean;
  escape: string | null;
  isOff: boolean;
}) {
  const escapeHint = escape === null ? [] : [{ keys: "esc", label: escape }];
  if (isOff) {
    return escapeHint;
  }
  return [
    { keys: "j k", label: "move" },
    ...(columns ? [{ keys: "h l", label: "column" }] : []),
    { keys: "⏎", label: "open" },
    ...escapeHint,
  ];
}

/** The moves of the keys, by key. */
const MOVES: Record<string, Move> = {
  ArrowDown: "next",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "previous",
  End: "last",
  h: "left",
  Home: "first",
  j: "next",
  k: "previous",
  l: "right",
};

/**
 * The keyboard of a list: `selected` is the index of the row open in the pane, -1 for none.
 * `onSelect(index)` is called once the focus moved to a row; `onEdit()` on Enter on the selected
 * row, returning whether it edited, else the row's link opens it; `onClose()` on Escape, returning
 * whether it closed something. `escapeLabel` is what the status line says Escape does, "close" by
 * default, or `null` where it does nothing. `columns` says the list is in columns, and which rows
 * each holds (see `Columns`): its keys move inside a column and between them. `isOff` says a layer
 * the list owns, like its overlay, holds the keys: the status line then names only Escape's. Returns the ref of the list's element, and what focuses
 * the selected row.
 */
export function useListKeys({
  columns,
  escapeLabel = "close",
  isOff = false,
  onClose,
  onEdit,
  onSelect,
  selected,
}: {
  columns?: Columns;
  escapeLabel?: string | null;
  isOff?: boolean;
  onClose: () => boolean;
  onEdit: () => boolean;
  onSelect: (index: number) => void;
  selected: number;
}) {
  const { focusItem, getItems, listRef } = useListFocus<HTMLDivElement>({ itemSelector: ROW });
  useStatusHints(hints({ columns: columns !== undefined, escape: escapeLabel, isOff }));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.shiftKey || event.isComposing) {
        return;
      }
      const list = listRef.current;
      const target = event.target;
      const items: Array<EventTarget> = getItems();
      const row = target === null ? -1 : items.indexOf(target);
      const onPage = target === document.body || target === document.documentElement;
      if (!list || !(row !== -1 || onPage) || isLayerOpen()) {
        return;
      }
      const current = row === -1 ? selected : row;
      const move = MOVES[event.key];
      if (move !== undefined && items.length > 0) {
        event.preventDefault();
        const to = destination(move, current, items.length, columns);
        if (to === -1) {
          return;
        }
        focusItem(to);
        onSelect(to);
      } else if (event.key === "Enter" && current === selected && selected !== -1 && onEdit()) {
        event.preventDefault();
      } else if (event.key === "Escape" && onClose()) {
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [columns, focusItem, getItems, listRef, onClose, onEdit, onSelect, selected]);

  const focusSelected = useCallback(() => {
    if (selected !== -1) {
      focusItem(selected);
    }
  }, [focusItem, selected]);
  return { focusSelected, ref: listRef };
}
