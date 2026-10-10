// TEMPORARY: replaced by the CLI feature.
import { expect, test } from "vite-plus/test";
import { temporaryReadFolder, temporaryReadSpecs } from "./index.js";
import { fixture } from "./test-utils.ts";

test("reads the same statuses as the core", () => {
  const specs = temporaryReadSpecs(fixture("specs"));

  expect(specs.map((folder) => folder.name)).toEqual([
    "2026-13-99-not-a-date",
    "2026-10-12-keyboard-shortcuts",
    "2026-10-10-stack-decision",
    "2026-10-06-recurring-tasks",
  ]);
  expect(specs[2].files[0]).toEqual({ file: "clarifications-01.md", status: "answered" });
});

test("reports an invalid file", () => {
  const folder = temporaryReadFolder(fixture("specs/2026-10-06-recurring-tasks"));

  expect(folder.files.at(-1)).toEqual({ file: "plan.md", problem: 'unknown status "done"' });
});

test("throws on a missing folder", () => {
  expect(() => temporaryReadFolder("missing")).toThrow("missing: no such folder");
});
