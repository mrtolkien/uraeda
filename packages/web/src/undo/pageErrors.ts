// The refusals of undos and redos, and of writes whose form closed before they answered: shown in
// the page, under the top bar, until dismissed, as a toast must not be the only place an error
// shows. The shell draws them (`UndoErrors` in `Shell.tsx`).
import { useSyncExternalStore } from "react";

/** A refusal shown in the page, by its id. */
type PageError = { id: number; text: string };
let errors: ReadonlyArray<PageError> = [];
let nextId = 0;
const listeners = new Set<() => void>();

function setErrors(next: ReadonlyArray<PageError>) {
  errors = next;
  for (const listener of listeners) {
    listener();
  }
}

/** Shows `text` in the page, under the top bar, until dismissed. */
export function showPageError(text: string) {
  nextId += 1;
  setErrors([...errors, { id: nextId, text }]);
}

/**
 * Forgets the errors shown: the page keeps them for its whole life, and tests, which mount a new
 * page each time in the same module, start each one empty.
 */
export function forgetUndoErrors() {
  setErrors([]);
}

/** The errors shown in the page, and how to dismiss one, by its id. */
export function useUndoErrors(): [ReadonlyArray<PageError>, (id: number) => void] {
  const shown = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => errors,
  );
  return [shown, (id) => setErrors(errors.filter((error) => error.id !== id))];
}
