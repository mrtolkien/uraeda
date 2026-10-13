import type { Context } from "./context.ts";
import { featureRecord, readRun, readRunLog, runnerRecord } from "./runs.ts";
import { createSources, fileSource } from "./source.ts";
import {
  draftDataView,
  featureDataView,
  fileDataView,
  PRIORITIES_ID,
  prioritiesDataView,
  PROPOSAL_HINTS_ID,
  proposalHintsDataView,
  type FeatureRecord,
  type FileRecord,
  RUNNER_ID,
  sentFile,
  runDataView,
  runLogDataView,
  runnerDataView,
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

async function workspace(ctx: Context): Promise<WorkspaceRecord> {
  return {
    id: WORKSPACE_ID,
    ...(await ctx.binding.readWorkspace(ctx.repo)),
    running: ctx.runner.running(ctx.repo),
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
    runs: [],
    missing: true,
  };
}

/** Whether the core refused a read for a file or a folder that is not there. */
function isMissing(error: unknown) {
  return error instanceof Error && /( has no |\bno feature )/.test(error.message);
}

export const sources = createSources<Context>([
  fileSource(workspaceDataView, {
    byIds: async (ctx, ids) => (ids.includes(WORKSPACE_ID) ? [await workspace(ctx)] : []),
    list: async (ctx) => [await workspace(ctx)],
  }),
  fileSource(featureDataView, {
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
  fileSource(fileDataView, {
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
  fileSource(prioritiesDataView, {
    byIds: async ({ binding, repo }, ids) =>
      ids.includes(PRIORITIES_ID)
        ? [{ id: PRIORITIES_ID, ...(await binding.readPriorities(repo)) }]
        : [],
  }),
  fileSource(draftDataView, {
    byIds: ({ binding, repo }, ids) =>
      each(ids, async (id) => ({ id, ...(await binding.readText(repo, id)) })),
  }),
  fileSource(runnerDataView, {
    byIds: async (ctx, ids) => (ids.includes(RUNNER_ID) ? [runnerRecord(ctx)] : []),
    list: async (ctx) => [runnerRecord(ctx)],
  }),
  fileSource(runDataView, {
    byIds: async (ctx, ids) => found(ids, (id) => readRun(ctx, id)),
  }),
  fileSource(runLogDataView, {
    byIds: async (ctx, ids) => found(ids, (id) => readRunLog(ctx, id)),
  }),
  fileSource(proposalHintsDataView, {
    byIds: async ({ binding }, ids) =>
      ids.includes(PROPOSAL_HINTS_ID)
        ? [{ id: PROPOSAL_HINTS_ID, hints: await binding.proposalHints() }]
        : [],
  }),
]);
