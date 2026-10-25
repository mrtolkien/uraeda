// A priority's move to a place, as a card's menu asks it: written at once over the priorities as
// read, with a toast and an Undo that moves the line back where it was.
import { useFateClient } from "react-fate";
import { refusal } from "../errors.ts";
import { useUndoToast } from "../layout/useUndoToast.ts";
import { titleOf } from "../QuickAdd.tsx";
import { plain } from "../Spans.tsx";
import { PrioritiesView } from "../views.ts";
import type { Found } from "./usePriorityActions.ts";

/**
 * Moves the line `found` of the priorities of `hash` to `at` among the entries of a section, its
 * last for `Number.MAX_SAFE_INTEGER`. `run` writes a change and shows its refusal in the pane.
 * Resolves with the refusal, if any.
 */
export function useMoveTo(
  { entry, index, section }: Found,
  hash: string,
  run: <R extends { error?: unknown }>(call: () => Promise<R>) => Promise<R>,
) {
  const fate = useFateClient();
  const toast = useUndoToast();
  return async (to: string, at: number) => {
    const result = await run(() =>
      fate.mutations.priorities.move({
        input: { entry: entry.id, hash, index: at, section: to },
        view: PrioritiesView,
      }),
    );
    if (result.error) {
      return refusal(result.error).message;
    }
    // The line is now at `at` among the section's entries, or its last: its id is a place.
    const placed = result.result?.sections.find((s) => s.section === to)?.entries;
    const moved = placed?.[Math.min(at, placed.length - 1)];
    const text = plain(entry.spans);
    const failed = `Could not move "${text}" back: PRIORITIES.md changed on disk.`;
    if (moved !== undefined && result.result) {
      toast(`Moved "${text}" to ${titleOf(to)}`, async () => {
        try {
          // Over the file as the move left it: a changed file refuses, as an id is a place.
          const back = await fate.mutations.priorities.move({
            input: { entry: moved.id, hash: result.result.hash, index, section: section.section },
            view: PrioritiesView,
          });
          return back.error ? failed : undefined;
        } catch {
          return failed;
        }
      });
    }
    return undefined;
  };
}
