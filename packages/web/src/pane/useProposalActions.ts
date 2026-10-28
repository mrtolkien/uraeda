// What a proposal's pane does to it: rename it, move it to a section, expand it into a file, or
// delete it with Undo, each written at once over the priorities as read.
import { useState } from "react";
import { useFateClient } from "react-fate";
import { readPrioritiesHash, useProposal } from "../data.ts";
import { guarded, refusal } from "../errors.ts";
import { useUndoToast } from "../layout/useUndoToast.ts";
import { currentEntry, parseLocation, redirect, useRepoPath } from "../routes.tsx";
import { closeDetail } from "./DetailOverlay.tsx";
import { plain } from "../Spans.tsx";
import { useMoveTo } from "./useMoveTo.ts";
import { useExpand, useStartChange } from "./useStartChange.ts";
import { PrioritiesView } from "../views.ts";

/** A proposal found in the priorities, with its section and its place in it. */
export type Found = NonNullable<ReturnType<typeof useProposal>["found"]>;

/**
 * What a proposal's or a note's editor asks of the actions: see `useProposalActions` and
 * `useNoteActions`.
 */
export type ActionOptions = { onRenamed?: (key: string) => void; redirects?: boolean };

/**
 * The page an overlay was opened from, within its repository, which it returns to once its
 * proposal is deleted.
 */
function origin() {
  return currentEntry().from === "/" ? "/" : "/priorities";
}

/**
 * Saves the proposal's new text, `rename`, over the priorities of `hash`: it resolves with the
 * refusal, if any, and otherwise tells `onRenamed` the proposal's key and follows it, as
 * `useProposalActions` says.
 */
function useRename(
  { proposal }: Found,
  hash: string,
  onRenaming: (id: string | undefined) => void,
  { onRenamed, redirects = true }: ActionOptions,
) {
  const fate = useFateClient();
  const here = useRepoPath();
  return async (text: string) => {
    onRenaming(proposal.id);
    const result = await guarded(() =>
      fate.mutations.proposals.edit({
        input: { hash, proposal: proposal.id, text },
        view: PrioritiesView,
      }),
    );
    if (result.error) {
      onRenaming(undefined);
      return refusal(result.error).message;
    }
    const key = result.result?.sections
      .flatMap((s) => s.proposals)
      .find((p) => p.id === proposal.id)?.key;
    if (key !== undefined) {
      onRenamed?.(key);
      if (redirects && key !== proposal.key) {
        redirect(here(`/priorities/${key}`));
      }
    }
    return undefined;
  };
}

/**
 * The pane's actions on `found`, over the priorities of `hash`, and the last refusal to show.
 * `onRenaming` gets the proposal's id while its text is saved, as its key changes before its
 * address does, and nothing once the save is refused. A rename that changes the proposal's key
 * follows it to its new address, unless `redirects` is `false`, as for an editor in a card of a
 * list, which leaves the page as it is. `onRenamed` gets the proposal's new key once a rename is
 * saved.
 */
export function useProposalActions(
  found: Found,
  hash: string,
  onRenaming: (id: string | undefined) => void,
  options: ActionOptions = {},
) {
  const { index, proposal, section } = found;
  const fate = useFateClient();
  const toast = useUndoToast();
  const here = useRepoPath();
  const rename = useRename(found, hash, onRenaming, options);
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
        void fate.request(
          { priorities: { id: "priorities", view: PrioritiesView } },
          { mode: "network-only" },
        );
      }
    }
    return result;
  };

  const move = (to: string) =>
    run(() =>
      fate.mutations.proposals.move({
        input: { hash, index: Number.MAX_SAFE_INTEGER, proposal: proposal.id, section: to },
        view: PrioritiesView,
      }),
    );

  const remove = async () => {
    const text = plain(proposal.spans);
    // What Undo writes back: the proposal's lines, nested ones included, exactly as they were.
    const { lines } = proposal;
    const at = { index, section: section.section };
    const result = await run(() =>
      fate.mutations.proposals.remove({
        input: { hash, proposal: proposal.id },
        view: PrioritiesView,
      }),
    );
    if (result.error) {
      return;
    }
    const failed = `Could not restore "${text}": PRIORITIES.md changed on disk.`;
    toast(`Deleted "${text}"`, async () => {
      try {
        // Over the file as it is now: the proposal goes back to its place, or its section's end.
        const now = await readPrioritiesHash(fate);
        const restored = await fate.mutations.proposals.insert({
          input: { ...at, hash: now, lines },
          view: PrioritiesView,
        });
        return restored.error ? failed : undefined;
      } catch {
        return failed;
      }
    });
    // Only while the proposal's own overlay shows: a delete from a menu leaves the page as it is.
    if (parseLocation(window.location.pathname).route.page === "proposal") {
      closeDetail(here(origin()));
    }
  };

  return {
    expand: useExpand(proposal.id, hash, run),
    message,
    move,
    moveTo: useMoveTo(found, hash, run),
    remove,
    rename,
    startChange: useStartChange(proposal.id, hash, run),
  };
}
