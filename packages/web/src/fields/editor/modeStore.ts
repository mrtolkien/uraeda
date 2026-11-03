// The focused field's Vim mode and cursor's place, for the status line (R4): a small store outside
// React, since every keystroke moves the cursor and a context would draw the shell again each time.
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

/** The cursor's place: its line and column, from 1, and how far the field is scrolled, Vim's way. */
export type Place = { column: number; line: number; progress: string };

/** What the status line reads: `nav` while no field has the focus. */
export type ModeView = { column?: number; line?: number; mode: Mode | "nav"; progress?: string };

const NAV: ModeView = { mode: "nav" };

let current: ModeView = NAV;
const listeners = new Set<() => void>();

function set(next: ModeView) {
  current = next;
  for (const listener of listeners) {
    listener();
  }
}

/** The focused field, with its mode and place, or `null` once no field has the focus. */
export function setFocused(field: ({ mode: Mode } & Place) | null) {
  set(field ? { ...field } : NAV);
}

/** The focused field's mode, as the Vim layer reads it from the engine. */
export function setMode(mode: Mode) {
  if (current.mode !== "nav" && current.mode !== mode) {
    set({ ...current, mode });
  }
}

/** The focused field's cursor, moved. */
export function setPlace(place: Place) {
  if (
    current.mode !== "nav" &&
    (current.line !== place.line ||
      current.column !== place.column ||
      current.progress !== place.progress)
  ) {
    set({ ...current, ...place });
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The focused field's mode and place, or `nav`, as they are now, outside React. */
export const modeNow = (): ModeView => current;

/** The focused field's mode and place, or `nav`. */
export function useMode(): ModeView {
  return useSyncExternalStore(subscribe, () => current);
}
