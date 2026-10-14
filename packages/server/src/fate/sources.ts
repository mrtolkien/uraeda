import { homedir } from "node:os";
import { homePath, suggest } from "../folders.ts";
import { type Context, inRepository, type RepoContext } from "./context.ts";
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
import { createSources, fileSource, type FileSourceReaders } from "./source.ts";
import {
  AGENT_ID,
  agentDataView,
  draftDataView,
  featureDataView,
  fileDataView,
  folderSuggestionsDataView,
  PRIORITIES_ID,
  prioritiesDataView,
  PROPOSAL_HINTS_ID,
  proposalHintsDataView,
  REPOSITORIES_ID,
  repositoriesDataView,
  type RepositoriesRecord,
  type FeatureRecord,
  type FileRecord,
  sentFile,
  SESSION_LIST_ID,
  sessionDataView,
  sessionListDataView,
  sessionSearchDataView,
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
  return {
    id: WORKSPACE_ID,
    ...(await ctx.binding.readWorkspace(ctx.repo)),
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
    id: REPOSITORIES_ID,
    rows: ctx.hosts.rows().map(({ name, path, missing }) => ({
      name,
      path,
      home: homePath(path, home),
      missing,
    })),
    problem: ctx.hosts.problem,
    added,
  };
}

/** The record of a file its feature does not have: marked missing, its other fields empty. */
function missingFile(id: string, folder: string, name: string): FileRecord {
  return {
    id,
    folder,
    name,
    path: "",
    kind: "",
    current: { text: "", document: { blocks: [], hash: "" }, items: {} },
    reviewStale: false,
    missing: true,
  };
}

/** The record of a folder that is not a feature's: marked missing, its other fields empty. */
function missingFeature(folder: string): FeatureRecord {
  return {
    id: folder,
    kind: "",
    folder,
    slug: "",
    title: "",
    source: "",
    uncommitted: false,
    files: [],
    mockups: [],
    step: { name: "none", waitsOn: "nobody" },
    problems: [],
    session: null,
    missing: true,
  };
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
    prioritiesDataView,
    repository({
      byIds: async ({ binding, repo }, ids) =>
        ids.includes(PRIORITIES_ID)
          ? [{ id: PRIORITIES_ID, ...(await binding.readPriorities(repo)) }]
          : [],
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
  fileSource(folderSuggestionsDataView, {
    byIds: async (_, ids) =>
      Promise.all(ids.map(async (text) => ({ id: text, rows: await suggest(text, homedir()) }))),
  }),
  fileSource(proposalHintsDataView, {
    byIds: async ({ binding }, ids) =>
      ids.includes(PROPOSAL_HINTS_ID)
        ? [{ id: PROPOSAL_HINTS_ID, hints: await binding.proposalHints() }]
        : [],
  }),
]);
