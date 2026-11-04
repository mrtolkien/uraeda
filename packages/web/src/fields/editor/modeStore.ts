// The focused field's Vim mode, for the status line (R4): a small store outside React, read by the
// shell's line alone, so a change of mode draws the line again, not the shell.
import { useSyncExternalStore } from "react";

/** A Vim mode. Without Vim, a focused field reports `insert`. */
export type Mode =
  | "command"
  | "insert"
  | "normal"
  | "replace"
  | "visual"
  | "visual-block"
  | "visual-line";

/** What the status line reads: `nav` while no field has the focus. */
export type ModeView = { mode: Mode | "nav" };

const NAV: ModeView = { mode: "nav" };

let current: ModeView = NAV;
const listeners = new Set<() => void>();

function set(next: ModeView) {
  current = next;
  for (const listener of listeners) {
    listener();
  }
}

/** The focused field, with its mode, or `null` once no field has the focus. */
export function setFocused(field: { mode: Mode } | null) {
  set(field ? { ...field } : NAV);
}

/** The focused field's mode, as the Vim layer reads it from the engine. */
export function setMode(mode: Mode) {
  if (current.mode !== "nav" && current.mode !== mode) {
    set({ ...current, mode });
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The focused field's mode, or `nav`, as it is now, outside React. */
export const modeNow = (): ModeView => current;

/** The focused field's mode, or `nav`. */
export function useMode(): ModeView {
  return useSyncExternalStore(subscribe, () => current);
}
