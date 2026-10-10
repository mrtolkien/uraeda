// TEMPORARY: replaced by the web UI feature.
// Serves the core's spec folders to fate, without a database: fate ships sources for Prisma and
// Drizzle only, so this source reads the files through the binding on every request.
import { dataView, list, type SourceDefinition, type SourceRegistry } from "@nkzw/fate/server";
import type { FolderStatus } from "uraeda-binding";

// TEMPORARY: replaced by the web UI feature.
/**
 * A feature folder, identified by its name, as fate needs an `id`. The mapped type turns napi-rs's
 * generated interface into a type literal, which fate's record constraint accepts.
 */
export type TemporarySpecFolder = { [Key in keyof FolderStatus]: FolderStatus[Key] } & {
  id: string;
};

// TEMPORARY: replaced by the web UI feature.
export type TemporaryReadSpecs = (path: string) => Array<FolderStatus>;

// TEMPORARY: replaced by the web UI feature.
export const temporarySpecFolderView = dataView<TemporarySpecFolder>("SpecFolder")({
  id: true,
  name: true,
  files: true,
});

// TEMPORARY: replaced by the web UI feature.
/** Every feature folder, newest first: names start with their date. */
export const temporarySpecFolders = list(temporarySpecFolderView, { orderBy: { id: "desc" } });

const temporarySpecFolderSource: SourceDefinition<TemporarySpecFolder> = {
  id: "id",
  view: temporarySpecFolderView,
};

// TEMPORARY: replaced by the web UI feature.
/** The fate sources reading spec folders from `specs` on every request. */
export function temporarySpecFolderSources(specs: string, readSpecs: TemporaryReadSpecs) {
  const read = (): Array<TemporarySpecFolder> =>
    readSpecs(specs).map((folder) => ({ ...folder, id: folder.name }));

  // fate's own tests build a registry this way; the executor type is not exported.
  const registry = new Map([
    [
      temporarySpecFolderSource,
      {
        byIds: async ({ ids }: { ids: Array<string> }) =>
          read().filter((folder) => ids.includes(folder.id)),
        connection: async ({ cursor, take }: { cursor?: string; take: number }) => {
          const folders = read();
          const start = cursor ? folders.findIndex((folder) => folder.id === cursor) + 1 : 0;
          return folders.slice(start, start + take);
        },
      },
    ],
  ]) as unknown as SourceRegistry<unknown>;

  return {
    // One source serves every view: fate asks for the source of a view or of a type.
    getSource: <Item extends Record<string, unknown>>() =>
      temporarySpecFolderSource as unknown as SourceDefinition<Item>,
    registry,
  };
}
