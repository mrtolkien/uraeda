// The data folder's `run/`: the files that only live while a server runs, a Storybook's record,
// the host token, and the pages of one-time links, apart from Uraeda's data and cache.
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/** The folder of a running server's files in the data folder, made mode 0700 by its writers. */
export const runFolder = (dataDir: string) => join(dataDir, "run");

/** The folder of Storybook records an earlier version kept in the data folder's root. */
export const oldGroupsFolder = (dataDir: string) => join(dataDir, "storybooks");

/** A host token an earlier version kept in the data folder's root: `server-<port>.token`. */
const OLD_TOKEN = /^server-\d+\.token$/;

/**
 * Removes the files a server of an earlier version kept in the data folder's root: `storybooks/`,
 * once the groups it lists are killed, `server-<port>.token`, and `sign-in-links/`. Uraeda's data,
 * `run/`, and every other file stay.
 */
export function removeOldRunFiles(dataDir: string): void {
  let names: Array<string>;
  try {
    names = readdirSync(dataDir);
  } catch {
    return;
  }
  const old = [oldGroupsFolder(dataDir), join(dataDir, "sign-in-links")];
  for (const name of names.filter((name) => OLD_TOKEN.test(name))) {
    old.push(join(dataDir, name));
  }
  for (const path of old) {
    rmSync(path, { force: true, recursive: true });
  }
}
