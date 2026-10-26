// What a priority's pane does to its line: rename it, move it to a section, draft it, or delete it
// with Undo, each written at once over the priorities as read.
import { useState } from "react";
import { useFateClient } from "react-fate";
import { readPrioritiesHash, usePriority } from "../data.ts";
import { guarded, refusal } from "../errors.ts";
import { useUndoToast } from "../layout/useUndoToast.ts";
import { currentEntry, parseLocation, redirect, useLocalPath, useRepoPath } from "../routes.tsx";
import { closeDetail } from "./DetailOverlay.tsx";
import { plain } from "../Spans.tsx";
import { useMoveTo } from "./useMoveTo.ts";
import { useDraft, useStartChange } from "./useStartChange.ts";
import { PrioritiesView } from "../views.ts";

/** A line found in the priorities, with its section and its place in it. */
export type Found = NonNullable<ReturnType<typeof usePriority>["found"]>;

/**
 * The page an overlay was opened from, within its repository, which it returns to once its line
 * is deleted.
 */
function origin() {
  return currentEntry().from === "/" ? "/" : "/priorities";
}

/**
 * The pane's actions on `found`, over the priorities of `hash`, and the last refusal to show.
 * `onRenaming` gets the line's id while its text is saved, as its key changes before its address
 * does, and nothing once the save is refused.
 */
export function usePriorityActions(
  found: Found,
  hash: string,
  onRenaming: (id: string | undefined) => void,
) {
  const { entry, index, section } = found;
  const fate = useFateClient();
  const toast = useUndoToast();
  const here = useRepoPath();
  const pathname = useLocalPath();
  const [message, setMessage] = useState<string>();

  /** Runs a change of the line: a refusal shows in the pane, and a conflict reloads the list. */
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

  const rename = async (text: string) => {
    onRenaming(entry.id);
    const result = await guarded(() =>
      fate.mutations.priorities.edit({
        input: { entry: entry.id, hash, text },
        view: PrioritiesView,
      }),
    );
    if (result.error) {
      onRenaming(undefined);
      return refusal(result.error).message;
    }
    const key = result.result?.sections
      .flatMap((s) => s.entries)
      .find((e) => e.id === entry.id)?.key;
    // Only the line's own overlay follows it: the list's editor in place leaves the page as it is.
    if (key && key !== entry.key && pathname === `/priorities/${entry.key}`) {
      redirect(here(`/priorities/${key}`));
    }
    return undefined;
  };

  const move = (to: string) =>
    run(() =>
      fate.mutations.priorities.move({
        input: { entry: entry.id, hash, index: Number.MAX_SAFE_INTEGER, section: to },
        view: PrioritiesView,
      }),
    );

  const remove = async () => {
    const text = plain(entry.spans);
    // What Undo writes back: the line's lines, nested ones included, exactly as they were.
    const { lines } = entry;
    const at = { index, section: section.section };
    const result = await run(() =>
      fate.mutations.priorities.remove({ input: { entry: entry.id, hash }, view: PrioritiesView }),
    );
    if (result.error) {
      return;
    }
    const failed = `Could not restore "${text}": PRIORITIES.md changed on disk.`;
    toast(`Deleted "${text}"`, async () => {
      try {
        // Over the file as it is now: the line goes back to its place, or its section's end.
        const now = await readPrioritiesHash(fate);
        const restored = await fate.mutations.priorities.insert({
          input: { ...at, hash: now, lines },
          view: PrioritiesView,
        });
        return restored.error ? failed : undefined;
      } catch {
        return failed;
      }
    });
    // Only while the line's own overlay shows: a delete from a menu leaves the page as it is.
    if (parseLocation(window.location.pathname).route.page === "task") {
      closeDetail(here(origin()));
    }
  };

  return {
    draft: useDraft(entry.id, hash, run),
    message,
    move,
    moveTo: useMoveTo(found, hash, run),
    remove,
    rename,
    startChange: useStartChange(entry.id, hash, run),
  };
}
