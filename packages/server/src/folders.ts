// The folders a human types in the add form: read in the server, which expands `~`, while the core
// takes absolute paths only (see the plan's R1).
import { type Dirent } from "node:fs";
import { lstat, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

/** At most this many folders are suggested. */
export const SUGGESTIONS = 20;

const NOT_ABSOLUTE = "Type an absolute path, starting with / or ~.";

/** A folder the add form suggests: `path` as typed, ending with `/`, `git` when it holds `.git`. */
export type Suggestion = { path: string; git: boolean };

/**
 * The absolute folder a typed path names: `~` is the home folder, and a trailing `/` is dropped.
 * Any other start than `/` or `~` throws.
 */
export function typedFolder(text: string, home: string): string {
  let folder: string;
  if (text === "~" || text.startsWith("~/")) {
    folder = home + text.slice(1);
  } else if (text.startsWith("/")) {
    folder = text;
  } else {
    throw new Error(NOT_ABSOLUTE);
  }
  return folder.replace(/\/+$/, "") || "/";
}

/** The path with the home folder written `~`, as the UI shows it. */
export function homePath(path: string, home: string): string {
  if (path === home) {
    return "~";
  }
  return path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

/** Whether an entry is a folder, following a link to one. */
async function isFolder(parent: string, entry: Dirent): Promise<boolean> {
  if (entry.isDirectory()) {
    return true;
  }
  if (!entry.isSymbolicLink()) {
    return false;
  }
  return stat(join(parent, entry.name)).then(
    (found) => found.isDirectory(),
    () => false,
  );
}

/**
 * The folders whose path starts with the typed text, ignoring case in the last name: the folder
 * before the last `/` is listed, folders only, sorted by name, at most 20. Hidden folders show only
 * when the name typed starts with `.`. Nothing is read beyond checking each for `.git`; a text that
 * is not absolute, or a folder that cannot be read, gets none.
 */
export async function suggest(text: string, home: string): Promise<Array<Suggestion>> {
  const slash = text.lastIndexOf("/");
  if (slash < 0) {
    return [];
  }
  const prefix = text.slice(0, slash + 1);
  const start = text.slice(slash + 1).toLowerCase();
  let parent: string;
  try {
    parent = typedFolder(prefix, home);
  } catch {
    return [];
  }
  let entries: Array<Dirent>;
  try {
    entries = await readdir(parent, { withFileTypes: true });
  } catch {
    return [];
  }
  const matching = entries.filter(
    (entry) =>
      entry.name.toLowerCase().startsWith(start) &&
      (!entry.name.startsWith(".") || start.startsWith(".")),
  );
  const folders = (
    await Promise.all(
      matching.map(async (entry) => ((await isFolder(parent, entry)) ? entry.name : undefined)),
    )
  ).filter((name) => name !== undefined);
  folders.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return Promise.all(
    folders.slice(0, SUGGESTIONS).map(async (name) => ({
      path: `${prefix}${name}/`,
      git: await lstat(join(parent, name, ".git")).then(
        () => true,
        () => false,
      ),
    })),
  );
}
