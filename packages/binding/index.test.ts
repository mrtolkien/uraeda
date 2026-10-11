import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import {
  readFile,
  readWorkspace,
  saveAnswer,
  temporaryReadFolder,
  temporaryReadSpecs,
  watch,
  type Changes,
} from "./index.js";
import { fixture, fixtureRepo } from "./test-utils.ts";

const ROUND = "specs/2026-10-11-web-ui/clarifications-01.md";

test("reads the workspace of a repository", async () => {
  const workspace = await readWorkspace(fixtureRepo());

  const steps = Object.fromEntries(workspace.features.map((f) => [f.folder, f.step.name]));
  expect(steps).toEqual({
    "2026-10-06-recurring-tasks": "human-gate",
    "2026-10-10-cli-core": "done",
    "2026-10-10-stack-decision": "done",
    "2026-10-11-web-ui": "human-gate",
    "2026-10-12-cli-tuis": "plan",
    "2026-10-13-plan-review": "human-gate",
  });
  expect(workspace.priorities.find((p) => p.id === "next-2")?.draft).toBe(
    "specs/drafts/git-listener.md",
  );
});

test("reads a round's questions and options", async () => {
  const file = await readFile(fixtureRepo(), "2026-10-11-web-ui", "clarifications-01.md");

  const questions = file.current.items.clarifications!.questions;
  expect(questions.map((q) => q.id)).toEqual(["Q1", "Q1.B", "Q2", "Q3"]);
  expect(questions[2].options.map((o) => o.letter)).toEqual(["A", "B", "C"]);
  expect(file.current.document.blocks.length).toBeGreaterThan(20);
});

test("saves an answer in the feature's worktree", async () => {
  const repo = fixtureRepo();

  const file = await saveAnswer(repo, "2026-10-11-web-ui", "Q2", ["A"], "", "");

  expect(file.current.items.clarifications!.questions[2].answer).toBe("A");
  const written = readFileSync(join(repo, ".worktrees/2026-10-11-web-ui", ROUND), "utf8");
  expect(written).toContain("**Answer:** A\n");
});

test("rejects a stale answer with its code", async () => {
  const repo = fixtureRepo();
  await saveAnswer(repo, "2026-10-11-web-ui", "Q2", ["A"], "", "");

  await expect(saveAnswer(repo, "2026-10-11-web-ui", "Q2", ["B"], "", "")).rejects.toThrow(
    "conflict: clarifications-01.md changed on disk since you opened it. Your text was not saved.",
  );
});

test("watches the repository until closed", async () => {
  const repo = fixtureRepo();
  await saveAnswer(repo, "2026-10-11-web-ui", "Q3", ["A"], "", "");
  const seen: Array<Changes> = [];
  const handle = watch(repo, (changes) => seen.push(changes));

  const path = join(repo, ".worktrees/2026-10-11-web-ui", ROUND);
  writeFileSync(path, readFileSync(path, "utf8").replace("**Answer:** A", "**Answer:** B"));
  await expect.poll(() => seen.length, { timeout: 5000 }).toBe(1);
  handle.close();

  expect(seen[0].files).toEqual(["2026-10-11-web-ui/clarifications-01.md"]);
});

// TEMPORARY: replaced by the web UI feature.
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

// TEMPORARY: replaced by the web UI feature.
test("reports an invalid file", () => {
  const folder = temporaryReadFolder(fixture("specs/2026-10-06-recurring-tasks"));

  expect(folder.files.at(-1)).toEqual({ file: "plan.md", problem: 'unknown status "done"' });
});
