import { homedir } from "node:os";
import type { Inbox, Priorities } from "uraeda-binding";
import { homePath, suggest } from "../folders.ts";
import { NEEDS_YOU_ID, needsYouList, needsYouListDataView } from "./needs-you.ts";
import { itemLooks } from "./items.ts";
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
import { readRecommended, recommendedDataView } from "./recommended.ts";
import { readSettingsRecord, settingsDataView } from "./settings.ts";
import { createSources, fileSource, type FileSourceReaders } from "./source.ts";
import {
  AGENT_ID,
  agentDataView,
  branchDecisionDataView,
  type BranchDecisionRecord,
  draftDataView,
  featureDataView,
  fileDataView,
  INBOX_ID,
  inboxDataView,
  type InboxRecord,
  PRIORITIES_ID,
  prioritiesDataView,
  type PrioritiesRecord,
  PROPOSAL_HINTS_ID,
  proposalHintsDataView,
  type FeatureRecord,
  type FileRecord,
  sentBranchDecision,
  sentFile,
  sentStep,
  SESSION_LIST_ID,
  sessionDataView,
  sessionListDataView,
  sessionSearchDataView,
  slugProposalDataView,
  DEFAULT_ROUND_FILES,
  DEFAULT_ROUND_IDS,
  turnDataView,
  turnLogDataView,
  workflowMessageDataView,
  type WorkspaceRecord,
  WORKSPACE_ID,
  workspaceDataView,
} from "./views.ts";
import { type BranchChangesRecord, branchChangesDataView, sentChanges } from "./views-branch.ts";
import { historyDataView, sentHistory } from "./views-history.ts";
import { LEDGER_ID, ledgerDataView, sentLedger } from "./views-ledger.ts";
import {
  folderSuggestionsDataView,
  REPOSITORIES_ID,
  repositoriesDataView,
  type RepositoriesRecord,
} from "./views-repositories.ts";

/** The inbox as it is sent: the client's cache keeps a field an answer leaves out. */
export function sentInbox(inbox: Inbox): InboxRecord {
  return { ...inbox, id: INBOX_ID, triage: inbox.triage ?? null };
}

/** The priorities as they are sent: each running feature's step as `sentStep` sends it. */
export const sentPriorities = (read: Priorities): Omit<PrioritiesRecord, "id"> => ({
  ...read,
  sections: read.sections.map((section) => ({
    ...section,
    entries: section.entries.map(({ running, ...entry }) => ({
      ...entry,
      ...(running && { running: { ...running, step: sentStep(running.step) } }),
    })),
  })),
});

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
  const looks = itemLooks(ctx);
  return {
    id: WORKSPACE_ID,
    ...read,
    features: read.features.map((feature) => ({
      ...feature,
      ...looks(feature.folder),
      step: sentStep(feature.step),
    })),
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
    decisionChanges: [],
    folder,
    id,
    kind: "",
    missing: true,
    name,
    path: "",
    resumable: false,
    reviewStale: false,
    takesImages: false,
  };
}

/** The record of a decision a feature's branch does not have: marked missing, its fields empty. */
function missingDecision(id: string, folder: string, name: string): BranchDecisionRecord {
  return {
    change: { compared: false, fields: [], kind: "", listed: false, name, sections: [], title: "" },
    document: { blocks: [], hash: "" },
    folder,
    id,
    missing: true,
    name,
  };
}

/**
 * A decision as a feature's branch has it, by `<folder>/<name>`: one the branch does not have, or
 * of a folder that is no feature's, is answered missing, so the page says so instead of waiting.
 */
async function branchDecision(
  { binding, repo }: RepoContext,
  id: string,
): Promise<BranchDecisionRecord> {
  const slash = id.indexOf("/");
  const [folder, name] = slash < 0 ? [id, ""] : [id.slice(0, slash), id.slice(slash + 1)];
  try {
    return sentBranchDecision(await binding.readDecision(repo, folder, name));
  } catch (error) {
    if (isMissing(error)) {
      return missingDecision(id, folder, name);
    }
    throw error;
  }
}

/** The record of a folder that is not a feature's: marked missing, its other fields empty. */
function missingFeature(folder: string): FeatureRecord {
  return {
    color: null,
    files: [],
    folder,
    id: folder,
    kind: "",
    label: null,
    missing: true,
    mockups: [],
    notes: [],
    path: "",
    preview: false,
    problems: [],
    session: null,
    slug: "",
    source: "",
    step: { implemented: false, name: "none", order: 14, progress: null, waitsOn: "nobody" },
    title: "",
    tokens: null,
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
          if (DEFAULT_ROUND_IDS.includes(id)) {
            // A round on the default branch has no feature: missing until an agent writes it.
            const round = await binding.readRound(repo, id);
            return sentFile(round ?? missingFile(id, "", DEFAULT_ROUND_FILES[id]));
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
    historyDataView,
    repository({
      byIds: ({ binding, repo }, ids) =>
        each(ids, async (id) => sentHistory(await binding.readHistory(repo, id))),
    }),
  ),
  fileSource(
    branchDecisionDataView,
    repository({ byIds: (ctx, ids) => each(ids, (id) => branchDecision(ctx, id)) }),
  ),
  fileSource(
    prioritiesDataView,
    repository({
      byIds: async ({ binding, repo }, ids) =>
        ids.includes(PRIORITIES_ID)
          ? [{ id: PRIORITIES_ID, ...sentPriorities(await binding.readPriorities(repo)) }]
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
    ledgerDataView,
    repository({
      byIds: async ({ binding, repo }, ids) =>
        ids.includes(LEDGER_ID) ? [sentLedger(await binding.readLedger(repo))] : [],
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
    recommendedDataView,
    repository({
      byIds: async (ctx, ids) => found(ids, (id) => readRecommended(ctx, id)),
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
  // Every repository's: read on the global endpoint, unwrapped.
  fileSource(needsYouListDataView, {
    byIds: async (ctx, ids) => (ids.includes(NEEDS_YOU_ID) ? [await needsYouList(ctx)] : []),
  }),
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
