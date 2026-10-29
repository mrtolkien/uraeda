// A proposal line expanded into a file, which opens in the editor.
import { useFateClient } from "react-fate";
import { navigate, useRepoPath } from "../routes.tsx";
import { ProposalFileView } from "../views.ts";

/**
 * Expands the proposal `proposal` of the priorities of `hash` into a file, and opens it. `run`
 * shows a refusal in the pane.
 */
export function useExpand(
  proposal: string,
  hash: string,
  run: <R extends { error?: unknown }>(call: () => Promise<R>) => Promise<R>,
) {
  const fate = useFateClient();
  const here = useRepoPath();
  return async () => {
    const result = await run(() =>
      fate.mutations.proposals.expand({ input: { hash, proposal }, view: ProposalFileView }),
    );
    const path = (result as { result?: { path?: unknown } }).result?.path;
    if (!result.error && typeof path === "string") {
      navigate(here(`/edit/${path}`));
    }
  };
}
