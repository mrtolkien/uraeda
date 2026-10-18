import { useMemo, useState } from "react";
import type { SpecItems } from "uraeda-binding";
import { type Fold, type Folds, specFolds } from "./Folds.tsx";
import { currentEntry, updateEntry } from "./routes.tsx";

/** The items a view opened, by their keys, and how to open or close one. */
export type OpenKeys = {
  onOpenChange: (key: string, isOpen: boolean) => void;
  open: ReadonlyArray<string>;
};

/**
 * The items opened in a view, like a transcript's groups of tool calls or a spec's folds, kept in
 * the history entry for Back and reloads. Several views of a page may each keep theirs, by keys of
 * their own: each change starts from the entry's keys, so it keeps the others'.
 */
export function useOpenKeys(): OpenKeys {
  const [open, setOpen] = useState<ReadonlyArray<string>>(() => currentEntry().open ?? []);
  // The entry this view was opened on: still shown while the next page loads, it must not write
  // into the next one's entry.
  const [id] = useState(() => currentEntry().id);
  return {
    onOpenChange: (key, isOpen) => {
      const ours = currentEntry().id === id;
      const from = (ours ? currentEntry().open : open) ?? [];
      const next = isOpen ? [...from.filter((k) => k !== key), key] : from.filter((k) => k !== key);
      setOpen(next);
      if (ours) {
        updateEntry({ open: next });
      }
    },
    open,
  };
}

/**
 * A spec's folds, open as the history entry keeps them, and those `forced` open by what the page
 * shows in them, like a pending comment or the selection, without writing them to the entry. A
 * forced fold the human closes stays closed until opened again.
 */
export function useSpecFolds(
  spec: Pick<SpecItems, "stories"> | undefined,
  forced: (folds: ReadonlyArray<Fold>) => ReadonlyArray<string> = () => [],
): Folds | undefined {
  const keys = useOpenKeys();
  const [shut, setShut] = useState<ReadonlyArray<string>>([]);
  const list = useMemo(() => (spec ? specFolds(spec) : []), [spec]);
  if (list.length === 0) {
    return undefined;
  }
  const opened = forced(list).filter((key) => !shut.includes(key) && !keys.open.includes(key));
  return {
    list,
    onOpenChange: (key, isOpen) => {
      setShut(isOpen ? shut.filter((k) => k !== key) : [...shut.filter((k) => k !== key), key]);
      keys.onOpenChange(key, isOpen);
    },
    open: [...keys.open, ...opened],
  };
}
