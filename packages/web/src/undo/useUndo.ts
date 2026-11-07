// What a page does once one of its writes lands: it records the write's entry on the tab's undo
// stack, which shows its toast, with Undo. The toasts of the stack's own replays, "Undone: …" with
// Redo and "Redone: …" with Undo, are drawn the same way, by `UndoKeys`.
import { Button } from "@astryxdesign/core/Button";
import { createElement, useCallback } from "react";
import { KeyCap } from "../keys/KeyCap.tsx";
import { useSingleKeys } from "../keys/registry.tsx";
import { useTimedToast } from "../layout/useTimedToast.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { waitsOnGit } from "../writes/labels.ts";
import { type UndoEntry, undoStack } from "./stack.ts";

/** How long a toast of the stack stays, left alone, in ms. */
const TOAST_MS = 5000;

/**
 * What a toast's button presses: the undo, or the redo, of the stack's top, as `u` and `U` run them.
 * `UndoKeys`, mounted once in the shell, sets it; outside the shell, a click does nothing.
 */
let replay: ((redo: boolean) => void) | undefined;

/** Sets what the toasts' buttons press: `UndoKeys`'s replay, while it is mounted. */
export function setReplay(next: ((redo: boolean) => void) | undefined) {
  replay = next;
}

/**
 * Shows a toast of the stack: `body`, and one button, Undo with its key `u`, or Redo with `U` when
 * `redo`, each key hinted while the single keys are on, and not on the phone, where its button is a
 * tap. An Undo's toast closes once `entry` is no longer on top; a Redo's, as soon as the stack
 * changes, since its Redo would then redo something else, or nothing.
 */
export function useStackToast(): (body: string, entry: UndoEntry, redo: boolean) => void {
  const showToast = useTimedToast();
  const singleKeys = useSingleKeys();
  const narrow = isNarrow(useWidthClass());
  return useCallback(
    (body, entry, redo) => {
      const key = singleKeys && !narrow ? createElement(KeyCap, null, redo ? "U" : "u") : undefined;
      let stop = () => {};
      const dismiss = showToast({
        autoHideDuration: TOAST_MS,
        body,
        endContent: createElement(Button, {
          endContent: key,
          label: redo ? "Redo" : "Undo",
          onClick: () => {
            close();
            replay?.(redo);
          },
          variant: "ghost",
        }),
        onHide: () => stop(),
      });
      const close = () => {
        stop();
        dismiss();
      };
      stop = undoStack.subscribe(() => {
        if (redo || undoStack.top() !== entry) {
          close();
        }
      });
    },
    [narrow, showToast, singleKeys],
  );
}

/**
 * How `useUndo` shows an entry: `toast` false shows none; `waitsOnGit` false leaves the Git page
 * out of its toast, for the one action the browser holds, the New page's draft.
 */
type RecordOptions = { toast?: boolean; waitsOnGit?: boolean };

/**
 * Records a write that landed on the tab's undo stack, and shows its toast, its label and that it
 * waits on the Git page, with Undo: unless `toast` is false, or the entry is a move, which shows
 * none. A refused write records nothing: there is nothing to undo.
 */
export function useUndo(): (entry: UndoEntry, options?: RecordOptions) => void {
  const toast = useStackToast();
  return useCallback(
    (entry, options = {}) => {
      undoStack.record(entry);
      if (options.toast === false || entry.move) {
        return;
      }
      toast(options.waitsOnGit === false ? entry.label : waitsOnGit(entry.label), entry, false);
    },
    [toast],
  );
}
