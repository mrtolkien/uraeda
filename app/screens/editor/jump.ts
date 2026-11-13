// A line of a file asked from another pane, as the outline's heading: the file's editor puts its
// caret there. Asked by the editor's key, `bufferKey(repo, path)`; `at` tells two asks apart.
import { signal } from "nsh";

export const lineAsked = signal<{ at: number; key: string; line: number } | null>(null);

/** Asks the editor of `key` to put its caret at `line`, from 0. */
export function askLine(key: string, line: number) {
  lineAsked.set({ at: Date.now(), key, line });
}
