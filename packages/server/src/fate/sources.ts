import type { Context } from "./context.ts";
import { featureRecord, readRun, readRunLog, runnerRecord } from "./runs.ts";
import { createSources, fileSource } from "./source.ts";
import {
  draftDataView,
  featureDataView,
  fileDataView,
  PRIORITIES_ID,
  prioritiesDataView,
  type FileRecord,
  RUNNER_ID,
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

export const sources = createSources<Context>([
  fileSource(workspaceDataView, {
    byIds: async (ctx, ids) => (ids.includes(WORKSPACE_ID) ? [await workspace(ctx)] : []),
    list: async (ctx) => [await workspace(ctx)],
  }),
  fileSource(featureDataView, {
    byIds: (ctx, ids) =>
      each(ids, async (id) => featureRecord(ctx, await ctx.binding.readFeature(ctx.repo, id))),
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
        return binding.readFile(repo, folder, name);
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
]);
