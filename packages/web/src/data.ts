// The records each page reads: requested by id, kept up to date by the server's live updates, and
// read again when the page is shown again, as iOS may have dropped its connection.
import { useEffect, useState } from "react";
import type { StoryTarget } from "uraeda-binding";
import { useFateClient, useLiveView, useRequest, useView, type ViewRef } from "react-fate";
import type { Draft, Inbox, Priorities, Trigger } from "uraeda-server/fate";
import {
  AgentView,
  BranchChangesView,
  DraftTitleView,
  DraftView,
  FeatureView,
  FileView,
  FolderSuggestionsView,
  InboxView,
  PreviewView,
  PrioritiesView,
  ProposalHintsView,
  NeedsYouView,
  RepositoriesView,
  SessionView,
  SettingsRecordView,
  SlugProposalView,
  StoryHrefView,
  StoryView,
  TurnView,
  WorkflowMessageView,
  WorkspaceView,
} from "./views.ts";

/** The ids of the records there is one of, as the server names them. */
export const WORKSPACE_ID = "workspace";
const PRIORITIES_ID = "priorities";
const INBOX_ID = "inbox";
/** The inbox's triage, among workflow files: it has no feature folder. */
const TRIAGE_ID = "inbox-triage";
const AGENT_ID = "agent";
const PROPOSAL_HINTS_ID = "proposal";
const REPOSITORIES_ID = "repositories";
const SETTINGS_ID = "settings";
const NEEDS_YOU_ID = "all";

/** Reads a request again from the server when the page comes back to the foreground. */
export function useRefreshOnShow(request: Parameters<typeof useRequest>[0]) {
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

/** The inbox's triage, `specs/INBOX-TRIAGE.md`, as a round of questions: missing until written. */
export function useTriage() {
  const request = { workflowFile: { id: TRIAGE_ID, view: FileView } };
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

/** `INBOX.md`'s notes, by category, as the default branch has them. */
export function useInbox() {
  const request = { inbox: { id: INBOX_ID, view: InboxView } };
  const { inbox } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(InboxView, inbox);
}

/** The inbox as it is now on disk, read outside a component: for an Undo, as `readPriorities`. */
export async function readInbox(
  fate: ReturnType<typeof useFateClient>,
): Promise<Pick<Inbox, "categories" | "hash">> {
  const { inbox } = await fate.request(
    { inbox: { id: INBOX_ID, view: InboxView } },
    { mode: "network-only" },
  );
  const { data } = await fate.readView(InboxView, inbox);
  // fate types the request's root as any entity: the view gives the inbox's fields.
  return data as unknown as Pick<Inbox, "categories" | "hash">;
}

/**
 * The commit bar's count, which `Inbox` and `Priorities` both carry, read again with both files
 * after a change of the other, like a move across them, a commit, or a discard.
 */
export function rereadChanges(fate: ReturnType<typeof useFateClient>) {
  void fate
    .request(
      {
        inbox: { id: INBOX_ID, view: InboxView },
        priorities: { id: PRIORITIES_ID, view: PrioritiesView },
      },
      { mode: "network-only" },
    )
    .catch(() => {});
}

/**
 * The titles of the drafts and backlog files at `paths`, read in one request once they are asked
 * for, and again when the list changes; `undefined` while they load.
 */
export function useDraftTitles(
  paths: ReadonlyArray<string>,
): ReadonlyArray<Pick<Draft, "path" | "title">> | undefined {
  const fate = useFateClient();
  const [titles, setTitles] = useState<{
    key: string;
    rows: Array<Pick<Draft, "path" | "title">>;
  }>();
  // The list, as one value, so a new array of the same paths reads nothing again.
  const key = paths.join("\n");
  useEffect(() => {
    let current = true;
    const ids = key === "" ? [] : key.split("\n");
    void (async () => {
      const { drafts } = await fate.request({ drafts: { ids, view: DraftTitleView } });
      const rows = await Promise.all(
        (drafts as ReadonlyArray<Parameters<typeof fate.readView>[1]>).map(
          async (draft) => (await fate.readView(DraftTitleView, draft)).data,
        ),
      );
      if (current) {
        // fate types a root's records as any entity: the view gives the drafts' fields.
        setTitles({ key, rows: rows as unknown as Array<Pick<Draft, "path" | "title">> });
      }
    })().catch(() => {});
    return () => {
      current = false;
    };
  }, [fate, key]);
  return titles?.key === key ? titles.rows : undefined;
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
 * The server's settings, as it applies them, and the file's: the same from every endpoint, read
 * on the client the caller is under, kept up to date as the file changes.
 */
export function useSettings() {
  const request = { settings: { id: SETTINGS_ID, view: SettingsRecordView } };
  const { settings } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(SettingsRecordView, settings);
}

/**
 * What needs the human across every repository, read on the global endpoint: the items, each with
 * its key, which changes with what it asks, kept up to date.
 */
export function useNeedsYou() {
  const request = { needsYouList: { id: NEEDS_YOU_ID, view: NeedsYouView } };
  const { needsYouList } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(NeedsYouView, needsYouList);
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

/** How often a record drawn on screen is read again, so the server knows it is still viewed. */
export const STILL_VIEWED_MS = 5 * 60_000;

/** The records a request reads, by name and id: two requests of the same records are one. */
function requestKey(request: Parameters<typeof useRequest>[0]): string {
  return Object.entries(request as Record<string, { id?: unknown }>)
    .map(([name, { id }]) => `${name}:${String(id)}`)
    .join("\n");
}

/**
 * Reads a request again, from the server, every 5 minutes while its component is drawn and its page
 * shows: a read is a view, and a Storybook stops after 30 minutes without one. A hidden page asks
 * nothing; it asks again as it shows, through `useRefreshOnShow`. The request asked again is the one
 * the component draws now, by the records it reads.
 */
export function useStillViewed(request: Parameters<typeof useRequest>[0]) {
  const fate = useFateClient();
  const key = requestKey(request);
  const [held, setHeld] = useState({ key, request });
  if (held.key !== key) {
    setHeld({ key, request });
  }
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void fate.request(held.request as never, { mode: "network-only" }).catch(() => {});
      }
    }, STILL_VIEWED_MS);
    return () => clearInterval(timer);
  }, [fate, held]);
}

