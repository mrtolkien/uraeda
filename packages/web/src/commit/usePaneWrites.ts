// The Commit page's writes: a pane's Commit, with its message as the human left it, and its
// Discard, which asks first. The messages the human rewrote are kept by branch until their commit
// lands: a hook's refusal of the pane's commit, which comes after the call returns, leaves the
// message as typed.
import { useEffect, useState } from "react";
import { useFateClient } from "react-fate";
import { rereadChanges } from "../data.ts";
import { refusal } from "../errors.ts";
import { discardChanges, useConfirm } from "../fields/Confirm.tsx";
import { plural } from "../labels.ts";
import { closeUndoToasts } from "../layout/useUndoToast.ts";
import { PrioritiesView } from "../views.ts";
import { refusedAt, useClearRefusal, useWriteQueue, writeHere } from "../writes/useWriteQueue.ts";
import type { CommitPane } from "./BranchPane.tsx";

/** The page's last write: done, or refused, in the pane of `branch`. */
export type Outcome = { branch?: string; ok: boolean; text: string };

/** A message the human typed, and the pane's lines as its commit was made, while it lands. */
type Typed = { landing?: string; message: string };

/** A pane's lines as one key: they change once its commit lands. */
const linesOf = (pane: CommitPane) => pane.lines.join("\n");

/** Whether a commit landed: the pane's lines changed since, or it went, and no refusal of its own. */
const landed = (kept: Typed, pane: CommitPane | undefined, refused: boolean) =>
  kept.landing !== undefined && !refused && (pane === undefined || kept.landing !== linesOf(pane));

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
  // A pane's own refusal: a feature's write names its folder, the default branch's none.
  const refusedIn = (branch: string) => {
    const folder = panes?.find((pane) => pane.branch === branch)?.folder ?? undefined;
    return writes.some((write) => refusedAt(write, here) && write.folder === folder);
  };
  const [outcome, setOutcome] = useState<Outcome>();
  // The messages the human rewrote, by branch, the others following the core's suggestion, with
  // the pane's lines when it was committed: the commit lands behind the page, and once they change,
  // its message goes, for good. A refusal of the pane's commit keeps it, for the next try.
  const [typed, setTyped] = useState<Readonly<Record<string, Typed>>>({});
  const gone = Object.keys(typed).filter(
    (branch) =>
      panes !== undefined &&
      landed(
        typed[branch]!,
        panes.find((pane) => pane.branch === branch),
        refusedIn(branch),
      ),
  );
  const goneKey = gone.join("\n");
  useEffect(() => {
    if (goneKey !== "") {
      const drop = new Set(goneKey.split("\n"));
      setTyped((now) => Object.fromEntries(Object.entries(now).filter(([b]) => !drop.has(b))));
    }
  }, [goneKey]);
  const messageOf = (pane: CommitPane) => {
    const kept = typed[pane.branch];
    return kept && !gone.includes(pane.branch) ? kept.message : pane.message;
  };
  /** Sets a pane's message, or with `undefined`, takes the suggestion back. */
  const setMessage = (branch: string, message: string | undefined) =>
    setTyped(({ [branch]: _, ...others }) =>
      message === undefined ? others : { ...others, [branch]: { message } },
    );

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
    setTyped(({ [pane.branch]: kept, ...others }) =>
      kept ? { ...others, [pane.branch]: { ...kept, landing: linesOf(pane) } } : others,
    );
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
  return { commit, discard, messageOf, outcome, setMessage };
}
