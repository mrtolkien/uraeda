// The Vim layer's loader: the engine is a chunk of its own, imported only with the Vim mode switch
// on and a fine main pointer, a mouse's or a trackpad's (SC-004): touch screens never request it.
// And the errors of the human's commands, from the engine's last start, which the settings show.
import { useSyncExternalStore } from "react";

/** The chunk's layer, once loaded. */
export type VimLayer = typeof import("./vim.ts");

/**
 * The Vim layer, imported once `settings.on` and `pointer.fine` both hold, else nothing: with the
 * switch off, or on a touch screen, the engine's chunk is never requested.
 */
export async function loadVim(
  settings: { commands: ReadonlyArray<string>; on: boolean },
  pointer: { fine: boolean },
): Promise<VimLayer | undefined> {
  if (!settings.on || !pointer.fine) {
    return undefined;
  }
  return import("./vim.ts");
}

/** Whether the main pointer is fine: a mouse or a trackpad, not a finger. */
export const finePointer = () => globalThis.matchMedia?.("(pointer: fine)").matches ?? false;

/** The commands' errors from the engine's last start, `Line N: <message>` each. */
let errors: ReadonlyArray<string> = [];
const listeners = new Set<() => void>();

/** Keeps the errors the engine gave the human's commands, for the settings to show. */
export function setVimErrors(next: ReadonlyArray<string>) {
  if (next.join("\n") === errors.join("\n")) {
    return;
  }
  errors = next;
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

/** The errors of the human's Vim commands, none while the engine is not loaded. */
export function useVimErrors(): ReadonlyArray<string> {
  return useSyncExternalStore(subscribe, () => errors);
}

/** Whether the Vim layer is in the fields now: the switch on, a fine pointer, the chunk loaded. */
let on = false;
const onListeners = new Set<() => void>();

/** Says the layer went into the fields, or out of them. */
export function setVimOn(next: boolean) {
  if (next === on) {
    return;
  }
  on = next;
  for (const listener of onListeners) {
    listener();
  }
}

const subscribeOn = (listener: () => void) => {
  onListeners.add(listener);
  return () => {
    onListeners.delete(listener);
  };
};

/** Whether Vim's keys work in the fields now, for the status line's mode. */
export function useVimOn(): boolean {
  return useSyncExternalStore(subscribeOn, () => on);
}
