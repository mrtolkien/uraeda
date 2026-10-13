import { createElement, useCallback, useSyncExternalStore } from "react";
import { Button } from "@astryxdesign/core/Button";
import { useToast } from "@astryxdesign/core/Toast";

/** The undo toasts on screen, by the function that closes each. */
const open = new Set<() => void>();

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
 * under the top bar, until dismissed, as a toast must not be the only place an error shows.
 */
export function useUndoToast(): (message: string, undo: () => Promise<string | undefined>) => void {
  const showToast = useToast();
  return useCallback(
    (message, undo) => {
      const dismiss = showToast({
        body: message,
        autoHideDuration: 5000,
        endContent: createElement(Button, {
          label: "Undo",
          variant: "ghost",
          clickAction: async () => {
            close();
            const error = await undo();
            if (error) {
              nextId += 1;
              setErrors([...errors, { id: nextId, text: error }]);
            }
          },
        }),
      });
      const close = () => {
        open.delete(close);
        dismiss();
      };
      // Closing a toast already hidden after its 5 seconds does nothing.
      open.add(close);
    },
    [showToast],
  );
}
