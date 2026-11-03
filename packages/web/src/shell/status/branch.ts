// The branch the status line shows in its section b, as lualine's `branch`: the page drawn names
// it, as a buffer names the branch its file is on. A small store outside React, since the page and
// the line are apart in the tree.
import { useEffect, useSyncExternalStore } from "react";

let current: string | undefined;
const listeners = new Set<() => void>();

function set(next: string | undefined) {
  if (next === current) {
    return;
  }
  current = next;
  for (const listener of listeners) {
    listener();
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Shows `branch` in the status line while the calling page is drawn; `undefined` shows none. */
export function useStatusBranch(branch: string | undefined) {
  useEffect(() => {
    set(branch);
    return () => set(undefined);
  }, [branch]);
}

/** The branch a page shows in the status line, if any. */
export function useShownBranch(): string | undefined {
  return useSyncExternalStore(subscribe, () => current);
}
