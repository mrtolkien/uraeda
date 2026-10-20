import { isAbsolute } from "node:path";
import type { SessionCache } from "./cache.ts";

/** The tools that change a file: their target is the file they wrote. */
const EDIT_TOOLS = new Set(["Edit", "MultiEdit", "NotebookEdit", "Write"]);

/**
 * The files the session's agent edited or wrote with its tools, in the order it first did, once
 * each: those under the session's directory, by their relative path, whose call did not fail. A
 * file changed through a shell command is not among them.
 */
export function editedFiles(cache: SessionCache, session: string): Array<string> {
  const files = new Set<string>();
  for (const turn of cache.turns(session)) {
    for (const tool of cache.itemsOf(turn.id, "tool")) {
      const { name, status, target } = tool;
      if (EDIT_TOOLS.has(name) && status !== "failed" && target && !isAbsolute(target)) {
        files.add(target);
      }
    }
  }
  return [...files];
}

/**
 * The line before a session's first run in the change it became: where it works now, and the
 * files it edited in the main checkout, to carry over, or to merge by hand when they changed there
 * since.
 */
export function movedOpening(input: {
  branch: string;
  edited: Array<string>;
  folder: string;
  worktree: string;
}): string {
  const moved =
    `This session is now the change specs/changes/${input.folder}/, on branch ${input.branch}, ` +
    `in its worktree ${input.worktree}: work there from now on, not in the main checkout.`;
  if (input.edited.length === 0) {
    return moved;
  }
  return (
    `${moved} You edited these files in the main checkout: ${input.edited.join(", ")}. Carry ` +
    "each over to the worktree, then restore it in the main checkout, unless it changed there " +
    "since your edit: then leave it there, and merge your edit into the worktree's copy by hand."
  );
}
