// TEMPORARY: replaced by the web UI feature.
// Serves the core's spec folders to fate for the temporary status page, until task 10 of the web
// UI's plan replaces the page.
import { dataView, list } from "@nkzw/fate/server";
import type { FolderStatus } from "uraeda-binding";

// TEMPORARY: replaced by the web UI feature.
/** A feature folder, identified by its name, as fate needs an `id`. */
export type TemporarySpecFolder = { [Key in keyof FolderStatus]: FolderStatus[Key] } & {
  id: string;
};

// TEMPORARY: replaced by the web UI feature.
export const temporarySpecFolderView = dataView<TemporarySpecFolder>("SpecFolder")({
  id: true,
  name: true,
  files: true,
});

// TEMPORARY: replaced by the web UI feature.
/** Every feature folder, newest first: names start with their date. */
export const temporarySpecFolders = list(temporarySpecFolderView, { orderBy: { id: "desc" } });
