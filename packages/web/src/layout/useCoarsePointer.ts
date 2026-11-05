// Whether the main pointer is coarse, as a finger: a tap, not a click, and a keyboard with no
// Shift+Enter, as a phone's.
import { useSyncExternalStore } from "react";

const COARSE = "(pointer: coarse)";

/** Whether the pointer is coarse, kept up to date as it changes. */
export function useCoarsePointer() {
  return useSyncExternalStore(
    (changed) => {
      const query = window.matchMedia?.(COARSE);
      query?.addEventListener("change", changed);
      return () => query?.removeEventListener("change", changed);
    },
    () => window.matchMedia?.(COARSE).matches ?? false,
  );
}