/**
 * A story link of a checkout, by its folder, `main` for the main checkout, kept up to date as its
 * Storybook starts, fails, or stops. Each draw's first read goes to the server, as a view, while the
 * cached record shows; it is read again while it is drawn.
 */
export function useStory(folder: string, story: StoryTarget) {
  const request = { story: { id: `${folder}:${story.path}#${story.export}`, view: StoryView } };
  const { story: record } = useRequest(request, { mode: "stale-while-revalidate" });
  useRefreshOnShow(request);
  useStillViewed(request);
  return useLiveView(StoryView, record);
}

/**
 * A checkout's Storybook, by its folder, `main` for the main checkout, kept up to date as it starts,
 * fails, or stops: reading it is a view, as `useStory`'s, and it is read again while it is drawn.
 */
export function usePreview(folder: string) {
  const request = { preview: { id: folder, view: PreviewView } };
  const { preview } = useRequest(request, { mode: "stale-while-revalidate" });
  useRefreshOnShow(request);
  useStillViewed(request);
  return useLiveView(PreviewView, preview);
}

/** The story an agent's link, by its href, points to, as the core reads it, if any. */
export function useStoryHref(href: string): StoryTarget | undefined {
  const { storyHref } = useRequest({ storyHref: { id: href, view: StoryHrefView } });
  const link = useView(StoryHrefView, storyHref);
  return link.path === null || link.export === null
    ? undefined
    : { export: link.export, path: link.path };
}

/** The folder of the main checkout's stories and Storybook, as the server names it. */
export const MAIN_CHECKOUT = "main";

/**
 * Whether a checkout has an active preview decision, by its folder, `main` for the main checkout:
 * its feature's, or the workspace's, from the cache when there. Reading it starts nothing.
 */
export function usePreviewOn(folder: string): boolean {
  const main = folder === MAIN_CHECKOUT;
  const request = main
    ? { workspace: { id: WORKSPACE_ID, view: WorkspaceView } }
    : { feature: { id: folder, view: FeatureView } };
  // One request of either record: the hooks below are the same whichever it is.
  const result = useRequest(request as never) as {
    feature?: ViewRef<"Feature">;
    workspace?: ViewRef<"Workspace">;
  };
  const feature = useLiveView(FeatureView, result.feature ?? null);
  const workspace = useLiveView(WorkspaceView, result.workspace ?? null);
  return (main ? workspace?.preview : feature?.preview) ?? false;
}
