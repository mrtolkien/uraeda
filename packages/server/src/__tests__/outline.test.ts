import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { byId, fixtureRepo, mutate, testApp } from "./helpers.ts";

const INBOX = ["id", "hash"];
const PRIORITIES = ["id", "hash"];

type App = Awaited<ReturnType<typeof testApp>>["app"];

const inboxHash = async (app: App) =>
  (await byId(app, "Inbox", ["inbox"], INBOX))[0].hash as string;

const prioritiesHash = async (app: App) =>
  (await byId(app, "Priorities", ["priorities"], PRIORITIES))[0].hash as string;

const read = (repo: string, path: string) => readFileSync(join(repo, path), "utf8");

test("inbox.outline indents a note under the one above, and outdents it back", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const before = read(repo, "specs/INBOX.md");

  const indented = await mutate(
    app,
    "inbox.outline",
    { hash: await inboxHash(app), kind: "indent", note: "note-2" },
    INBOX,
  );
  expect(read(repo, "specs/INBOX.md")).toContain(
    "- Specs are still way too long and hard to read\n  - We'll need a model selector for each step\n",
  );
  const outdented = await mutate(
    app,
    "inbox.outline",
    { at: 0, hash: indented.data.hash, kind: "outdent", note: "note-1" },
    INBOX,
  );

  expect(outdented.ok).toBe(true);
  expect(read(repo, "specs/INBOX.md")).toBe(before);
});

test("inbox.outline over a changed inbox is a conflict", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const hash = await inboxHash(app);
  writeFileSync(join(repo, "specs/INBOX.md"), `${read(repo, "specs/INBOX.md")}- Elsewhere\n`);

  const result = await mutate(
    app,
    "inbox.outline",
    { hash, kind: "indent", note: "note-2" },
    INBOX,
  );

  expect(result.ok).toBe(false);
  expect(result.error?.message).toMatch(/^conflict: /);
});

test("inbox.drop puts a note into a category, then under a note's nested item", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);

  const moved = await mutate(
    app,
    "inbox.drop",
    { category: "CLI", hash: await inboxHash(app), index: 0, note: "note-3" },
    INBOX,
  );
  expect(read(repo, "specs/INBOX.md")).toContain("## CLI\n\n- We need a home icon\n- Allow");
  const under = await mutate(
    app,
    "inbox.drop",
    { hash: moved.data.hash, index: 0, note: "note-10", under: "note-9" },
    INBOX,
  );
  await mutate(
    app,
    "inbox.drop",
    { hash: under.data.hash, index: 0, note: "note-1", under: "note-9", underAt: 0 },
    INBOX,
  );

  expect(read(repo, "specs/INBOX.md")).toContain(
    "- Allow no selection in responses (after a warning)\n  - Make sure agents are resumable\n    - Specs are still way too long and hard to read\n",
  );
});

test("inbox.drop naming both a note and a category is refused, the inbox untouched", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const before = read(repo, "specs/INBOX.md");

  const result = await mutate(
    app,
    "inbox.drop",
    { category: "CLI", hash: await inboxHash(app), index: 0, note: "note-3", under: "note-1" },
    INBOX,
  );

  expect(result.ok).toBe(false);
  expect(result.error?.message).toBe("refused: a drop goes under an item or into a list, not both");
  expect(read(repo, "specs/INBOX.md")).toBe(before);
});

test("proposals.outline indents a proposal under the one above, and outdents it back", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const before = read(repo, "specs/PRIORITIES.md");

  const indented = await mutate(
    app,
    "proposals.outline",
    { hash: await prioritiesHash(app), kind: "indent", proposal: "later-2" },
    PRIORITIES,
  );
  expect(read(repo, "specs/PRIORITIES.md")).toContain(
    "- Nix + Docker based execution environments\n  - with a cache\n  - Benchmarks: after the runner is ready\n",
  );
  await mutate(
    app,
    "proposals.outline",
    { at: 1, hash: indented.data.hash, kind: "outdent", proposal: "later-1" },
    PRIORITIES,
  );

  expect(read(repo, "specs/PRIORITIES.md")).toBe(before);
});

test("proposals.drop moves a proposal with its items to a section, then under a nested item", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);

  const moved = await mutate(
    app,
    "proposals.drop",
    { hash: await prioritiesHash(app), index: 0, proposal: "later-1", section: "next" },
    PRIORITIES,
  );
  expect(read(repo, "specs/PRIORITIES.md")).toContain(
    "- Nix + Docker based execution environments\n  - with a cache\n- Claude Code runner",
  );
  await mutate(
    app,
    "proposals.drop",
    { hash: moved.data.hash, index: 0, proposal: "later-1", under: "next-1", underAt: 0 },
    PRIORITIES,
  );

  expect(read(repo, "specs/PRIORITIES.md")).toContain(
    "  - with a cache\n    - Benchmarks: after the runner is ready\n- Claude Code runner",
  );
});

test("proposals.drop refuses a drop naming both, and nesting a proposal with a file", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const before = read(repo, "specs/PRIORITIES.md");
  const hash = await prioritiesHash(app);

  const both = await mutate(
    app,
    "proposals.drop",
    { hash, index: 0, proposal: "later-2", section: "now", under: "later-1" },
    PRIORITIES,
  );
  const withFile = await mutate(
    app,
    "proposals.drop",
    { hash, index: 0, proposal: "next-2", under: "next-1" },
    PRIORITIES,
  );

  expect(both.error?.message).toBe("refused: a drop goes under an item or into a list, not both");
  expect(withFile.error?.message).toMatch(/^refused: A proposal with a file stays a proposal/);
  expect(read(repo, "specs/PRIORITIES.md")).toBe(before);
});

test("inbox.underProposal puts a note under a proposal, and inbox.undoUnderProposal takes it back", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const inbox = read(repo, "specs/INBOX.md");
  const priorities = read(repo, "specs/PRIORITIES.md");
  const [before] = await byId(app, "Inbox", ["inbox"], ["id", "hash", "categories"]);
  const note = before.categories[0].notes[0] as { id: string; lines: Array<string> };

  const moved = await mutate(
    app,
    "inbox.underProposal",
    {
      hash: before.hash,
      note: note.id,
      prioritiesHash: await prioritiesHash(app),
      proposal: "later-1",
    },
    INBOX,
  );
  expect(moved.ok).toBe(true);
  expect(read(repo, "specs/PRIORITIES.md")).toContain(
    "  - with a cache\n  - Specs are still way too long and hard to read\n- Benchmarks",
  );
  const undone = await mutate(
    app,
    "inbox.undoUnderProposal",
    { index: 0, lines: note.lines, proposalKey: "nix-docker-based-execution-environments" },
    INBOX,
  );

  expect(undone.ok).toBe(true);
  expect(read(repo, "specs/INBOX.md")).toBe(inbox);
  expect(read(repo, "specs/PRIORITIES.md")).toBe(priorities);
});
