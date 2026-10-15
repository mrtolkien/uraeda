// The records each page reads: requested by id, kept up to date by the server's live updates, and
// read again when the page is shown again, as iOS may have dropped its connection.
import { useEffect } from "react";
import { useFateClient, useLiveView, useRequest, useView } from "react-fate";
import type { Priorities, Trigger } from "uraeda-server/fate";
import {
  AgentView,
  BranchChangesView,
  DraftView,
  FeatureView,
  FileView,
  FolderSuggestionsView,
  PrioritiesView,
  ProposalHintsView,
  RepositoriesView,
  SessionListView,
  SessionSearchView,
  SessionView,
  SlugProposalView,
  TurnLogView,
  TurnView,
  WorkflowMessageView,
  WorkspaceView,
} from "./views.ts";

/** The ids of the records there is one of, as the server names them. */
const WORKSPACE_ID = "workspace";
const PRIORITIES_ID = "priorities";
const AGENT_ID = "agent";
const SESSION_LIST_ID = "all";
const PROPOSAL_HINTS_ID = "proposal";
const REPOSITORIES_ID = "repositories";

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

/** The files changed on a feature's branch, outside its folder, by the feature's folder. */
export function useBranchChanges(folder: string) {
  const request = { branchChanges: { id: folder, view: BranchChangesView } };
  const { branchChanges } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(BranchChangesView, branchChanges);
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

/** The agent sessions run on: whether it works on the server's machine, and what it can do. */
export function useAgent() {
  const request = { agent: { id: AGENT_ID, view: AgentView } };
  const { agent } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(AgentView, agent);
}

/** A session, without its turns. */
export function useSession(id: string) {
  const request = { session: { id, view: SessionView } };
  const { session } = useRequest(request);
  useRefreshOnShow(request);
  const live = useLiveView(SessionView, session);
  useReadOnceLive(request, id, true);
  return live;
}

/** How long a view's live subscription may take to reach the server once asked for. */
const SUBSCRIBED_MS = 1000;

/**
 * Reads a record again as its view starts listening to its live updates, and once more when the
 * subscription has surely reached the server, when `enabled`: a session just created by a send is
 * drawn from the send's answer, and a reply that ended its turn before the view listened would
 * leave it working past SC-002's second. Once per record shown.
 */
function useReadOnceLive(request: Parameters<typeof useRequest>[0], id: string, enabled: boolean) {
  const fate = useFateClient();
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const read = () =>
      void fate.request(request as never, { mode: "network-only" }).catch(() => {});
    read();
    const timer = setTimeout(read, SUBSCRIBED_MS);
    return () => clearTimeout(timer);
    // Once per record: `request` is a new object at each draw.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [fate, id, enabled]);
}

/**
 * A turn of a session, without its items. `latest`, for the session's latest turn, which may still
 * go on: read again once live, as a session is.
 */
export function useTurn(id: string, latest = false) {
  const request = { turn: { id, view: TurnView } };
  const { turn } = useRequest(request);
  useRefreshOnShow(request);
  const live = useLiveView(TurnView, turn);
  useReadOnceLive(request, id, latest);
  return live;
}

/** A page of a turn's items, `<turn>:<page>`, of 100 items; `latest` as for `useTurn`. */
export function useTurnLog(id: string, latest = false) {
  const request = { turnLog: { id, view: TurnLogView } };
  const { turnLog } = useRequest(request);
  useRefreshOnShow(request);
  const live = useLiveView(TurnLogView, turnLog);
  useReadOnceLive(request, id, latest);
  return live;
}

/**
 * What the navigation reads: the workspace's features and the sessions' list, in one request, so
 * the shell waits for them once.
 */
export function useNavigation() {
  const request = {
    sessionList: { id: SESSION_LIST_ID, view: SessionListView },
    workspace: { id: WORKSPACE_ID, view: WorkspaceView },
  };
  const { sessionList, workspace } = useRequest(request);
  useRefreshOnShow(request);
  return {
    sessionList: useLiveView(SessionListView, sessionList),
    workspace: useLiveView(WorkspaceView, workspace),
  };
}

/** The sessions whose title or messages hold the query: read again as the query changes. */
export function useSessionSearch(query: string) {
  const request = { sessionSearch: { id: query, view: SessionSearchView } };
  const { sessionSearch } = useRequest(request);
  useRefreshOnShow(request);
  return useView(SessionSearchView, sessionSearch);
}

/** The workflow's message for a feature and a trigger, or why there is none. */
export function useWorkflowMessage(folder: string, trigger: Trigger, file?: string) {
  const id = [folder, trigger, ...(file === undefined ? [] : [file])].join(":");
  const request = { workflowMessage: { id, view: WorkflowMessageView } };
  const { workflowMessage } = useRequest(request);
  useRefreshOnShow(request);
  return useView(WorkflowMessageView, workflowMessage);
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
 * The slug the core proposes for a typed change's whole text, which it reads the title in (R14):
 * empty for a text with no title. Read once per text.
 */
export function useSlugProposal(text: string) {
  const { slugProposal } = useRequest({ slugProposal: { id: text, view: SlugProposalView } });
  return useView(SlugProposalView, slugProposal)?.slug ?? "";
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
        return { entry: section.entries[index], index, section };
      }
    }
    return undefined;
  };
  const found = find((entry) => entry.key === key) ?? (id ? find((e) => e.id === id) : undefined);
  return { found, priorities };
}

/**
 * The list of repositories, most recently opened first, and why `repositories.json` could not be
 * read: the same from every endpoint, kept up to date as the list changes.
 */
export function useRepositories() {
  const request = { repositories: { id: REPOSITORIES_ID, view: RepositoriesView } };
  const { repositories } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(RepositoriesView, repositories);
}

/**
 * The folders whose path starts with a typed text, `~/dev/to` for one, those in git marked: read
 * once per text, so at most one request is in flight for it, and kept for the form's life.
 */
export function useFolderSuggestions(text: string) {
  const { folderSuggestions } = useRequest({
    folderSuggestions: { id: text, view: FolderSuggestionsView },
  });
  return useView(FolderSuggestionsView, folderSuggestions)?.rows ?? [];
}

/**
 * A feature, a session, or a turn, from the cache, read from the server only when missing, and
 * kept up to date by its live updates: for what is drawn beside the page that reads the record and
 * reads it again, like the session's announcer, without reading it a second time.
 */
export function useFeatureFollowed(folder: string) {
  const { feature } = useRequest({ feature: { id: folder, view: FeatureView } });
  return useLiveView(FeatureView, feature);
}

/** A session, as `useFeatureFollowed` reads a feature. */
export function useSessionFollowed(id: string) {
  const { session } = useRequest({ session: { id, view: SessionView } });
  return useLiveView(SessionView, session);
}

/** A turn, without its items, as `useFeatureFollowed` reads a feature. */
export function useTurnFollowed(id: string) {
  const { turn } = useRequest({ turn: { id, view: TurnView } });
  return useLiveView(TurnView, turn);
}
