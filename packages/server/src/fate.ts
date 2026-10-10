// The fate server module: fate's Vite plugin reads its exports to type the UI's client.
import { createFateServer } from "@nkzw/fate/server";
import {
  temporarySpecFolders,
  temporarySpecFolderSources,
  temporarySpecFolderView,
  type TemporaryReadSpecs,
} from "./temporary-spec-folders.ts";

export { temporarySpecFolderView };

export const Root = {
  specFolders: temporarySpecFolders,
};

export function createFate(specs: string, readSpecs: TemporaryReadSpecs) {
  return createFateServer({
    roots: Root,
    sources: temporarySpecFolderSources(specs, readSpecs),
  });
}
