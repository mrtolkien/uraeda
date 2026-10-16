import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vite-plus/test";

// Each test file owns its temporary files, including those made by git and child processes.
// Cleaning this directory also covers new tests without making every test remember a teardown.
// Its settings too: a folder inside it, so no test reads the developer's `~/.config/uraeda`.
const previous = { TMPDIR: process.env.TMPDIR, URAEDA_CONFIG_DIR: process.env.URAEDA_CONFIG_DIR };
const directory = mkdtempSync(join(tmpdir(), "uraeda-test-"));
process.env.TMPDIR = directory;
process.env.URAEDA_CONFIG_DIR = join(directory, "config");

afterAll(() => {
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
  rmSync(directory, { force: true, recursive: true });
  // A test file's thousands of files, its repositories' and data folders', took 13 to 16 seconds
  // to remove with every worker removing its own at once, under several checkouts' tests: past
  // the hooks' 10 seconds, which failed files whose tests had all passed. Cleanup is given time.
}, 120_000);
