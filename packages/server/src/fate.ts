// The fate server module: fate's Vite plugin reads its exports to type the UI's client.
import { createFateServer, type Entity } from "@nkzw/fate/server";
import type { Context } from "hono";
import {
  temporarySpecFolders,
  temporarySpecFolderSources,
  temporarySpecFolderView,
  type TemporarySpecFolderContext,
} from "./temporary-spec-folders.ts";

export { temporarySpecFolderView };

/** The type fate's generated client and the UI's views use, named after the data view's type. */
export type SpecFolder = Entity<typeof temporarySpecFolderView, "SpecFolder">;

export type FateVariables = { fate: TemporarySpecFolderContext };

export const Root = {
  specFolders: temporarySpecFolders,
};

/** One fate server for every app: each request brings its app's context, set by `createApp`. */
export const fateServer = createFateServer({
  context: ({ adapterContext }: { adapterContext?: Context<{ Variables: FateVariables }> }) =>
    adapterContext!.get("fate"),
  roots: Root,
  sources: temporarySpecFolderSources(),
});
