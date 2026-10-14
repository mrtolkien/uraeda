import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { refusable } from "../fate/errors.ts";
import { byId, fixtureRepo, mutate, testApp } from "./helpers.ts";

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

test("a binding call's refusal is a bad request, and any other error an internal one, logged", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const failed = (call: () => Promise<unknown>) =>
    call().then(
      () => undefined,
      (error) => error,
    );

  for (const message of ["refused: no", "conflict: changed", "hook: failed\n\noutput"]) {
    const refusal = await failed(() => refusable(() => Promise.reject(new Error(message))));
    expect(refusal).toMatchObject({ code: "BAD_REQUEST", message });
  }
  expect(log).not.toHaveBeenCalled();

  const crash = await failed(() =>
    refusable(() => Promise.reject(new Error("the task ran twice"))),
  );
  expect(crash).toMatchObject({ code: "INTERNAL_ERROR" });
  expect(log).toHaveBeenCalledOnce();
  expect(String(log.mock.calls[0]?.[0])).toContain("the task ran twice");
  log.mockRestore();
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

test("puts a removed priority line back", async () => {
  const app = testApp();
  const [read] = await byId(app, "Priorities", ["priorities"], ["id", "hash"]);
  const removed = await mutate(app, "priorities.remove", { entry: "later-1", hash: read.hash }, [
    "id",
    "hash",
  ]);

  const result = await mutate(
    app,
    "priorities.insert",
    {
      section: "later",
      index: 0,
      lines: ["- Nix + Docker based execution environments", "  - with a cache"],
      hash: removed.data.hash,
    },
    ["id", "sections", "changes"],
  );

  expect(result.data.changes).toBe(0);
  const later = result.data.sections.find((s: { section: string }) => s.section === "later");
  expect(later.entries[0].key).toBe("nix-docker-based-execution-environments");
  expect(later.entries[0].nested).toEqual(["  - with a cache"]);
});

test("a file without a review is sent with none, so a removed review leaves the page", async () => {
  const app = testApp();
  const file = { folder: "2026-10-06-recurring-tasks", file: "spec.md" };

  const commented = await mutate(app, "review.comment", { ...file, text: "Why?" }, [
    "id",
    "review",
  ]);
  expect(commented.data.review).not.toBeNull();
  const removed = await mutate(app, "review.remove", { ...file, number: 1 }, ["id", "review"]);

  // Sent as null, not left out: the client keeps a field an answer leaves out.
  expect(removed.ok).toBe(true);
  expect(removed.data).toHaveProperty("review", null);
  const [read] = await byId(
    app,
    "WorkflowFile",
    ["2026-10-06-recurring-tasks/spec.md"],
    ["review"],
  );
  expect(read).toHaveProperty("review", null);
});
