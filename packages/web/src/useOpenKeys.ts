import { useState } from "react";
import { currentEntry, updateEntry } from "./routes.tsx";

/** The items a view opened, by their keys, and how to open or close one. */
export type OpenKeys = {
  onOpenChange: (key: string, isOpen: boolean) => void;
  open: ReadonlyArray<string>;
};

/**
 * The items opened in a view, like a transcript's groups of tool calls or a spec's folds, kept in
 * the history entry for Back and reloads.
 */
export function useOpenKeys(): OpenKeys {
  const [open, setOpen] = useState<ReadonlyArray<string>>(() => currentEntry().open ?? []);
  // The entry this view was opened on: still shown while the next page loads, it must not write
  // into the next one's entry.
  const [id] = useState(() => currentEntry().id);
  return {
    onOpenChange: (key, isOpen) => {
      const next = isOpen ? [...open.filter((k) => k !== key), key] : open.filter((k) => k !== key);
      setOpen(next);
      if (currentEntry().id === id) {
        updateEntry({ open: next });
      }
    },
    open,
  };
}
