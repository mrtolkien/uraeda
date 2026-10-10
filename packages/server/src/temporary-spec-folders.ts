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
/** fate's request context: where the spec folders of this server are read from. */
export type TemporarySpecFolderContext = { readSpecFolders: () => Array<FolderStatus> };

// TEMPORARY: replaced by the web UI feature.
export const temporarySpecFolderView = dataView<TemporarySpecFolder>("SpecFolder")({
  id: true,
  name: true,
  files: true,
});

// TEMPORARY: replaced by the web UI feature.
/** Every feature folder, newest first: names start with their date. */
export const temporarySpecFolders = list(temporarySpecFolderView, { orderBy: { id: "desc" } });

// TEMPORARY: replaced by the web UI feature.
const temporarySpecFolderSource: SourceDefinition<TemporarySpecFolder> = {
  id: "id",
  view: temporarySpecFolderView,
};

// TEMPORARY: replaced by the web UI feature.
/** The fate sources reading the spec folders of the request's context, on every request. */
export function temporarySpecFolderSources() {
  const read = (ctx: TemporarySpecFolderContext): Array<TemporarySpecFolder> =>
    ctx.readSpecFolders().map((folder) => ({ ...folder, id: folder.name }));

  // fate's own tests build a registry this way; the executor type is not exported.
  const registry = new Map([
    [
      temporarySpecFolderSource,
      {
        byIds: async ({ ctx, ids }: { ctx: TemporarySpecFolderContext; ids: Array<string> }) =>
          read(ctx).filter((folder) => ids.includes(folder.id)),
        connection: async ({
          ctx,
          cursor,
          take,
        }: {
          ctx: TemporarySpecFolderContext;
          cursor?: string;
          take: number;
        }) => {
          const folders = read(ctx);
          const start = cursor ? folders.findIndex((folder) => folder.id === cursor) + 1 : 0;
          if (cursor && start === 0) {
            return [];
          }
          return folders.slice(start, start + take);
        },
      },
    ],
  ]) as unknown as SourceRegistry<TemporarySpecFolderContext>;

  return {
    // One source serves every view: fate asks for the source of a view or of a type.
    getSource: <Item extends Record<string, unknown>>() =>
      temporarySpecFolderSource as unknown as SourceDefinition<Item>,
    registry,
  };
}
