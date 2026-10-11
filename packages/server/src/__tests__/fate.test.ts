import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { byId, fixtureRepo, mutate, repoWithBranches, testApp } from "./helpers.ts";

const ROUND = "2026-10-11-web-ui/clarifications-01.md";

test("reads the workspace by its id", async () => {
  const [workspace] = await byId(
    testApp(),
    "Workspace",
    ["workspace"],
    ["id", "features", "priorities"],
  );

  expect(workspace.id).toBe("workspace");
  const folders = workspace.features.map((f: { folder: string }) => f.folder);
  expect(folders).toContain("2026-10-11-web-ui");
  expect(workspace.priorities[0].text).toBe("Web UI for the workflow files");
});

test("reads a file's document and items, masked to the selection", async () => {
  const [file] = await byId(testApp(), "WorkflowFile", [ROUND], ["id", "current"]);

  expect(Object.keys(file).sort()).toEqual(["current", "id"]);
  expect(file.current.items.clarifications.questions[0].id).toBe("Q1");
  expect(file.current.document.blocks[0].kind).toBe("heading");
});

test("saves an answer, and returns the file", async () => {
  const repo = fixtureRepo();

  const result = await mutate(
    testApp(repo),
    "answer.save",
    { folder: "2026-10-11-web-ui", question: "Q2", letters: ["A"], comment: "", previous: "" },
    ["id", "current"],
  );

  expect(result.ok).toBe(true);
  expect(result.data.current.items.clarifications.questions[2].answer).toBe("A");
  const written = readFileSync(join(repo, ".worktrees/2026-10-11-web-ui/specs", ROUND), "utf8");
  expect(written).toContain("**Answer:** A\n");
});

test("refuses a stale answer at the call site, with its code", async () => {
  const app = testApp();
  const input = { folder: "2026-10-11-web-ui", question: "Q2", comment: "", previous: "" };
  await mutate(app, "answer.save", { ...input, letters: ["A"] }, ["id"]);

  const result = await mutate(app, "answer.save", { ...input, letters: ["B"] }, ["id"]);

  expect(result.ok).toBe(false);
  expect(result.error).toEqual({
    code: "BAD_REQUEST",
    message:
      "conflict: clarifications-01.md changed on disk since you opened it. Your text was not saved.",
  });
});

test("adds a priority line", async () => {
  const app = testApp();
  const [priorities] = await byId(app, "Priorities", ["priorities"], ["id", "hash"]);

  const result = await mutate(
    app,
    "priorities.add",
    { section: "next", text: "Show the agent's last commit", hash: priorities.hash },
    ["id", "sections", "changes"],
  );

  expect(result.data.changes).toBe(1);
  const next = result.data.sections.find((s: { section: string }) => s.section === "next");
  expect(next.entries.at(-1).text).toBe("Show the agent's last commit");
});

/** SC-001 */
test("reads the workspace of 20 feature branches in under 500 ms", async () => {
  const app = testApp(repoWithBranches(16));
  await byId(app, "Workspace", ["workspace"], ["id"]);

  const start = performance.now();
  const [workspace] = await byId(app, "Workspace", ["workspace"], ["id", "features"]);
  const elapsed = performance.now() - start;

  expect(workspace.features.length).toBeGreaterThanOrEqual(20);
  expect(elapsed).toBeLessThan(500);
});
