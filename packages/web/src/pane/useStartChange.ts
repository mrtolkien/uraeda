// A priority line started as a change: drafted, then its draft started as a change.
import { useFateClient } from "react-fate";
import { navigate, useRepoPath } from "../routes.tsx";
import { DraftView, FeatureView } from "../views.ts";

/**
 * Drafts the line `entry` of the priorities of `hash`, then starts that draft as a change, which
 * moves the line to Now, and opens it. `run` shows a refusal in the pane.
 */
export function useStartChange(
  entry: string,
  hash: string,
  run: <R extends { error?: unknown }>(call: () => Promise<R>) => Promise<R>,
) {
  const fate = useFateClient();
  const here = useRepoPath();
  return async () => {
    const drafted = await run(() =>
      fate.mutations.draft.create({ input: { hash, line: entry }, view: DraftView }),
    );
    const path = (drafted as { result?: { path?: unknown } }).result?.path;
    if (drafted.error || typeof path !== "string") {
      return;
    }
    const started = await run(() =>
      fate.mutations.feature.start({ input: { draft: path, kind: "change" }, view: FeatureView }),
    );
    const folder = (started as { result?: { folder?: unknown } }).result?.folder;
    if (!started.error && typeof folder === "string") {
      navigate(here(`/f/${folder}`));
    }
  };
}
