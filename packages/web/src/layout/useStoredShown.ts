import { useState } from "react";

/**
 * The choices made in this document when storage refused them, by key: pages are drawn anew at
 * each address, and keep them until the document goes.
 */
const refusedChoices = new Map<string, boolean>();

/** Whether a column shows, and the function that shows or hides it. */
export type Shown = [boolean, (shown: boolean) => void];

/**
 * Whether a foldable column shows, kept in `localStorage` under `key`, `"shown"` or `"hidden"`,
 * `fallback` at first, which is shown unless told otherwise. Where the browser refuses storage, the
 * choice lasts for the page's life.
 */
export function useStoredShown(key: string, fallback: () => boolean = () => true): Shown {
  const [shown, setShown] = useState(() => {
    const refused = refusedChoices.get(key);
    if (refused !== undefined) {
      return refused;
    }
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? fallback() : stored === "shown";
    } catch {
      return fallback();
    }
  });
  const set = (next: boolean) => {
    try {
      window.localStorage.setItem(key, next ? "shown" : "hidden");
      refusedChoices.delete(key);
    } catch {
      // Private windows may refuse storage: the choice lasts until the document reloads.
      refusedChoices.set(key, next);
    }
    setShown(next);
  };
  return [shown, set];
}
