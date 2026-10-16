// What links a list to the pane open beside it, on wide screens: the list's keys show another row
// in the pane, close it, and ask it to edit its item; the pane gives the focus back to the list's
// row once its field closes.
import { createContext, use, useEffect, useRef, useState } from "react";
import { redirect, updateEntry } from "../routes.tsx";

/** The pane beside a list, set by the route that draws them both. */
export interface ListPane {
  /** Closes the pane. */
  close: () => void;
  /** Opens the pane's item to edit, and says whether it did: a pane may have nothing to edit. */
  edit: () => boolean;
  /** Puts the focus on the list's selected row. */
  focusRow: () => void;
  /**
   * Shows another row in the pane, in the same history entry: Back leaves the list, not each row
   * passed. The page's position is kept, which the pane drawn anew would otherwise restore.
   */
  follow: (href: string) => void;
  /** Sets what `edit` calls, for the pane: returns what unsets it. */
  setEdit: (edit: () => void) => () => void;
  /** Sets what `focusRow` calls, for the list: returns what unsets it. */
  setFocusRow: (focus: () => void) => () => void;
}

export const ListPaneContext = createContext<ListPane | null>(null);

/** A pane closed by `close`. */
function listPane(close: () => void): ListPane {
  let edit: (() => void) | undefined;
  let focus: (() => void) | undefined;
  return {
    close,
    edit: () => {
      edit?.();
      return edit !== undefined;
    },
    focusRow: () => focus?.(),
    follow: (href) => {
      updateEntry({ scroll: window.scrollY });
      redirect(href);
    },
    setEdit: (next) => {
      edit = next;
      return () => {
        if (edit === next) {
          edit = undefined;
        }
      };
    },
    setFocusRow: (next) => {
      focus = next;
      return () => {
        if (focus === next) {
          focus = undefined;
        }
      };
    },
  };
}

/** The pane of a route that draws a list and its detail, closed by `close`. */
export function useListPane(close: () => void): ListPane {
  const [pane] = useState(() => listPane(close));
  return pane;
}

/**
 * For a pane: Enter on the list's selected row calls `edit`, which opens the pane's field. Once
 * `isEditing` turns false and the field's focus is lost with it, the focus goes back to the row.
 * Without `edit`, the pane has nothing to edit, and Enter opens the row.
 */
export function usePaneEdit(edit: (() => void) | undefined, isEditing: boolean) {
  const pane = use(ListPaneContext);
  useEffect(() => (pane && edit ? pane.setEdit(edit) : undefined), [pane, edit]);
  const wasEditing = useRef(isEditing);
  useEffect(() => {
    const closed = wasEditing.current && !isEditing;
    wasEditing.current = isEditing;
    const lost = document.activeElement === null || document.activeElement === document.body;
    if (closed && lost && edit) {
      pane?.focusRow();
    }
  }, [pane, edit, isEditing]);
}
