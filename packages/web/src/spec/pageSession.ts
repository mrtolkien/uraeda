// The session of a spec's or a plan's page: the composer's draft, kept by the page while its
// column comes and goes, its Session tab, and how "Ask the agent" reaches it.
import { sessionTab, useColumnAsk } from "../ColumnSession.tsx";
import { useAgent, useFeature } from "../data.ts";
import type { ColumnTab } from "../layout/DocumentColumn.tsx";
import { useDraft } from "../useDraft.ts";
import type { File } from "./parts.ts";

/** A page's session: its column's Session tab, and asking the agent with a quote. */
export type PageSession = { ask: (quote: string) => void; tab: ColumnTab };

/**
 * The session of `file`'s page, where the feature's agent is available and the feature has its
 * branch: none without an agent, or for a file on the default branch, whose feature has no
 * session to ask in.
 */
export function usePageSession(file: File): PageSession | undefined {
  const agent = useAgent();
  const feature = useFeature(file.folder);
  const draft = useDraft();
  const ask = useColumnAsk(file.folder, draft);
  if (!agent?.available || !feature || feature.missing || !feature.branch) {
    return undefined;
  }
  return { ask, tab: sessionTab(draft, file.folder, agent.kind) };
}
