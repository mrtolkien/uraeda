import { createElement, useCallback } from "react";
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

/**
 * Confirms a change the human cannot see on screen, for 5 seconds, with one Undo that reverts it.
 * `undo` resolves with nothing once reverted, or with the error to show instead, which stays until
 * dismissed.
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
              showToast({ body: error, type: "error" });
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
