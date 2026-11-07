// A proposal line expanded into a file, which opens in the editor, recorded on the undo stack.
import { useFateClient } from "react-fate";
import { useRecordExpand } from "../lists/prioritiesUndo.ts";
import { navigate, useRepoPath } from "../routes.tsx";
import { ProposalFileChangeView } from "../undo/changeViews.ts";

/**
 * Expands the proposal `proposal` of the priorities of `hash`, whose text is `text`, into a file,
 * and opens it. `run` shows a refusal in the pane.
 */
export function useExpand(
  proposal: string,
  hash: string,
  text: string,
  run: <R extends { error?: unknown }>(call: () => Promise<R>) => Promise<R>,
) {
  const fate = useFateClient();
  const here = useRepoPath();
  const recordExpand = useRecordExpand();
  return async () => {
    const result = await run(() =>
      fate.mutations.proposals.expand({ input: { hash, proposal }, view: ProposalFileChangeView }),
    );
    const path = result.result?.path;
    if (!result.error && typeof path === "string") {
      recordExpand(result.result, text);
      navigate(here(`/edit/${path}`));
    }
  };
}
