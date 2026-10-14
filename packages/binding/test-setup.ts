import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vite-plus/test";

// Each test file owns its temporary files, including those made by git and child processes.
// Cleaning this directory also covers new tests without making every test remember a teardown.
const previous = process.env.TMPDIR;
const directory = mkdtempSync(join(tmpdir(), "uraeda-test-"));
process.env.TMPDIR = directory;

afterAll(() => {
  if (previous === undefined) {
    delete process.env.TMPDIR;
  } else {
    process.env.TMPDIR = previous;
  }
  rmSync(directory, { force: true, recursive: true });
});
