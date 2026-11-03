// `Space b`, "Open as a buffer", on a page showing one file: the file's buffer, `/buffer/<path>`.
// A page showing no single file, like home or the settings, declares nothing, so the leader menu
// does not list it there, nor does a page whose file does not exist.
import { useKeys } from "../keys/registry.tsx";
import { navigateHere } from "../routes.tsx";

/**
 * The hash of an empty text, which a list page's file has when it does not exist: `PRIORITIES.md`
 * or `INBOX.md` missing reads as empty, and offers no buffer, as an empty one does not either.
 */
const EMPTY_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/** `path` when the file read with `hash` has text, else undefined: no buffer of a missing file. */
export function withText(path: string, file: { hash: string } | null | undefined) {
  return file && file.hash !== EMPTY_HASH ? path : undefined;
}

/** The buffer's page of the file at `path`, from the top level: `specs/PRIORITIES.md`. */
function bufferPath(path: string) {
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
