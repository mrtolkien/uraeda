// TEMPORARY: replaced by the web UI feature.
import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { fixture, listSpecFolders, testApp } from "./helpers.ts";

test("lists the spec folders, newest first", async () => {
  const folders = await listSpecFolders(testApp());

  expect(folders.map((folder) => folder.id)).toEqual([
    "2026-13-99-not-a-date",
    "2026-10-12-keyboard-shortcuts",
    "2026-10-10-stack-decision",
    "2026-10-06-recurring-tasks",
  ]);
  expect(folders[1]).toEqual({
    id: "2026-10-12-keyboard-shortcuts",
    name: "2026-10-12-keyboard-shortcuts",
    files: [],
  });
  expect(folders[3].files).toContainEqual({ file: "plan.md", problem: 'unknown status "done"' });
});

test("lists nothing without feature folders", async () => {
  expect(await listSpecFolders(testApp(fixture("no-features/specs")))).toEqual([]);
});

test("reads the files again on every request", async () => {
  const specs = mkdtempSync(join(tmpdir(), "uraeda-"));
  cpSync(fixture("specs"), specs, { recursive: true });
  const app = testApp(specs);
  await listSpecFolders(app);

  writeFileSync(join(specs, "2026-10-06-recurring-tasks/plan.md"), "---\nstatus: approved\n---\n");

  const folders = await listSpecFolders(app);
  expect(folders[3].files).toContainEqual({ file: "plan.md", status: "approved" });
});
