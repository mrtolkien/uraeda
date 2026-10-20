import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { byId, type Data, fixture, fixtureRepo, git, mutate, port, testApp } from "./helpers.ts";

const INBOX = ["id", "hash", "categories", "names", "count", "changes", "triage"];
const FILE = ["id", "folder", "name", "path", "kind", "status", "current", "missing"];

type App = Awaited<ReturnType<typeof testApp>>["app"];

const readInbox = async (app: App) => (await byId(app, "Inbox", ["inbox"], INBOX))[0];

/** The note of the inbox with this text. */
const noteOf = (inbox: Data, text: string) =>
  inbox.categories
    .flatMap((category: { notes: Array<{ text: string }> }) => category.notes)
    .find((note: { text: string }) => note.text === text);

/** A note's lines as written, which an Undo puts back. */
const lines = (note: unknown) => (note as { lines: Array<string> }).lines;

const read = (repo: string, path: string) => readFileSync(join(repo, path), "utf8");

/** A repository whose main checkout holds the fixture's triage, committed. */
function triageRepo() {
  const repo = fixtureRepo();
  copyFileSync(fixture("INBOX-TRIAGE.md"), join(repo, "specs/INBOX-TRIAGE.md"));
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "chore: propose an inbox triage");
  return repo;
}

test("reads the inbox by its id", async () => {
  const inbox = await readInbox((await testApp()).app);

  expect(inbox.id).toBe("inbox");
  expect(inbox.count).toBe(10);
  expect(inbox.changes).toBe(0);
  expect(inbox.names).toEqual(["UI", "CLI"]);
  expect(inbox.triage).toBeNull();
});

test("US1 1: adds a note last in its category, not committed", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const { hash } = await readInbox(app);

  const result = await mutate(
    app,
    "inbox.add",
    { category: "UI", hash, text: "The plan's task list scrolls under the top bar" },
    INBOX,
  );

  expect(result.ok).toBe(true);
  expect(result.data.count).toBe(11);
  expect(result.data.changes).toBe(1);
  const ui = result.data.categories.find((category: { name?: string }) => category.name === "UI");
  expect(ui.notes.at(-1).text).toBe("The plan's task list scrolls under the top bar");
  expect(read(repo, "specs/INBOX.md")).toContain(
    "- Text input feels laggy on the sessions page\n- The plan's task list scrolls under the top bar\n",
  );
});

test("US1 4: a note about a feature is marked with its slug", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const { hash } = await readInbox(app);

  await mutate(
    app,
    "inbox.add",
    { about: "2026-10-14-run-ui", hash, text: "The x is not centered" },
    ["id"],
  );

  expect(read(repo, "specs/INBOX.md")).toContain("- [run-ui] The x is not centered\n");
});

test("an add over a stale hash is refused as a conflict", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const { hash } = await readInbox(app);
  writeFileSync(join(repo, "specs/INBOX.md"), `${read(repo, "specs/INBOX.md")}- Elsewhere\n`);

  const result = await mutate(app, "inbox.add", { hash, text: "Mine" }, ["id"]);

  expect(result.ok).toBe(false);
  expect(result.error?.code).toBe("BAD_REQUEST");
  expect(result.error?.message).toBe(
    "conflict: INBOX.md changed on disk. Your change was not applied.",
  );
});

test("edits, recategorizes, removes, and puts back a note", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const before = read(repo, "specs/INBOX.md");
  const inbox = await readInbox(app);
  const note = noteOf(inbox, "We need a home icon");

  const edited = await mutate(
    app,
    "inbox.edit",
    { hash: inbox.hash, note: note.id, text: "We need a home icon, in the sidebar" },
    INBOX,
  );
  const moved = await mutate(
    app,
    "inbox.category",
    { category: "UI", hash: edited.data.hash, note: note.id },
    INBOX,
  );
  const id = noteOf(moved.data, "We need a home icon, in the sidebar").id;
  const removed = await mutate(app, "inbox.remove", { hash: moved.data.hash, note: id }, INBOX);
  const restored = await mutate(
    app,
    "inbox.insert",
    { hash: removed.data.hash, index: 2, lines: ["- We need a home icon"] },
    INBOX,
  );

  expect(edited.data.changes).toBe(1);
  expect(read(repo, "specs/INBOX.md")).toBe(before);
  expect(restored.data.changes).toBe(0);
});

