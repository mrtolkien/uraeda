import { homedir } from "node:os";
import { homePath, suggest } from "../folders.ts";
import { type Context, inRepository, type RepoContext, unlockedList } from "./context.ts";
import {
  checkoutDir,
  hasPreview,
  previewDataView,
  readPreview,
  readStory,
  readStoryHref,
  storyDataView,
  storyHrefDataView,
} from "./preview.ts";
import {
  agentRecord,
  featureRecord,
  readSession,
  readTurn,
  readTurnLog,
  readWorkflowMessage,
  sessionList,
  sessionSearch,
  working,
} from "./sessions.ts";
import { readSettingsRecord, settingsDataView } from "./settings.ts";
import { createSources, fileSource, type FileSourceReaders } from "./source.ts";
import {
  AGENT_ID,
  agentDataView,
  type BranchChangesRecord,
  branchChangesDataView,
  draftDataView,
  featureDataView,
  fileDataView,
  folderSuggestionsDataView,
  INBOX_ID,
  inboxDataView,
  PRIORITIES_ID,
  prioritiesDataView,
  PROPOSAL_HINTS_ID,
  proposalHintsDataView,
  REPOSITORIES_ID,
  repositoriesDataView,
  type RepositoriesRecord,
  type FeatureRecord,
  type FileRecord,
  sentChanges,
  sentFile,
  sentInbox,
  sentStep,
  SESSION_LIST_ID,
  sessionDataView,
  sessionListDataView,
  sessionSearchDataView,
  slugProposalDataView,
  TRIAGE_ID,
  turnDataView,
  turnLogDataView,
  workflowMessageDataView,
  type WorkspaceRecord,
  WORKSPACE_ID,
  workspaceDataView,
} from "./views.ts";

