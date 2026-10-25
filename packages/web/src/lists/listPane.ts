// What links the decisions page's list to the reader open beside it, on wide screens: the list's
// keys show another row in the reader, and close it.
import { createContext, useState } from "react";
import { redirect, updateEntry } from "../routes.tsx";

/** The reader beside a list, set by the route that draws them both. */
export interface ListPane {
  /** Closes the pane. */
  close: () => void;
  /**
   * Shows another row in the pane, in the same history entry: Back leaves the list, not each row
   * passed. The page's position is kept, which the pane drawn anew would otherwise restore.
   */
  follow: (href: string) => void;
}

export const ListPaneContext = createContext<ListPane | null>(null);

/** A pane closed by `close`. */
function listPane(close: () => void): ListPane {
  return {
    close,
    follow: (href) => {
      // The pane's place was the row left's: the next row's reader, as the constitution's, starts
      // where it shows its item, not where the last one was read.
      updateEntry({ pane: undefined, scroll: window.scrollY });
      redirect(href);
    },
  };
}

/** The pane of a route that draws a list and its detail, closed by `close`. */
export function useListPane(close: () => void): ListPane {
  const [pane] = useState(() => listPane(close));
  return pane;
}
