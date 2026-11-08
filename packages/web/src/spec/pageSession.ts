// The session of a spec's or a plan's page: the composer's draft, the feature's, kept while its
// column comes and goes and on the session's page, its Session tab, and how "Ask the agent" reaches it.
import { sessionTab, useColumnAsk } from "../ColumnSession.tsx";
import { useFeature } from "../data.ts";
import { useHarnessMark } from "../HarnessMark.tsx";
import { runtimeRefusal, useRuntime } from "../runtimes.ts";
import { useRepositoryPath } from "../routes.tsx";
import type { ColumnPanel } from "../layout/DocumentColumn.tsx";
import { featureDraftKey, useDraft } from "../useDraft.ts";
import type { File } from "./parts.ts";

/** A page's session: its column's Session tab, and asking the agent with a quote. */
export type PageSession = { ask: (quote: string) => void; tab: ColumnPanel };

/**
 * The session of `file`'s page, where the feature's agent is available and the feature has its
 * branch: none without an agent, or for a file on the default branch, whose feature has no
 * session to ask in.
 */
export function usePageSession(file: File): PageSession | undefined {
  const feature = useFeature(file.folder);
  // The runtime the feature's runs go to: its latest session's.
  const choice = useRuntime(feature?.runtime);
  const { icon } = useHarnessMark(choice.runtime?.kind ?? "");
  // The feature's session draft, which the round's column and the session's page hold too.
  const draft = useDraft(featureDraftKey(useRepositoryPath(), file.folder));
  const ask = useColumnAsk(file.folder, draft);
  if (runtimeRefusal(choice) !== undefined || !feature || feature.missing || !feature.branch) {
    return undefined;
  }
  return { ask, tab: sessionTab(draft, file.folder, icon) };
}
