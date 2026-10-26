// Which picker is open, as module state: `useKeyPicker` opens it from anywhere, a key of the leader
// menu or a page's, and the one host in the shell (`KeyPickerHost`) draws it. Plain state behind
// `useSyncExternalStore`, so opening it asks no provider around the page.
import { useSyncExternalStore } from "react";
import type { PickerKind } from "./pickerSources.ts";

/** The picker's state: the kind it was last opened over, kept while it closes. */
export type PickerState = { isOpen: boolean; kind: PickerKind | "all" | null };

const CLOSED: PickerState = { isOpen: false, kind: null };
let state = CLOSED;
const listeners = new Set<() => void>();

function set(next: PickerState) {
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

/** Opens the picker over a kind, or over every kind. */
function open(kind: PickerKind | "all") {
  set({ isOpen: true, kind });
}

/** Closes it, keeping its kind so what it drew stays until it is opened again. */
export function closePicker() {
  set({ ...state, isOpen: false });
}

/** Forgets everything, as the host goes: the next page opens a fresh one. */
export function resetPicker() {
  set(CLOSED);
}

/** The picker's state, redrawing the caller as it changes. */
export function usePickerState(): PickerState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    () => state,
    () => CLOSED,
  );
}

const OPENER = { open };

/** Opens the key picker over a kind of thing, `"all"` for every kind, from anywhere. */
export function useKeyPicker(): { open: (kind: PickerKind | "all") => void } {
  return OPENER;
}
