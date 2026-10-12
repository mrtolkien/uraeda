import { createElement, useCallback } from "react";
import { Button } from "@astryxdesign/core/Button";
import { useToast } from "@astryxdesign/core/Toast";

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
            dismiss();
            const error = await undo();
            if (error) {
              showToast({ body: error, type: "error" });
            }
          },
        }),
      });
    },
    [showToast],
  );
}
