import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixtureRepo } from "uraeda-binding/test-utils";

/**
 * The repository the server mounted in the test server opens first, the fixture's, built with git,
 * and its data folder, a temporary one: the tests never touch the user's own list or cache. Each
 * test adds a repository of its own to that list (see `vite.browser.config.ts`).
 */
export default function setup() {
  const repo = fixtureRepo();
  process.env.URAEDA_REPO = repo;
  const data = mkdtempSync(join(tmpdir(), "uraeda-data-"));
  process.env.URAEDA_DATA_DIR = data;
  return () => {
    rmSync(repo, { recursive: true, force: true });
    rmSync(data, { recursive: true, force: true });
  };
}
