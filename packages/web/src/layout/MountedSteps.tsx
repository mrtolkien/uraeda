// A page's parts below its first screen, mounted in steps after its first frame.
import { type ReactNode, useState } from "react";
import { currentEntry } from "../routes.tsx";
import { useMountedSteps } from "./useMountedSteps.ts";

/**
 * Whether the page opens at a place of its own: by Back or a reload, whose history entry holds its
 * position; at the part its address names; or scrolled already, as a page drawn again in place.
 */
function opensKept() {
  return (
    typeof currentEntry().scroll === "number" || window.location.hash !== "" || window.scrollY > 0
  );
}

/**
 * `parts`, each keyed, the empty ones left out: none on the page's first frame, then one at a time,
 * each in a transition after the commit before it (`useMountedSteps`); all at once when the page
 * opens at a place of its own, so it opens there.
 */
export function MountedSteps({ parts }: { parts: ReadonlyArray<ReactNode> }) {
  const [kept] = useState(opensKept);
  const shown = parts.filter((part) => part !== false && part != null && part !== "");
  const mounted = useMountedSteps(shown.length, kept ? shown.length : 0);
  return shown.slice(0, mounted);
}
