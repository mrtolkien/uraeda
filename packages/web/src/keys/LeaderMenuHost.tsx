// Draws the leader's pending sequence as the menu, once it is shown, and closes it where the human
// has moved on: a page change (its path or its query), or a layer opening over the page.
import { useEffect, useRef } from "react";
import { usePathname, useSearch } from "../routes.tsx";
import { useLayerOpen } from "./layers.ts";
import { LeaderMenu } from "./LeaderMenu.tsx";
import { useLeader } from "./registry.tsx";
import { entriesAt } from "./sequence.ts";

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
  if (step === null || !step.isShown) {
    return null;
  }
  return (
    <LeaderMenu entries={entriesAt(bindings, step.path, document.activeElement)} path={step.path} />
  );
}
