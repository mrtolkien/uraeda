// Draws the leader's pending sequence as the menu, once it is shown, and closes it where the human
// has moved on: a page change, or a layer opening over the page.
import { useEffect, useRef } from "react";
import { usePathname } from "../routes.tsx";
import { useLayerOpen } from "./layers.ts";
import { LeaderMenu } from "./LeaderMenu.tsx";
import { useLeader } from "./registry.tsx";
import { entriesAt } from "./sequence.ts";

export function LeaderMenuHost() {
  const { bindings, end, step } = useLeader();
  const pathname = usePathname();
  const isLayerShown = useLayerOpen();
  const shownAt = useRef(pathname);
  useEffect(() => {
    if (shownAt.current !== pathname) {
      shownAt.current = pathname;
      end();
    }
  }, [end, pathname]);
  useEffect(() => {
    if (isLayerShown) {
      end();
    }
  }, [end, isLayerShown]);
  if (step === null || !step.isShown) {
    return null;
  }
  return <LeaderMenu entries={entriesAt(bindings, step.path)} path={step.path} />;
}