test("US5 1: places a note in its category and answers the moved inbox", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const inbox = await readInbox(app);
  const note = noteOf(inbox, "Icons are blurry on retina screens");

  const result = await mutate(
    app,
    "inbox.place",
    { category: "UI", hash: inbox.hash, index: 0, note: note.id },
    INBOX,
  );

  expect(result.ok).toBe(true);
  expect(result.data.changes).toBe(1);
  const ui = result.data.categories.find((category: { name?: string }) => category.name === "UI");
  expect(ui.notes[0].text).toBe("Icons are blurry on retina screens");
  expect(read(repo, "specs/INBOX.md")).toContain(
    "## UI\n\n- Icons are blurry on retina screens\n- [run-ui] In failures",
  );
});

test("US2 1: moves a note to a section of the priorities", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const inbox = await readInbox(app);
  const [priorities] = await byId(app, "Priorities", ["priorities"], ["id", "hash"]);

  const result = await mutate(
    app,
    "inbox.toPriorities",
    {
      hash: inbox.hash,
      note: noteOf(inbox, "Draft to proposal on mobile went 404").id,
      prioritiesHash: priorities.hash,
      section: "next",
    },
    INBOX,
  );

  expect(result.data.count).toBe(9);
  expect(result.data.changes).toBe(1);
  expect(read(repo, "specs/PRIORITIES.md")).toContain(
    "- [Git listener process](drafts/git-listener.md)\n- Draft to proposal on mobile went 404\n",
  );
});

test("US2 2: makes a note a new draft, linked from a section", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const inbox = await readInbox(app);
  const [priorities] = await byId(app, "Priorities", ["priorities"], ["id", "hash"]);

  const result = await mutate(
    app,
    "inbox.toNewDraft",
    {
      hash: inbox.hash,
      note: noteOf(inbox, "We need a home icon").id,
      prioritiesHash: priorities.hash,
      section: "later",
    },
    ["id", "path", "title"],
  );

  expect(result.data).toEqual({
    id: "specs/drafts/we-need-a-home-icon.md",
    path: "specs/drafts/we-need-a-home-icon.md",
    title: "We need a home icon",
  });
  expect(read(repo, "specs/PRIORITIES.md")).toContain(
    "- [We need a home icon](drafts/we-need-a-home-icon.md)\n",
  );
});

test("US2 3: adds a note to a draft's What", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const inbox = await readInbox(app);

  const result = await mutate(
    app,
    "inbox.toDraft",
    {
      draft: "specs/drafts/git-listener.md",
      hash: inbox.hash,
      note: noteOf(inbox, "Make sure agents are resumable").id,
    },
    INBOX,
  );

  expect(result.data.count).toBe(9);
  expect(read(repo, "specs/drafts/git-listener.md")).toContain(
    "Run the next step when a branch changes.\n\n- Make sure agents are resumable\n",
  );
});

/**
 * Posts a note with images to the repository's `/inbox/note-image`, as the add form does, or the
 * images of the note `id`, as a note's pane does: each `files` entry is a fixture, named
 * `<fixture>` in the query string.
 */
async function noteImage(
  served: Awaited<ReturnType<typeof testApp>>,
  fields: Record<string, string>,
  files: ReadonlyArray<string>,
  names = ["spec-headings.png"],
) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    body.set(key, value);
  }
  for (const file of files) {
    body.append("file", new File([readFileSync(fixture(`images/${file}`))], file));
  }
  const query = new URLSearchParams(names.map((name) => ["name", name]));
  return served.app.request(`http://127.0.0.1:${port}/r/${served.name}/inbox/note-image?${query}`, {
    body,
    method: "POST",
  });
}

test("US6 2: adds a note with an image as a draft folder, linked from the inbox", async () => {
  const repo = fixtureRepo();
  const served = await testApp(repo);
  const { hash } = await readInbox(served.app);

  const response = await noteImage(served, { category: "UI", hash, text: "Headings are flat" }, [
    "phone.png",
  ]);

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ draft: "specs/drafts/headings-are-flat/proposal.md" });
  expect(read(repo, "specs/drafts/headings-are-flat/proposal.md")).toContain(
    "Headings are flat\n\n![spec-headings](images/spec-headings.webp)\n",
  );
  expect(read(repo, "specs/INBOX.md")).toContain(
    "- [Headings are flat](drafts/headings-are-flat/proposal.md)\n",
  );
});

