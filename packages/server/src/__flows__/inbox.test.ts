// The inbox and its triage on the default branch: a note moves between the inbox, the priorities,
// and the drafts as the human triages, each move written over the hashes the page read, and undone
// whole. The triage's answers are committed only when the human submits them.
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import {
  byId,
  type Data,
  fixture,
  fixtureRepo,
  git,
  mutate,
  testApp,
} from "../__tests__/helpers.ts";

const INBOX = ["id", "hash", "categories", "count", "changes", "triage"];
const FILE = ["id", "name", "status", "current"];

type App = Awaited<ReturnType<typeof testApp>>["app"];

const readInbox = async (app: App) => (await byId(app, "Inbox", ["inbox"], INBOX))[0];
const read = (repo: string, path: string) => readFileSync(join(repo, path), "utf8");

/** The note of the inbox whose text is `text`. */
const noteOf = (inbox: Data, text: string) =>
  inbox.categories
    .flatMap((category: { notes: Array<{ text: string }> }) => category.notes)
    .find((note: { text: string }) => note.text === text);

const FILES = ["specs/INBOX.md", "specs/PRIORITIES.md"];

test("a note moved to the priorities leaves the inbox and joins them, uncommitted, and Undo restores both", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const before = FILES.map((path) => read(repo, path));
  const inbox = await readInbox(app);
  const note = noteOf(inbox, "Draft to proposal on mobile went 404");
  // Where the note stood, which Undo puts it back to.
  const place = inbox.categories
    .map((category: { name?: string; notes: Array<{ id: string }> }) => ({
      index: category.notes.findIndex((each) => each.id === note.id),
      name: category.name,
    }))
    .find((found: { index: number }) => found.index >= 0);
  const [priorities] = await byId(app, "Priorities", ["priorities"], ["id", "hash"]);
  const head = git(repo, "rev-parse", "HEAD");

  const moved = await mutate(
    app,
    "inbox.toPriorities",
    { hash: inbox.hash, note: note.id, prioritiesHash: priorities.hash, section: "next" },
    INBOX,
  );

  expect(moved.ok).toBe(true);
  expect(read(repo, "specs/INBOX.md")).not.toContain(note.text);
  expect(read(repo, "specs/PRIORITIES.md")).toContain(note.text);
  expect(git(repo, "rev-parse", "HEAD")).toBe(head);

  const undone = await mutate(
    app,
    "inbox.undoToPriorities",
    { category: place.name, index: place.index, lines: note.lines, section: "next" },
    INBOX,
  );
  expect(undone.ok).toBe(true);
  expect(FILES.map((path) => read(repo, path))).toEqual(before);
});

test("a move over a file that changed since the page read it is refused, and nothing is written", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const inbox = await readInbox(app);
  const [priorities] = await byId(app, "Priorities", ["priorities"], ["id", "hash"]);
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    `${read(repo, "specs/PRIORITIES.md")}\n- By hand\n`,
  );
  const before = FILES.map((path) => read(repo, path));

  const moved = await mutate(
    app,
    "inbox.toPriorities",
    {
      hash: inbox.hash,
      note: noteOf(inbox, "We need a home icon").id,
      prioritiesHash: priorities.hash,
      section: "next",
    },
    INBOX,
  );

  expect(moved.ok).toBe(false);
  expect(moved.error?.message).toMatch(/^conflict: /);
  expect(FILES.map((path) => read(repo, path))).toEqual(before);
});

test("a note made a new draft is a draft file linked from the priorities, and leaves the inbox", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const inbox = await readInbox(app);
  const note = noteOf(inbox, "We need a home icon");
  const [priorities] = await byId(app, "Priorities", ["priorities"], ["id", "hash"]);

  const made = await mutate(
    app,
    "inbox.toNewDraft",
    { hash: inbox.hash, note: note.id, prioritiesHash: priorities.hash, section: "later" },
    ["id", "path"],
  );

  expect(made.ok).toBe(true);
  const path = made.data.path as string;
  expect(path.startsWith("specs/drafts/")).toBe(true);
  expect(read(repo, path)).toContain(note.text);
  expect(read(repo, "specs/PRIORITIES.md")).toContain(`](${path.replace("specs/", "")})`);
  expect(read(repo, "specs/INBOX.md")).not.toContain(note.text);
});

/** A repository whose main checkout holds the fixture's triage, committed. */
function triageRepo() {
  const repo = fixtureRepo();
  copyFileSync(fixture("INBOX-TRIAGE.md"), join(repo, "specs/INBOX-TRIAGE.md"));
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "chore: propose an inbox triage");
  return repo;
}

test("the triage is answered in the file, and committed only when submitted", async () => {
  const repo = triageRepo();
  const { app } = await testApp(repo);
  const head = git(repo, "rev-parse", "HEAD");
  const [opened] = await byId(app, "WorkflowFile", ["inbox-triage"], FILE);
  let base = opened.current.document.hash as string;

  for (const question of ["Q1", "Q2", "Q3"]) {
    const saved = await mutate(
      app,
      "defaultRound.answer",
      { base, comment: "", id: "inbox-triage", letters: ["A"], previous: "", question },
      FILE,
    );
    expect(saved.ok, question).toBe(true);
    base = saved.data.current.document.hash;
  }

  expect(read(repo, "specs/INBOX-TRIAGE.md")).toContain("**Answer:** A");
  expect(git(repo, "rev-parse", "HEAD")).toBe(head);

  const submitted = await mutate(
    app,
    "defaultRound.submit",
    { id: "inbox-triage", previous: base },
    FILE,
  );

  expect(submitted.ok).toBe(true);
  expect(git(repo, "rev-parse", "HEAD")).not.toBe(head);
  expect(git(repo, "status", "--porcelain")).toBe("");
});

test("a triage that changed since the page read it is not submitted", async () => {
  const repo = triageRepo();
  const { app } = await testApp(repo);
  const [opened] = await byId(app, "WorkflowFile", ["inbox-triage"], FILE);
  const head = git(repo, "rev-parse", "HEAD");
  writeFileSync(
    join(repo, "specs/INBOX-TRIAGE.md"),
    opened.current.text.replaceAll("**Answer:**\n", "**Answer:** A\n"),
  );

  const result = await mutate(
    app,
    "defaultRound.submit",
    { id: "inbox-triage", previous: opened.current.document.hash },
    ["id"],
  );

  expect(result.ok).toBe(false);
  expect(result.error?.message).toMatch(/^conflict: /);
  expect(git(repo, "rev-parse", "HEAD")).toBe(head);
});
