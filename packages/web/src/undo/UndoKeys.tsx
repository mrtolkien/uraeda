// The keys of the tab's undo stack, mounted once in the shell: `u` and Ctrl+Z undo the latest
// action, `U` and Ctrl+Shift+Z redo the latest undone, outside text fields, whose own keys stay
// theirs. An action committed since asks first; a refusal shows in the page; once done, the toast
// says what came back, and the action's page opens with it selected.
import { useLayoutEffect, useSyncExternalStore } from "react";
import { type ConfirmOptions, useConfirm } from "../fields/Confirm.tsx";
import { useKeys } from "../keys/registry.tsx";
import {
  currentEntry,
  localPath,
  navigate,
  parseLocation,
  repoPath,
  selectOnArrival,
} from "../routes.tsx";
import { showPageError } from "./pageErrors.ts";
import { type UndoEntry, undoStack } from "./stack.ts";
import { setReplay, useStackToast } from "./useUndo.ts";

/** What an undo, or a redo, asks of an action committed since: it writes a new change. */
export function committedQuestion(entry: UndoEntry, redo: boolean): ConfirmOptions {
  return {
    body: entry.label,
    cancel: "Keep it",
    confirm: redo ? "Redo" : "Undo",
    detail: `This change was committed since. ${redo ? "Redoing" : "Undoing"} it writes the reverse as a new change, which waits on the Git page.`,
    title: `${redo ? "Redo" : "Undo"} a committed change?`,
  };
}

/** The label after "Undone: " or "Redone: ", its first letter lowercase: "Undone: deleted …". */
function lowered(label: string) {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/**
 * Takes the human where the action happened, with what came back selected: its repository's page
 * opens, in a new history entry that Back leaves, or, on that page of that repository already, the
 * row is selected in place. The stack is the tab's: an entry may come from another repository. A
 * location that names none, a story's, is taken as the entry's.
 */
export function goTo({ path, repo, select }: UndoEntry["place"]) {
  const page = path.split(/[?#]/, 1)[0];
  const here = parseLocation(window.location.pathname).repo ?? repo;
  if (here !== repo || page !== localPath(window.location.pathname)) {
    navigate(repoPath(repo, path), select === undefined ? undefined : { select });
  } else if (select !== undefined) {
    selectOnArrival(currentEntry().id, select);
  }
}

/** The undo, or the redo with `redo`, of the stack's top: what the keys and the toasts run. */
function useReplay() {
  const confirm = useConfirm();
  const toast = useStackToast();
  const ask = async (entry: UndoEntry, isRedo: boolean) =>
    (await confirm(committedQuestion(entry, isRedo))) === true;
  return async (redo: boolean) => {
    const word = redo ? "redo" : "undo";
    try {
      const outcome = await (redo ? undoStack.redo(ask) : undoStack.undo(ask));
      if (outcome.kind === "refused") {
        showPageError(outcome.reason);
      } else if (outcome.kind === "done") {
        const { entry } = outcome;
        toast(`${redo ? "Redone" : "Undone"}: ${lowered(entry.label)}`, entry, !redo);
        goTo(entry.place);
      }
    } catch (error) {
      // A read or a write that failed shows as a refusal does, never as a rejection nothing catches.
      showPageError(`Could not ${word}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}

/**
 * `u` and Ctrl+Z undo; `U` and Ctrl+Shift+Z redo, declared only while there is something to redo,
 * `U` hinted in the status line then. With the single keys off, Ctrl+Z and Ctrl+Shift+Z still work.
 */
export function UndoKeys() {
  const replay = useReplay();
  const canRedo = useSyncExternalStore(undoStack.subscribe, undoStack.canRedo);
  useLayoutEffect(() => {
    setReplay((redo) => void replay(redo));
    return () => setReplay(undefined);
  });
  // An empty stack lets the key go on, as no binding of it ran.
  const undo = () => (undoStack.top() === undefined ? false : void replay(false));
  const redo = () => void replay(true);
  useKeys(
    [
      { keys: "u", label: "undo", run: undo },
      { keys: "mod+z", label: "undo", run: undo },
      ...(canRedo
        ? [
            { hint: "U", keys: "U", label: "redo", run: redo },
            { keys: "mod+shift+z", label: "redo", run: redo },
          ]
        : []),
    ],
    "shell",
  );
  return null;
}
