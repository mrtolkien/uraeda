import { createElement, useCallback, useSyncExternalStore } from "react";
import { Button } from "@astryxdesign/core/Button";
import { useToast } from "@astryxdesign/core/Toast";
import { KeyCap } from "../keys/KeyCap.tsx";
import { useKeys, useSingleKeys } from "../keys/registry.tsx";
import { WriteButton } from "../writes/WriteButton.tsx";

/** The undo toasts on screen, by the function that closes each. */
const open = new Set<() => void>();

/** The ids of the undo toasts shown, oldest first, by which `u` finds their Undo. */
const shown: Array<number> = [];

/** How many toasts' ids are kept: more than ever show at once. */
const SHOWN_MAX = 20;
let nextToast = 0;

/**
 * Presses the Undo of the newest undo toast still on screen, as a click does: `false` when none
 * is. A toast hidden after its 5 seconds is no longer there to press.
 */
function undoLatest() {
  for (const id of [...shown].reverse()) {
    const button = document.querySelector<HTMLButtonElement>(`[data-undo="${id}"] button`);
    if (button) {
      button.click();
      return true;
    }
  }
  return false;
}

/** `u`: the Undo of the newest undo toast on screen. Mounted once, in the shell. */
export function UndoKey() {
  useKeys([{ keys: "u", label: "undo", run: () => (undoLatest() ? undefined : false) }], "shell");
  return null;
}

/**
 * Closes every undo toast on screen: once the changes are committed, there is nothing left for
 * them to undo.
 */
export function closeUndoToasts() {
  for (const close of open) {
    close();
  }
  open.clear();
}

/** The errors of refused Undos, shown in the page until dismissed, and who listens to them. */
type UndoError = { id: number; text: string };
let errors: ReadonlyArray<UndoError> = [];
let nextId = 0;
const listeners = new Set<() => void>();

function setErrors(next: ReadonlyArray<UndoError>) {
  errors = next;
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Forgets the toasts and errors of a page that is gone. The page keeps them for its whole life:
 * tests, which mount a new page each time in the same module, start each one empty.
 */
export function forgetUndoToasts() {
  open.clear();
  setErrors([]);
}

/**
 * Shows `text` where a refused Undo's error shows, until dismissed: for a write refused after the
 * form that made it closed.
 */
export function showPageError(text: string) {
  nextId += 1;
  setErrors([...errors, { id: nextId, text }]);
}

/** The errors of refused Undos, and how to dismiss one, by its id. */
export function useUndoErrors(): [ReadonlyArray<UndoError>, (id: number) => void] {
  const shown = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => errors,
  );
  return [shown, (id) => setErrors(errors.filter((error) => error.id !== id))];
}

/**
 * Confirms a change the human cannot see on screen, for 5 seconds, with one Undo that reverts it.
 * `undo` resolves with nothing once reverted, or with the error to show instead: in the page,
 * under the top bar, until dismissed, as a toast must not be the only place an error shows. With
 * `commits`, Undo commits its revert: a git write, which reads "Undoing…" until it ends, the toast
 * open, and waits while another write runs.
 */
export function useUndoToast(): (
  message: string,
  undo: () => Promise<string | undefined>,
  commits?: boolean,
) => void {
  const showToast = useToast();
  const singleKeys = useSingleKeys();
  return useCallback(
    (message, undo, commits = false) => {
      nextToast += 1;
      const id = nextToast;
      // A toast that hid on its own stays listed: only the newest few can still be on screen.
      shown.push(id);
      shown.splice(0, Math.max(0, shown.length - SHOWN_MAX));
      // `u` presses it too: its key, after its label, while the single keys are on.
      const key = singleKeys ? createElement(KeyCap, null, "u") : undefined;
      const revert = async () => {
        const error = await undo();
        if (error) {
          showPageError(error);
        }
      };
      const dismiss = showToast({
        autoHideDuration: 5000,
        body: message,
        endContent: createElement(
          "span",
          { "data-undo": id },
          commits
            ? createElement(WriteButton, {
                endContent: key,
                label: "Undo",
                onClick: () => revert().finally(close),
                runningLabel: "Undoing…",
                variant: "ghost",
              })
            : createElement(Button, {
                clickAction: async () => {
                  close();
                  await revert();
                },
                endContent: key,
                label: "Undo",
                variant: "ghost",
              }),
        ),
      });
      const close = () => {
        open.delete(close);
        const at = shown.indexOf(id);
        if (at !== -1) {
          shown.splice(at, 1);
        }
        dismiss();
      };
      // Closing a toast already hidden after its 5 seconds does nothing.
      open.add(close);
    },
    [showToast, singleKeys],
  );
}
