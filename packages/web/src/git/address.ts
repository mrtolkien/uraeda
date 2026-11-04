// The Git page's picked row, in its address, so reload, Back, and a width change keep it: a changed
// file of a group, `/git?file=<path>[&folder=<folder>]`, a commit of the history, or one of its
// files, `/git?commit=<id>[&file=<path>]`, and a conflicted file, `/git?conflict=<path>`.

/** What the page shows beside its sections, or as a page of its own on the phone. */
export type Picked =
  | { file: string; folder?: string; kind: "file" }
  | { commit: string; file?: string; kind: "commit" }
  | { kind: "conflict"; path: string };

/** The page's path. */
export const GIT_PATH = "/git";

/** The address of `picked`, from the repository's top level: the page alone without one. */
export function gitAddress(picked?: Picked): string {
  if (picked === undefined) {
    return GIT_PATH;
  }
  const query = new URLSearchParams();
  switch (picked.kind) {
    case "file":
      query.set("file", picked.file);
      if (picked.folder !== undefined) {
        query.set("folder", picked.folder);
      }
      break;
    case "commit":
      query.set("commit", picked.commit);
      if (picked.file !== undefined) {
        query.set("file", picked.file);
      }
      break;
    case "conflict":
      query.set("conflict", picked.path);
      break;
  }
  return `${GIT_PATH}?${query.toString()}`;
}

/** The row an address's query, `?…`, picks: none for one that names no row. */
export function pickedOf(search: string): Picked | undefined {
  const query = new URLSearchParams(search);
  const commit = query.get("commit");
  const file = query.get("file");
  const conflict = query.get("conflict");
  const folder = query.get("folder");
  if (commit) {
    return file ? { commit, file, kind: "commit" } : { commit, kind: "commit" };
  }
  if (conflict) {
    return { kind: "conflict", path: conflict };
  }
  if (file) {
    return folder ? { file, folder, kind: "file" } : { file, kind: "file" };
  }
  return undefined;
}
