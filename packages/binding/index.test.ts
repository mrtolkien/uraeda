import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import {
  nextStep,
  readFile,
  readWorkspace,
  saveAnswer,
  watch,
  workDir,
  type Changes,
} from "./index.js";
import { fixtureRepo } from "./test-utils.ts";

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

/**
 * How many reports a write makes is the core's debounce, tested there: a machine that stalls the
 * watcher's thread may split one write's events in two, so this waits for the file's report.
 */
test("watches the repository until closed", async () => {
  const repo = fixtureRepo();
  await saveAnswer(repo, "2026-10-11-web-ui", "Q3", ["A"], "", "");
  const seen: Array<Changes> = [];
  const handle = watch(repo, (changes) => seen.push(changes));

  const path = join(repo, ".worktrees/2026-10-11-web-ui", ROUND);
  writeFileSync(path, readFileSync(path, "utf8").replace("**Answer:** A", "**Answer:** B"));
  await expect
    .poll(() => seen.flatMap((changes) => changes.files), { timeout: 10_000 })
    .toContain("2026-10-11-web-ui/clarifications-01.md");
  handle.close();

  expect(new Set(seen.flatMap((changes) => changes.files))).toEqual(
    new Set(["2026-10-11-web-ui/clarifications-01.md"]),
  );
}, 20_000);

test("nextStep and workDir give where and what an agent runs", async () => {
  const repo = fixtureRepo();

  const next = await nextStep(repo, "2026-10-12-cli-tuis");

  expect(next).toMatchObject({ folder: "2026-10-12-cli-tuis", mainRoot: repo });
  expect(next.step).toMatchObject({
    name: "plan",
    waitsOn: "agent",
    reference: "skills/uraeda/references/plan.md",
  });
  expect(await workDir(repo, "2026-10-12-cli-tuis")).toBe(
    join(repo, ".worktrees", "2026-10-12-cli-tuis"),
  );
});
