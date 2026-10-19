// The fate protocol: what the web UI reads and writes through the server, over real git. Reads are
// masked to what a page selects, and each write lands in the right branch or file, alone.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { byId, fate, fixtureRepo, git, mutate, testApp } from "../__tests__/helpers.ts";

/** A feature at its questions, on its own branch and worktree. */
const HUMAN = "2026-10-11-web-ui";
const ROUND = `specs/${HUMAN}/clarifications-01.md`;

/** The files of a branch's last commit, and its subject. */
function lastCommit(repo: string, branch = "HEAD") {
  const [subject, ...files] = git(repo, "log", "-1", "--name-only", "--format=%s", branch)
    .split("\n")
    .filter(Boolean);
  return { files, subject: subject! };
}

test("a read answers only the fields the page selected", async () => {
  const { app } = await testApp();

  const [workspace] = await byId(app, "Workspace", ["workspace"], ["id", "features"]);
  const [feature] = await byId(app, "Feature", [HUMAN], ["id", "title"]);

  expect(Object.keys(workspace).sort()).toEqual(["features", "id"]);
  expect(workspace.features.length).toBeGreaterThan(1);
  expect(Object.keys(feature).sort()).toEqual(["id", "title"]);
});

test("an answer is written in the feature's worktree, and a stale one is refused as a conflict", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const input = { comment: "", folder: HUMAN, previous: "", question: "Q2" };

  const saved = await mutate(app, "answer.save", { ...input, letters: ["A"] }, ["id", "current"]);
  const stale = await mutate(app, "answer.save", { ...input, letters: ["B"] }, ["id"]);

  expect(saved.ok).toBe(true);
  expect(readFileSync(join(repo, ".worktrees", HUMAN, ROUND), "utf8")).toContain("**Answer:** A");
  // The main checkout never sees the feature's file.
  expect(git(repo, "status", "--porcelain")).toBe("");
  expect(stale.ok).toBe(false);
  expect(stale.error?.code).toBe("BAD_REQUEST");
  expect(stale.error?.message).toMatch(/^conflict: /);
  expect(readFileSync(join(repo, ".worktrees", HUMAN, ROUND), "utf8")).toContain("**Answer:** A");
});

test("a refusal of the core is a bad request, and the call after it still works", async () => {
  const { app } = await testApp();

  const [refused, read] = await fate(app, [
    {
      input: { comment: "", folder: HUMAN, letters: ["A"], previous: "", question: "Q99" },
      kind: "mutation",
      name: "answer.save",
      select: ["id"],
    },
    { ids: ["workspace"], kind: "byId", select: ["id"], type: "Workspace" },
  ]);

  expect(refused.ok).toBe(false);
  expect(refused.error?.code).toBe("BAD_REQUEST");
  expect(read.ok).toBe(true);
});

test("a priority added and committed is a commit of PRIORITIES.md alone, and Undo reverts it", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const [read] = await byId(app, "Priorities", ["priorities"], ["id", "hash"]);

  const added = await mutate(
    app,
    "priorities.add",
    { commit: true, hash: read.hash, section: "next", text: "Sort done features" },
    ["id", "hash", "added"],
  );

  expect(added.data.added).toMatchObject({ committed: true });
  expect(lastCommit(repo).files).toEqual(["specs/PRIORITIES.md"]);
  expect(git(repo, "status", "--porcelain")).toBe("");
  const before = git(repo, "rev-list", "--count", "HEAD");

  const undone = await mutate(
    app,
    "priorities.undoCommitted",
    { hash: added.data.hash, lines: ["- Sort done features"] },
    ["id", "hash"],
  );

  expect(undone.ok).toBe(true);
  expect(Number(git(repo, "rev-list", "--count", "HEAD"))).toBe(Number(before) + 1);
  expect(readFileSync(join(repo, "specs/PRIORITIES.md"), "utf8")).not.toContain(
    "Sort done features",
  );
});

test("an add that would commit someone's other changes with it does not commit", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const path = join(repo, "specs/PRIORITIES.md");
  writeFileSync(path, `${readFileSync(path, "utf8")}\n- Typed by hand\n`);
  const [read] = await byId(app, "Priorities", ["priorities"], ["id", "hash"]);
  const head = git(repo, "rev-parse", "HEAD");

  const added = await mutate(
    app,
    "priorities.add",
    { commit: true, hash: read.hash, section: "next", text: "Sort done features" },
    ["id", "added"],
  );

  expect(added.data.added).toMatchObject({ committed: false });
  expect(git(repo, "rev-parse", "HEAD")).toBe(head);
  // The line is written, beside the hand's own, for the human to commit.
  const text = readFileSync(path, "utf8");
  expect(text).toContain("Sort done features");
  expect(text).toContain("Typed by hand");
});

test("a note added to the inbox is written and left uncommitted, and a stale add is refused", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const [read] = await byId(app, "Inbox", ["inbox"], ["id", "hash"]);
  const head = git(repo, "rev-parse", "HEAD");

  const added = await mutate(app, "inbox.add", { hash: read.hash, text: "Icons are blurry" }, [
    "id",
    "hash",
  ]);
  const stale = await mutate(app, "inbox.add", { hash: read.hash, text: "Another note" }, ["id"]);

  expect(added.ok).toBe(true);
  expect(readFileSync(join(repo, "specs/INBOX.md"), "utf8")).toContain("Icons are blurry");
  expect(git(repo, "rev-parse", "HEAD")).toBe(head);
  expect(stale.ok).toBe(false);
  expect(stale.error?.message).toMatch(/^conflict: /);
  expect(readFileSync(join(repo, "specs/INBOX.md"), "utf8")).not.toContain("Another note");
});

test("the commit bar commits what the page changed, and discard puts the files back", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const [inbox] = await byId(app, "Inbox", ["inbox"], ["id", "hash"]);
  await mutate(app, "inbox.add", { hash: inbox.hash, text: "Icons are blurry" }, ["id"]);

  const committed = await mutate(app, "changes.commit", {}, ["id"]);

  expect(committed.ok).toBe(true);
  expect(lastCommit(repo).files).toContain("specs/INBOX.md");
  expect(git(repo, "status", "--porcelain")).toBe("");

  const [next] = await byId(app, "Inbox", ["inbox"], ["id", "hash"]);
  await mutate(app, "inbox.add", { hash: next.hash, text: "A second note" }, ["id"]);
  const discarded = await mutate(app, "changes.discard", {}, ["id"]);

  expect(discarded.ok).toBe(true);
  expect(readFileSync(join(repo, "specs/INBOX.md"), "utf8")).not.toContain("A second note");
  expect(readFileSync(join(repo, "specs/INBOX.md"), "utf8")).toContain("Icons are blurry");
});
