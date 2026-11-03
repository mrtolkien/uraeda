// The Commit page's writes: a pane's Commit, with its message as the human left it, and its
// Discard, which asks first. The messages the human rewrote are kept by branch until their commit
// lands: a hook's refusal, which comes after the call returns, leaves the message as typed.
import { useState } from "react";
import { useFateClient } from "react-fate";
import { rereadChanges } from "../data.ts";
import { refusal } from "../errors.ts";
import { discardChanges, useConfirm } from "../fields/Confirm.tsx";
import { plural } from "../labels.ts";
import { closeUndoToasts } from "../layout/useUndoToast.ts";
import { PrioritiesView } from "../views.ts";
import { useClearRefusal, useRefusal, writeHere } from "../writes/useWriteQueue.ts";
import type { CommitPane } from "./BranchPane.tsx";

/** The page's last write: done, or refused, in the pane of `branch`. */
export type Outcome = { branch?: string; ok: boolean; text: string };

/** A message the human typed, and the pane's lines as its commit was made, while it lands. */
type Typed = { landing?: string; message: string };

/** A pane's lines as one key: they change once its commit lands. */
const linesOf = (pane: CommitPane) => pane.lines.join("\n");

/** Each pane's message, and its Commit and Discard, for the page at `here`. */
export function usePaneWrites(here: { href: string }) {
  const fate = useFateClient();
  const confirm = useConfirm();
  const clearRefusal = useClearRefusal(here);
  const refused = useRefusal(here) !== undefined;
  const [outcome, setOutcome] = useState<Outcome>();
  // The messages the human rewrote, by branch, the others following the core's suggestion, with
  // the pane's lines when it was committed: the commit lands behind the page, and once they change,
  // its message goes. A refusal shown here keeps it, for the next try.
  const [typed, setTyped] = useState<Readonly<Record<string, Typed>>>({});
  const messageOf = (pane: CommitPane) => {
    const kept = typed[pane.branch];
    const landed = kept?.landing !== undefined && !refused && kept.landing !== linesOf(pane);
    return kept && !landed ? kept.message : pane.message;
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
