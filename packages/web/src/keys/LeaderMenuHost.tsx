// Draws the leader's pending sequence as the menu, once it is shown, and closes it where the human
// has moved on: a page change (its path or its query), or a layer opening over the page. A closed
// menu stays drawn while it slides away.
import { useEffect, useReducer, useRef } from "react";
import { usePathname, useSearch } from "../routes.tsx";
import { useLayerOpen } from "./layers.ts";
import { LeaderMenu, type MenuEntry, SLIDE_MS } from "./LeaderMenu.tsx";
import { useLeader } from "./registry.tsx";
import { entriesAt } from "./sequence.ts";

/** What the menu shows: the keys pressed, and the next keys. */
type Shown = { entries: ReadonlyArray<MenuEntry>; path: ReadonlyArray<string> };

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
  const last = useRef<Shown | null>(null);
  const [, forget] = useReducer((count: number) => count + 1, 0);
  if (isOpen) {
    last.current = {
      entries: entriesAt(bindings, step.path, document.activeElement),
      path: step.path,
    };
  }
  useEffect(() => {
    if (isOpen) {
      return undefined;
    }
    const timer = setTimeout(() => {
      last.current = null;
      forget();
    }, SLIDE_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);
  if (last.current === null) {
    return null;
  }
  return <LeaderMenu {...last.current} isClosing={!isOpen} />;
}
