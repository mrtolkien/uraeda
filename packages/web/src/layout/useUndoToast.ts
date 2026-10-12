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
let errors: ReadonlyArray<string> = [];
const listeners = new Set<() => void>();

function setErrors(next: ReadonlyArray<string>) {
  errors = next;
  for (const listener of listeners) {
    listener();
  }
}

/** The errors of refused Undos, and how to dismiss one. */
export function useUndoErrors(): [ReadonlyArray<string>, (index: number) => void] {
  const shown = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => errors,
  );
  return [shown, (index) => setErrors(errors.filter((_, at) => at !== index))];
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
              setErrors([...errors, error]);
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
