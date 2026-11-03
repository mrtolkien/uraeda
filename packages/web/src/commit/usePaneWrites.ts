// The Commit page's writes: a pane's Commit, with its message as the human left it, and its
// Discard, which asks first. A message the human rewrote is unsaved text, in the store by branch
// (`messageField`), until its commit lands: a hook's refusal of the pane's commit, which comes after
// the call returns, leaves the message as typed.
import { useLayoutEffect, useState } from "react";
import { useFateClient } from "react-fate";
import { rereadChanges } from "../data.ts";
import { refusal } from "../errors.ts";
import { discardChanges, useConfirm } from "../fields/Confirm.tsx";
import { dropUnsaved, readUnsaved, unsavedKey } from "../fields/unsaved.ts";
import { plural } from "../labels.ts";
import { closeUndoToasts } from "../layout/useUndoToast.ts";
import { useRepositoryPath } from "../routes.tsx";
import { PrioritiesView } from "../views.ts";
import { refusedAt, useClearRefusal, useWriteQueue, writeHere } from "../writes/useWriteQueue.ts";
import type { CommitPane } from "./BranchPane.tsx";

/** The page's last write: done, or refused, in the pane of `branch`. */
export type Outcome = { branch?: string; ok: boolean; text: string };

/** The unsaved store's field of a branch's message, which `useTextField` takes. */
export const messageField = (branch: string) => `commit:${branch}#message`;

/**
 * The pane's lines as each typed message's commit was made, by its store key, while it lands: kept
 * outside the page, so a commit that lands once the page is left still takes its message with it.
 */
const landing = new Map<string, { branch: string; lines: string }>();

/** A pane's lines as one key: they change once its commit lands. */
const linesOf = (pane: CommitPane) => pane.lines.join("\n");

/** Whether a commit landed: the pane's lines changed since, or it went, and no refusal of its own. */
const landed = (lines: string, pane: CommitPane | undefined, refused: boolean) =>
  !refused && (pane === undefined || lines !== linesOf(pane));

/**
 * Each pane's message, and its Commit and Discard, for the page at `here`, showing `panes`, once
 * read.
 */
export function usePaneWrites(
  here: { href: string },
  panes: ReadonlyArray<CommitPane> | undefined,
) {
  const fate = useFateClient();
  const confirm = useConfirm();
  const clearRefusal = useClearRefusal(here);
  const writes = useWriteQueue();
  const repo = useRepositoryPath();
  const keyOf = (branch: string) => unsavedKey(repo, messageField(branch));
  // A pane's own refusal: a feature's write names its folder, the default branch's none.
  const refusedIn = (branch: string) => {
    const folder = panes?.find((pane) => pane.branch === branch)?.folder ?? undefined;
    return writes.some((write) => refusedAt(write, here) && write.folder === folder);
  };
  const [outcome, setOutcome] = useState<Outcome>();
  // A typed message whose commit landed goes, for good, before the page draws it again; a refusal
  // of the pane's commit keeps it, for the next try. Panes not read yet decide nothing.
  useLayoutEffect(() => {
    if (panes === undefined) {
      return;
    }
    for (const [key, { branch, lines }] of landing) {
      const pane = panes.find((one) => one.branch === branch);
      // Another repository's message waits for its own page.
      if (key === keyOf(branch) && landed(lines, pane, refusedIn(branch))) {
        landing.delete(key);
        dropUnsaved(key);
      }
    }
  });
  /** The message a pane commits: the one typed, kept in the store, or the core's suggestion. */
  const messageOf = (pane: CommitPane) => readUnsaved(keyOf(pane.branch))?.text ?? pane.message;

  /** Runs a pane's write: the counts everywhere read again, and a refusal shows in its pane. */
  const run = async (pane: CommitPane, call: () => Promise<{ error?: unknown }>, done: string) => {
    setOutcome(undefined);
    const result = await call();
    rereadChanges(fate);
    if (result.error) {
      setOutcome({ branch: pane.branch, ok: false, text: refusal(result.error).message });
      return false;
    }
    // An Undo would write a change back over the committed file.
    closeUndoToasts();
    if (readUnsaved(keyOf(pane.branch))) {
      landing.set(keyOf(pane.branch), { branch: pane.branch, lines: linesOf(pane) });
    }
    setOutcome({ ok: true, text: done });
    return true;
  };
  const commit = (pane: CommitPane) => {
    clearRefusal();
    return run(
      pane,
      () =>
        fate.mutations.changes.commit({
          input: {
            branch: pane.branch,
            message: messageOf(pane),
            write: writeHere(`Committing ${plural(pane.count, "change")}`),
          },
          view: PrioritiesView,
        }),
      "Committed.",
    );
  };
  const discard = async (pane: CommitPane) => {
    if (await confirm(discardChanges(pane.count))) {
      await run(
        pane,
        () =>
          fate.mutations.changes.discard({ input: { branch: pane.branch }, view: PrioritiesView }),
        "Discarded.",
      );
    }
  };
  return { commit, discard, outcome };
}
