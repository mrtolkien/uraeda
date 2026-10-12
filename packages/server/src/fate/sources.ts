import type { Context } from "./context.ts";
import { createSources, fileSource } from "./source.ts";
import {
  draftDataView,
  featureDataView,
  fileDataView,
  PRIORITIES_ID,
  prioritiesDataView,
  type FileRecord,
  WORKSPACE_ID,
  workspaceDataView,
} from "./views.ts";

/** Reads each id, leaving out the ones that cannot be read. */
async function each<T>(ids: Array<string>, read: (id: string) => Promise<T>): Promise<Array<T>> {
  const results = await Promise.allSettled(ids.map(read));
  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

export const sources = createSources<Context>([
  fileSource(workspaceDataView, {
    byIds: async ({ binding, repo }, ids) =>
      ids.includes(WORKSPACE_ID)
        ? [{ id: WORKSPACE_ID, ...(await binding.readWorkspace(repo)) }]
        : [],
    list: async ({ binding, repo }) => [
      { id: WORKSPACE_ID, ...(await binding.readWorkspace(repo)) },
    ],
  }),
  fileSource(featureDataView, {
    byIds: ({ binding, repo }, ids) =>
      each(ids, async (id) => ({ id, ...(await binding.readFeature(repo, id)) })),
    list: async ({ binding, repo }) =>
      (await binding.readWorkspace(repo)).features.map((feature) => ({
        id: feature.folder,
        ...feature,
      })),
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
]);