test("a note takes several images, in the order they were sent", async () => {
  const repo = fixtureRepo();
  const served = await testApp(repo);
  const { hash } = await readInbox(served.app);

  const response = await noteImage(
    served,
    { hash, text: "Headings are flat" },
    ["phone.png", "desktop.png"],
    ["first.png", "second.png"],
  );

  expect(response.status).toBe(200);
  const draft = read(repo, "specs/drafts/headings-are-flat/proposal.md");
  expect(draft.indexOf("![first](images/first.webp)")).toBeGreaterThan(0);
  expect(draft.indexOf("![second](images/second.webp)")).toBeGreaterThan(
    draft.indexOf("![first](images/first.webp)"),
  );
});

test("images sent with a note's id go to that note, which becomes a draft", async () => {
  const repo = fixtureRepo();
  const served = await testApp(repo);
  const inbox = await readInbox(served.app);

  const response = await noteImage(
    served,
    { hash: inbox.hash, id: noteOf(inbox, "Make sure agents are resumable").id },
    ["phone.png"],
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    draft: "specs/drafts/make-sure-agents-are-resumable/proposal.md",
  });
  expect(read(repo, "specs/INBOX.md")).toContain(
    "- [Make sure agents are resumable](drafts/make-sure-agents-are-resumable/proposal.md)\n",
  );
});

test("US6: an image the core refuses adds nothing", async () => {
  const repo = fixtureRepo();
  const served = await testApp(repo);
  const before = read(repo, "specs/INBOX.md");
  const { hash } = await readInbox(served.app);

  const response = await noteImage(served, { hash, text: "Headings are flat" }, ["drawing.svg"]);

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error:
      "refused: Only PNG, JPEG, GIF, and WebP images can be added: spec-headings.png is not one.",
  });
  expect(read(repo, "specs/INBOX.md")).toBe(before);
  expect(existsSync(join(repo, "specs/drafts/headings-are-flat"))).toBe(false);
});

test("US2 7: the commit bar commits the inbox's changes", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const { hash } = await readInbox(app);
  await mutate(app, "inbox.add", { hash, text: "A note to commit" }, ["id"]);

  const committed = await mutate(app, "changes.commit", {}, ["id", "changes"]);

  expect(committed.data).toEqual({ changes: 0, id: "priorities" });
  expect((await readInbox(app)).changes).toBe(0);
  expect(git(repo, "log", "-1", "--format=%s").trim()).toBe(
    'chore: add "A note to commit" to the inbox',
  );
});

test("the commit bar's Discard restores the inbox", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const before = read(repo, "specs/INBOX.md");
  const { hash } = await readInbox(app);
  await mutate(app, "inbox.add", { hash, text: "A note to discard" }, ["id"]);

  const discarded = await mutate(app, "changes.discard", {}, ["id", "changes"]);

  expect(discarded.data.changes).toBe(0);
  expect(read(repo, "specs/INBOX.md")).toBe(before);
});

test("the triage is missing until an agent writes it", async () => {
  const [file] = await byId((await testApp()).app, "WorkflowFile", ["inbox-triage"], FILE);

  expect(file.missing).toBe(true);
});

test("US4 2: reads the triage as a round of questions", async () => {
  const { app } = await testApp(triageRepo());

  const [file] = await byId(app, "WorkflowFile", ["inbox-triage"], FILE);

  expect(file).toMatchObject({
    folder: "",
    id: "inbox-triage",
    kind: "clarifications",
    name: "INBOX-TRIAGE.md",
    path: "specs/INBOX-TRIAGE.md",
    status: "awaiting-human",
  });
  expect(file.missing).toBeNull();
  expect(file.current.items.clarifications.questions).toHaveLength(3);
  expect((await readInbox(app)).triage).toBe("awaiting-human");
});

