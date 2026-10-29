// Draws the leader's pending sequence as the menu, once it is shown, and closes it where the human
// has moved on: a page change (its path or its query), or a layer opening over the page. A closed
// menu stays drawn while it slides away.
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearch } from "../routes.tsx";
import { useLayerOpen } from "./layers.ts";
import { LeaderMenu, type MenuEntry, SLIDE_MS } from "./LeaderMenu.tsx";
import { useLeader } from "./registry.tsx";
import { entriesAt } from "./sequence.ts";

/** What the menu shows: the keys pressed, and the next keys. */
type Shown = { entries: ReadonlyArray<MenuEntry>; path: ReadonlyArray<string> };

/** What a menu shows, as text: two menus that show the same are the same. */
const textOf = (shown: Shown | null) => JSON.stringify(shown);

/**
 * The menu to draw: `open`, the one shown now, or, once the sequence ended, the last one shown,
 * kept for the slide out until `SLIDE_MS` have passed. It keeps each new menu as the host renders,
 * where an effect would render it twice.
 */
function useKept(open: Shown | null) {
  const [kept, setKept] = useState<Shown | null>(null);
  if (open !== null && textOf(open) !== textOf(kept)) {
    setKept(open);
  }
  const isOpen = open !== null;
  useEffect(() => {
    if (isOpen) {
      return undefined;
    }
    const timer = setTimeout(() => setKept(null), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);
  return open ?? kept;
}

/** The leader's menu, while a sequence waits for its next key and a moment after, as it slides. */
export function LeaderMenuHost() {
  const { bindings, end, step } = useLeader();
  // The page is its path and its query: /new and /new?kind=change are two pages.
  const page = usePathname() + useSearch();
  const isLayerShown = useLayerOpen();
  const shownAt = useRef(page);
  useEffect(() => {
    if (shownAt.current !== page) {
      shownAt.current = page;
      end();
    }
  }, [end, page]);
  useEffect(() => {
    if (isLayerShown) {
      end();
    }
  }, [end, isLayerShown]);
  const isOpen = step !== null && step.isShown;
  // The last menu shown, kept for the slide out once the sequence ends.
  const shown = useKept(
    isOpen
      ? { entries: entriesAt(bindings, step.path, document.activeElement), path: step.path }
      : null,
  );
  if (shown === null) {
    return null;
  }
  return <LeaderMenu {...shown} isClosing={!isOpen} />;
}
