// What a proposal's pane does to it: rename it, move it to a section, expand it into a file, or
// delete it, each written at once over the priorities as read, and recorded on the undo stack.
import { useState } from "react";
import { useFateClient } from "react-fate";
import { readPriorities, useProposal } from "../data.ts";
import { guarded, refusal } from "../errors.ts";
import { currentEntry, parseLocation, redirect, useRepoPath } from "../routes.tsx";
import { closeDetail } from "./DetailOverlay.tsx";
import { proposalEdited, proposalMoved, proposalRemoved } from "../optimisticLists.ts";
import { usePrioritiesUndo } from "../lists/prioritiesUndo.ts";
import { titleOf } from "../QuickAdd.tsx";
import { plain } from "../Spans.tsx";
import { useExpand } from "./useExpand.ts";
import { PrioritiesChangeView } from "../undo/changeViews.ts";
import { quoted } from "../undo/quoted.ts";
import { PrioritiesView } from "../views.ts";

/** A proposal found in the priorities, with its section and its place in it. */
export type Found = NonNullable<ReturnType<typeof useProposal>["found"]>;

/**
 * The page an overlay was opened from, within its repository, which it returns to once its
 * proposal is deleted.
 */
function origin() {
  return currentEntry().from === "/" ? "/" : "/priorities";
}

type Sections = Awaited<ReturnType<typeof readPriorities>>["sections"];

/**
 * fate's optimistic result of a write, `shown` from the priorities the browser holds, if it holds
 * them.
 */
async function shownAs(
  fate: ReturnType<typeof useFateClient>,
  shown: (sections: Sections) => object | undefined,
) {
  const now = await readPriorities(fate, "cache-first").catch(() => undefined);
  const optimistic = now && shown(now.sections);
  return optimistic ? { optimistic } : {};
}

/**
 * Saves the proposal's new text, `rename`, over the priorities of `hash`: it resolves with the
 * refusal, if any, and otherwise follows the proposal to its new address, as `useProposalActions`
 * says.
 */
function useRename(
  { proposal }: Found,
  hash: string,
  onRenaming: (id: string | undefined) => void,
) {
  const fate = useFateClient();
  const recorded = usePrioritiesUndo();
  const here = useRepoPath();
  return async (text: string) => {
    onRenaming(proposal.id);
    const shown = await shownAs(fate, (sections) => proposalEdited(sections, proposal.id, text));
    // Named by its old text, and its refusal by its new one, which the file holds once renamed.
    const label = `Renamed ${quoted(plain(proposal.spans))}`;
    const subject = text;
    const result = await guarded(
      recorded(
        () =>
          fate.mutations.proposals.edit({
            input: { hash, proposal: proposal.id, text },
            ...shown,
            view: PrioritiesChangeView,
          }),
        { label, select: proposal.key, subject },
      ),
    );
    if (result.error) {
      onRenaming(undefined);
      return refusal(result.error).message;
    }
    const key = result.result?.sections
      .flatMap((s) => s.proposals)
      .find((p) => p.id === proposal.id)?.key;
    if (key !== undefined && key !== proposal.key) {
      redirect(here(`/priorities/${key}`));
    }
    return undefined;
  };
}

/**
 * The pane's actions on `found`, over the priorities of `hash`, and the last refusal to show.
 * `onRenaming` gets the proposal's id while its text is saved, as its key changes before its
 * address does, and nothing once the save is refused. A rename that changes the proposal's key
 * follows it to its new address.
 */
export function useProposalActions(
  found: Found,
  hash: string,
  onRenaming: (id: string | undefined) => void,
) {
  const { proposal } = found;
  const fate = useFateClient();
  const recorded = usePrioritiesUndo();
  const here = useRepoPath();
  const rename = useRename(found, hash, onRenaming);
  const [message, setMessage] = useState<string>();

  /**
   * Runs a change of the proposal: a refusal shows in the pane, and a conflict reloads the list.
   */
  const run = async <R extends { error?: unknown }>(call: () => Promise<R>) => {
    setMessage(undefined);
    const result = await guarded(call);
    if (result.error) {
      const failed = refusal(result.error);
      setMessage(failed.message);
      if (failed.kind === "conflict") {
        void fate
          .request(
            { priorities: { id: "priorities", view: PrioritiesView } },
            { mode: "network-only" },
          )
          .catch(() => {});
      }
    }
    return result;
  };

  const subject = plain(proposal.spans);

  /** Its section changed: a move of the priorities, which joins a run of their moves. */
  const move = async (to: string) => {
    const index = Number.MAX_SAFE_INTEGER;
    const shown = await shownAs(fate, (sections) =>
      proposalMoved(sections, proposal.id, to, index),
    );
    const label = `Moved ${quoted(subject)} to ${titleOf(to)}`;
    return run(
      recorded(
        () =>
          fate.mutations.proposals.move({
            input: { hash, index, proposal: proposal.id, section: to },
            ...shown,
            view: PrioritiesChangeView,
          }),
        { isMove: true, label, select: proposal.key, subject },
      ),
    );
  };

  const remove = async () => {
    const shown = await shownAs(fate, (sections) => proposalRemoved(sections, proposal.id));
    const label = `Deleted ${quoted(subject)}`;
    const result = await run(
      recorded(
        () =>
          fate.mutations.proposals.remove({
            input: { hash, proposal: proposal.id },
            ...shown,
            view: PrioritiesChangeView,
          }),
        { label, select: proposal.key, subject },
      ),
    );
    if (result.error) {
      return;
    }
    // Only while the proposal's own overlay shows: a delete from a menu leaves the page as it is.
    if (parseLocation(window.location.pathname).route.page === "proposal") {
      closeDetail(here(origin()));
    }
  };

  return {
    expand: useExpand(proposal, hash, subject, run),
    message,
    move,
    remove,
    rename,
  };
}
