// Which picker is open, as module state: `useKeyPicker` opens it from anywhere, a key of the leader
// menu or a page's, and the one host in the shell (`KeyPickerHost`) draws it. Plain state behind
// `useSyncExternalStore`, so opening it asks no provider around the page.
import { useEffect, useSyncExternalStore } from "react";
import type { PickerKind } from "./pickerSources.ts";

/**
 * The picker's state: the kind it was last opened over, kept while it closes, and how many times
 * it was opened, which tells a new opening from the one before.
 */
export type PickerState = { isOpen: boolean; kind: PickerKind | "all" | null; opening: number };

const CLOSED: PickerState = { isOpen: false, kind: null, opening: 0 };
let state = CLOSED;
/** The hosts that draw the picker now: with none, an opening has nothing to show it. */
let hosts = 0;
const listeners = new Set<() => void>();

function set(next: PickerState) {
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Opens the picker over a kind, or over every kind. With no host drawing it, nothing opens: the
 * next shell would show a picker nobody asked it for.
 */
function open(kind: PickerKind | "all") {
  if (hosts > 0) {
    set({ isOpen: true, kind, opening: state.opening + 1 });
  }
}

/** Closes it, keeping its kind so what it drew stays until it is opened again. */
export function closePicker() {
  set({ ...state, isOpen: false });
}

/** Forgets everything, as the host goes: the next page opens a fresh one. */
export function resetPicker() {
  set(CLOSED);
}

/** The picker's state, redrawing the caller as it changes: the host's, which `open` needs. */
export function usePickerState(): PickerState {
  useEffect(() => {
    hosts += 1;
    return () => {
      hosts -= 1;
    };
  }, []);
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