/** Reads each id, leaving out the ones that cannot be read. */
async function each<T>(ids: Array<string>, read: (id: string) => Promise<T>): Promise<Array<T>> {
  const results = await Promise.allSettled(ids.map(read));
  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

/** Every record of the ids that can be read, synchronously. */
async function found<T>(
  ids: Array<string>,
  read: (id: string) => Promise<T | undefined>,
): Promise<Array<T>> {
  return (await Promise.all(ids.map(read))).flatMap((record) => record ?? []);
}

async function workspace(ctx: RepoContext): Promise<WorkspaceRecord> {
  const read = await ctx.binding.readWorkspace(ctx.repo);
  const root = await checkoutDir(ctx);
  return {
    id: WORKSPACE_ID,
    ...read,
    features: read.features.map((feature) => ({ ...feature, step: sentStep(feature.step) })),
    preview: root !== undefined && (await hasPreview(ctx, root)),
    running: await working(ctx),
  };
}

/**
 * The list as the hosts last read it, and the read error of the file's last change. `added` is the
 * name `repositories.add` answers with.
 */
export function repositoriesRecord(ctx: Context, added: string | null = null): RepositoriesRecord {
  const home = homedir();
  return {
    added,
    id: REPOSITORIES_ID,
    problem: ctx.hosts.problem,
    rows: ctx.hosts.rows().map(({ missing, name, path }) => ({
      home: homePath(path, home),
      missing,
      name,
      path,
    })),
  };
}

/** The record of a file its feature does not have: marked missing, its other fields empty. */
function missingFile(id: string, folder: string, name: string): FileRecord {
  return {
    current: { document: { blocks: [], hash: "" }, items: {}, stories: [], text: "" },
    folder,
    id,
    kind: "",
    missing: true,
    name,
    path: "",
    reviewStale: false,
    takesImages: false,
  };
}

/** The record of a folder that is not a feature's: marked missing, its other fields empty. */
function missingFeature(folder: string): FeatureRecord {
  return {
    files: [],
    folder,
    id: folder,
    kind: "",
    missing: true,
    mockups: [],
    path: "",
    preview: false,
    problems: [],
    session: null,
    slug: "",
    source: "",
    step: { implemented: false, name: "none", progress: null, waitsOn: "nobody" },
    title: "",
    uncommitted: false,
  };
}

/**
 * A feature's branch changes. A folder that is no feature's has none, nor a repository without
 * `specs/`, as one whose folder was removed under an open page. Changes that cannot be read,
 * git missing or the diff failing, are answered as failed, so the page says so, and logged with
 * the error's first line.
 */
async function branchChanges(
  { binding, repo }: RepoContext,
  id: string,
): Promise<BranchChangesRecord> {
  try {
    return { changes: sentChanges(await binding.branchChanges(repo, id)), failed: false, id };
  } catch (error) {
    if (isMissing(error) || (error instanceof Error && /^no specs\/ folder /.test(error.message))) {
      return { changes: null, failed: false, id };
    }
    const [line] = (error instanceof Error ? error.message : String(error)).split("\n");
    process.stderr.write(`uraeda-server: the changes of ${id} could not be read: ${line}\n`);
    return { changes: null, failed: true, id };
  }
}

/** Whether the core refused a read for a file or a folder that is not there. */
function isMissing(error: unknown) {
  return error instanceof Error && /( has no |\bno feature )/.test(error.message);
}

/**
 * A repository's readers, refused on the global endpoint, which has none: see `inRepository`.
 */
function repository<Item extends Record<string, unknown>>(
  readers: FileSourceReaders<RepoContext, Item>,
): FileSourceReaders<Context, Item> {
  const { byIds, list } = readers;
  return {
    byIds: (ctx, ids) => byIds(inRepository(ctx), ids),
    ...(list ? { list: (ctx: Context) => list(inRepository(ctx)) } : {}),
  };
}

export const sources = createSources<Context>([
  fileSource(
    workspaceDataView,
    repository({
      byIds: async (ctx, ids) => (ids.includes(WORKSPACE_ID) ? [await workspace(ctx)] : []),
      list: async (ctx) => [await workspace(ctx)],
    }),
  ),
  fileSource(
    featureDataView,
    repository({
      byIds: (ctx, ids) =>
        each(ids, async (id) => {
          try {
            return await featureRecord(ctx, await ctx.binding.readFeature(ctx.repo, id));
          } catch (error) {
            // A folder that is no feature's is answered, so the page says so instead of waiting.
            if (isMissing(error)) {
              return missingFeature(id);
            }
            throw error;
          }
        }),
      list: async (ctx) =>
        Promise.all(
          (await ctx.binding.readWorkspace(ctx.repo)).features.map((feature) =>
            featureRecord(ctx, feature),
          ),
        ),
    }),
  ),
  fileSource(
    fileDataView,
    repository({
      byIds: ({ binding, repo }, ids) =>
        each(ids, async (id): Promise<FileRecord> => {
          if (id === TRIAGE_ID) {
            // The triage has no feature: missing until an agent writes it.
            const triage = await binding.readTriage(repo);
            return sentFile(triage ?? missingFile(id, "", "INBOX-TRIAGE.md"));
          }
          const [folder, name] = id.split("/");
          try {
            return sentFile(await binding.readFile(repo, folder, name));
          } catch (error) {
            // A file its feature has no longer, or of a folder that is no feature's, is answered, so
            // the page says so instead of waiting.
            if (isMissing(error)) {
              return sentFile(missingFile(id, folder, name));
            }
            throw error;
          }
        }),
    }),
  ),
  fileSource(
    branchChangesDataView,
    repository({
      byIds: async (ctx, ids) => Promise.all(ids.map((id) => branchChanges(ctx, id))),
    }),
  ),
  fileSource(
    prioritiesDataView,
    repository({
      byIds: async ({ binding, repo }, ids) =>
        ids.includes(PRIORITIES_ID)
          ? [{ id: PRIORITIES_ID, ...(await binding.readPriorities(repo)) }]
          : [],
    }),
  ),
  fileSource(
    inboxDataView,
    repository({
      byIds: async ({ binding, repo }, ids) =>
        ids.includes(INBOX_ID) ? [sentInbox(await binding.readInbox(repo))] : [],
    }),
  ),
  fileSource(
    draftDataView,
    repository({
      byIds: ({ binding, repo }, ids) =>
        each(ids, async (id) => ({ id, ...(await binding.readText(repo, id)) })),
    }),
  ),
  fileSource(agentDataView, {
    byIds: async (ctx, ids) => (ids.includes(AGENT_ID) ? [agentRecord(ctx)] : []),
    list: async (ctx) => [agentRecord(ctx)],
  }),
  fileSource(
    sessionDataView,
    repository({
      byIds: async (ctx, ids) => found(ids, (id) => readSession(ctx, id)),
    }),
  ),
  fileSource(
    turnDataView,
    repository({
      byIds: async (ctx, ids) => found(ids, (id) => readTurn(ctx, id)),
    }),
  ),
  fileSource(
    turnLogDataView,
    repository({
      byIds: async (ctx, ids) => found(ids, (id) => readTurnLog(ctx, id)),
    }),
  ),
  fileSource(
    sessionListDataView,
    repository({
      byIds: async (ctx, ids) => (ids.includes(SESSION_LIST_ID) ? [await sessionList(ctx)] : []),
    }),
  ),
  fileSource(
    sessionSearchDataView,
    repository({
      byIds: async (ctx, ids) => Promise.all(ids.map((query) => sessionSearch(ctx, query))),
    }),
  ),
  fileSource(
    workflowMessageDataView,
    repository({
      byIds: async (ctx, ids) => found(ids, (id) => readWorkflowMessage(ctx, id)),
    }),
  ),
  fileSource(
    storyDataView,
    repository({ byIds: async (ctx, ids) => each(ids, (id) => readStory(ctx, id)) }),
  ),
  fileSource(
    previewDataView,
    repository({ byIds: async (ctx, ids) => each(ids, (id) => readPreview(ctx, id)) }),
  ),
  fileSource(
    storyHrefDataView,
    repository({ byIds: async (ctx, ids) => ids.map((href) => readStoryHref(ctx, href)) }),
  ),
  fileSource(repositoriesDataView, {
    // Read again on each read, so a folder moved away or back since shows as it is now.
    byIds: async (ctx, ids) => {
      if (!ids.includes(REPOSITORIES_ID)) {
        return [];
      }
      await ctx.hosts.reload();
      return [repositoriesRecord(ctx)];
    },
  }),
  fileSource(settingsDataView, { byIds: readSettingsRecord }),
  fileSource(folderSuggestionsDataView, {
    byIds: async (ctx, ids) => {
      unlockedList(ctx);
      return Promise.all(
        ids.map(async (text) => ({ id: text, rows: await suggest(text, homedir()) })),
      );
    },
  }),
  fileSource(proposalHintsDataView, {
    byIds: async ({ binding }, ids) =>
      ids.includes(PROPOSAL_HINTS_ID)
        ? [{ hints: await binding.proposalHints(), id: PROPOSAL_HINTS_ID }]
        : [],
  }),
  fileSource(slugProposalDataView, {
    byIds: async ({ binding }, ids) =>
      ids.map((text) => ({ id: text, slug: binding.proposeSlug(text) })),
  }),
]);
