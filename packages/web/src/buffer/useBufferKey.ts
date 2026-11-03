// `Space b`, "Open as a buffer", on a page showing one file: the file's buffer, `/buffer/<path>`.
// A page showing no single file, like home or the settings, declares nothing, so the leader menu
// does not list it there.
import { useKeys } from "../keys/registry.tsx";
import { navigateHere } from "../routes.tsx";

/** The buffer's page of the file at `path`, from the top level: `specs/PRIORITIES.md`. */
export function bufferPath(path: string) {
  return `/buffer/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Declares `Space b`, which opens the file at `path` as a buffer; nothing while `path` is undefined. */
export function useBufferKey(path: string | undefined) {
  useKeys(
    path === undefined
      ? []
      : [
          {
            icon: "uraeda:file-pen-line",
            keys: "space b",
            label: "Open as a buffer",
            run: () => navigateHere(bufferPath(path)),
          },
        ],
  );
}
