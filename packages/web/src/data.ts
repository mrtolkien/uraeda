// The records each page reads: requested by id, kept up to date by the server's live updates, and
// read again when the page is shown again, as iOS may have dropped its connection.
import { useEffect } from "react";
import { useFateClient, useLiveView, useRequest, useView } from "react-fate";
import type { Priorities } from "uraeda-server/fate";
import {
  DraftView,
  FeatureView,
  FileView,
  PrioritiesView,
  RunLogView,
  RunnerView,
  RunView,
  ProposalHintsView,
  WorkspaceView,
} from "./views.ts";

/** The ids of the records there is one of, as the server names them. */
const WORKSPACE_ID = "workspace";
const PRIORITIES_ID = "priorities";
const RUNNER_ID = "runner";
const PROPOSAL_HINTS_ID = "proposal";

/** Reads a request again from the server when the page comes back to the foreground. */
function useRefreshOnShow(request: Parameters<typeof useRequest>[0]) {
  const fate = useFateClient();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        void fate.request(request as never, { mode: "network-only" }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [fate, request]);
}

export function useWorkspace() {
  const request = { workspace: { id: WORKSPACE_ID, view: WorkspaceView } };
  const { workspace } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(WorkspaceView, workspace);
}

export function useFeature(folder: string) {
  const request = { feature: { id: folder, view: FeatureView } };
  const { feature } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(FeatureView, feature);
}

export function useFile(folder: string, name: string) {
  const request = { workflowFile: { id: `${folder}/${name}`, view: FileView } };
  const { workflowFile } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(FileView, workflowFile);
}

export function usePriorities() {
  const request = { priorities: { id: PRIORITIES_ID, view: PrioritiesView } };
  const { priorities } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(PrioritiesView, priorities);
}

/**
 * The priorities as they are now on disk, read outside a component: for a change made after
 * others, like an Undo.
 */
export async function readPriorities(
  fate: ReturnType<typeof useFateClient>,
): Promise<Pick<Priorities, "hash" | "sections">> {
  const { priorities } = await fate.request(
    { priorities: { id: PRIORITIES_ID, view: PrioritiesView } },
    { mode: "network-only" },
  );
  const { data } = await fate.readView(PrioritiesView, priorities);
  // fate types the request's root as any entity: the view gives the priorities' fields.
  return data as unknown as Pick<Priorities, "hash" | "sections">;
}

/** The hash of the priorities as they are now on disk: see `readPriorities`. */
export async function readPrioritiesHash(fate: ReturnType<typeof useFateClient>): Promise<string> {
  return (await readPriorities(fate)).hash;
}

export function useDraft(path: string) {
  const request = { draft: { id: path, view: DraftView } };
  const { draft } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(DraftView, draft);
}

/** Whether the agent works on the server's machine. */
export function useRunner() {
  const request = { runner: { id: RUNNER_ID, view: RunnerView } };
  const { runner } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(RunnerView, runner);
}

/** A run of an agent, without its log. */
export function useRun(id: string) {
  const request = { run: { id, view: RunView } };
  const { run } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(RunView, run);
}

/** A page of a run's log, `<run>:<page>`, of 100 events. */
export function useRunLog(id: string) {
  const request = { runLog: { id, view: RunLogView } };
  const { runLog } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(RunLogView, runLog);
}

/**
 * The proposal template's guidance for each section, by heading, which the editor shows in an empty
 * section. It ships with the tool, so it is read once.
 */
export function useProposalHints() {
  const { proposalHints } = useRequest({
    proposalHints: { id: PROPOSAL_HINTS_ID, view: ProposalHintsView },
  });
  return useView(ProposalHintsView, proposalHints)?.hints ?? [];
}

/**
 * A line of `PRIORITIES.md` by its key, with its section and its place in it: the priorities as
 * read, and `found` once the line is there. `id`, when given, finds the line by its place when its
 * key is gone, as right after its own rename.
 */
export function usePriority(key: string, id?: string) {
  const priorities = usePriorities();
  const sections = priorities?.sections ?? [];
  const find = (match: (entry: (typeof sections)[number]["entries"][number]) => boolean) => {
    for (const section of sections) {
      const index = section.entries.findIndex(match);
      if (index >= 0) {
        return { entry: section.entries[index], section, index };
      }
    }
    return undefined;
  };
  const found = find((entry) => entry.key === key) ?? (id ? find((e) => e.id === id) : undefined);
  return { priorities, found };
}
