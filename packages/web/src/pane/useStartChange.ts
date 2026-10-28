// A proposal line started as a change: expanded into a file, then that file started as a change.
import { useFateClient } from "react-fate";
import { navigate, useRepoPath } from "../routes.tsx";
import { ProposalFileView, FeatureView } from "../views.ts";

/**
 * Expands the proposal `proposal` of the priorities of `hash` into a file, then starts that file
 * as a change, which moves the proposal to Now, and opens it. `run` shows a refusal in the pane.
 */
export function useStartChange(
  proposal: string,
  hash: string,
  run: <R extends { error?: unknown }>(call: () => Promise<R>) => Promise<R>,
) {
  const fate = useFateClient();
  const here = useRepoPath();
  return async () => {
    const expanded = await run(() =>
      fate.mutations.proposals.expand({ input: { hash, proposal }, view: ProposalFileView }),
    );
    const path = (expanded as { result?: { path?: unknown } }).result?.path;
    if (expanded.error || typeof path !== "string") {
      return;
    }
    const started = await run(() =>
      fate.mutations.feature.start({
        input: { kind: "change", proposal: path },
        view: FeatureView,
      }),
    );
    const folder = (started as { result?: { folder?: unknown } }).result?.folder;
    if (!started.error && typeof folder === "string") {
      navigate(here(`/f/${folder}`));
    }
  };
}

/** Expands the proposal `proposal` of the priorities of `hash` into a file, and opens it. */
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
