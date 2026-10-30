// How a long page mounts its parts: those its first frame shows at once, then the others one at a
// time, each in a transition of its own after the commit before it, so the page draws within its
// first frame and no task of its drawing is long (R84).
import { startTransition, useEffect, useState } from "react";

/**
 * How many of a page's `count` parts, in its order, are mounted: `first` at once, then one more
 * after each commit, until all are. A `first` larger than those mounted mounts them at once: a
 * page that opens at a part mounts every part before it, so it opens there.
 */
export function useMountedSteps(count: number, first: number): number {
  const [mounted, setMounted] = useState(first);
  const shown = Math.min(count, Math.max(mounted, first));
  useEffect(() => {
    if (shown < count) {
      startTransition(() => setMounted(shown + 1));
    }
  }, [count, shown]);
  return shown;
}