test("US4 2 and 3: answers the triage, then submits it", async () => {
  const repo = triageRepo();
  const { app } = await testApp(repo);

  const [opened] = await byId(app, "WorkflowFile", ["inbox-triage"], FILE);
  // Each save is based on the hash the last one wrote: the page saw all of the triage.
  const answered = await mutate(
    app,
    "defaultRound.answer",
    {
      base: opened.current.document.hash,
      comment: "",
      id: "inbox-triage",
      letters: ["A"],
      previous: "",
      question: "Q1",
    },
    FILE,
  );
  let base = answered.data.current.document.hash;
  for (const question of ["Q2", "Q3"]) {
    const saved = await mutate(
      app,
      "defaultRound.answer",
      { base, comment: "", id: "inbox-triage", letters: ["B"], previous: "", question },
      FILE,
    );
    base = saved.data.current.document.hash;
  }
  const noted = await mutate(
    app,
    "defaultRound.notes",
    { base, id: "inbox-triage", notes: "Later.", previous: "" },
    FILE,
  );
  const submitted = await mutate(
    app,
    "defaultRound.submit",
    { id: "inbox-triage", previous: noted.data.current.document.hash },
    FILE,
  );

  expect(answered.data.current.items.clarifications.questions[0].answer).toBe("A");
  expect(noted.ok).toBe(true);
  expect(submitted.data.status).toBe("answered");
  expect(read(repo, "specs/INBOX-TRIAGE.md")).toContain("**Answer:** A\n");
  expect(git(repo, "log", "-1", "--format=%s").trim()).toBe("chore: answer the inbox triage");
});

test("a triage changed since the page read it is not submitted", async () => {
  const repo = triageRepo();
  const { app } = await testApp(repo);
  const [read] = await byId(app, "WorkflowFile", ["inbox-triage"], FILE);
  writeFileSync(
    join(repo, "specs/INBOX-TRIAGE.md"),
    read.current.text.replaceAll("**Answer:**\n", "**Answer:** A\n"),
  );

  const result = await mutate(
    app,
    "defaultRound.submit",
    { id: "inbox-triage", previous: read.current.document.hash },
    ["id"],
  );

  expect(result.ok).toBe(false);
  expect(result.error?.code).toBe("BAD_REQUEST");
  expect(result.error?.message).toMatch(/^conflict: INBOX-TRIAGE\.md changed/);
  expect(git(repo, "log", "-1", "--format=%s").trim()).toBe("chore: propose an inbox triage");
});

test("an Undo of each move puts both files back in one call", async () => {
  const repo = fixtureRepo();
  const { app } = await testApp(repo);
  const before = ["specs/INBOX.md", "specs/PRIORITIES.md", "specs/drafts/git-listener.md"].map(
    (path) => read(repo, path),
  );
  const inbox = await readInbox(app);
  const [priorities] = await byId(app, "Priorities", ["priorities"], ["id", "hash"]);
  const moved = noteOf(inbox, "Draft to proposal on mobile went 404") as { id: string };
  const added = noteOf(inbox, "Make sure agents are resumable");
  const homed = noteOf(inbox, "We need a home icon");

  const toNext = await mutate(
    app,
    "inbox.toPriorities",
    { hash: inbox.hash, note: moved.id, prioritiesHash: priorities.hash, section: "next" },
    INBOX,
  );
  const toDraft = await mutate(
    app,
    "inbox.toDraft",
    {
      draft: "specs/drafts/git-listener.md",
      hash: toNext.data.hash,
      note: noteOf(toNext.data, "Make sure agents are resumable").id,
    },
    INBOX,
  );
  await mutate(
    app,
    "inbox.category",
    {
      category: "CLI",
      hash: toDraft.data.hash,
      note: noteOf(toDraft.data, "We need a home icon").id,
    },
    INBOX,
  );
  await mutate(app, "inbox.undoCategory", { index: 2, lines: lines(homed) }, INBOX);
  await mutate(
    app,
    "inbox.undoToDraft",
    { category: "CLI", draft: "specs/drafts/git-listener.md", index: 1, lines: lines(added) },
    INBOX,
  );
  const undone = await mutate(
    app,
    "inbox.undoToPriorities",
    { category: "UI", index: 1, lines: lines(moved), section: "next" },
    INBOX,
  );

  expect(undone.data.changes).toBe(0);
  expect(
    ["specs/INBOX.md", "specs/PRIORITIES.md", "specs/drafts/git-listener.md"].map((path) =>
      read(repo, path),
    ),
  ).toEqual(before);
});
