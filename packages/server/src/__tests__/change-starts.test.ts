// The starts of a change from the New page's lists: an inbox note (US3 2), its note leaving the
// inbox in its own commit, and a proposal's file, each sending the change's first run.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { binding, type Data, fixture, git, mutate, testServer } from "./helpers.ts";

const INBOX = "specs/INBOX.md";
/** A note of the fixture's inbox, committed. */
const NOTE = "We need a home icon";
const STARTED_FIELDS = ["id", "folder", "kind", "session"];

type Server = Awaited<ReturnType<typeof testServer>>;

/** The id of the note reading `text`, or whose note file it titles, and the inbox's hash. */
async function noteOf(server: Server, text: string) {
  const inbox = await binding.readInbox(server.repo);
  const note = inbox.categories
    .flatMap((category) => category.notes)
    .find((found) => found.text === text || found.fileTitle === text);
  return { hash: inbox.hash, note: note!.id };
}

/** The change's run sent to its session, once it ended. */
async function sentRun(server: Server, session: string) {
  const turns = server.sessions.cache.turns(session);
  await server.sessions.settled(turns.at(-1)!.id);
  return server.adapter.sent;
}

/** US3 2, SC-004 */
test("change.fromNote starts a change from a committed note, which leaves the inbox in its own commit", async () => {
  const server = await testServer();
  // An unrelated edit in the main checkout: a start leaves it as it is.
  writeFileSync(join(server.repo, "specs/README.md"), "# Specs, edited\n");
  server.adapter.script([]);

  const started = await mutate(
    server.app,
    "change.fromNote",
    await noteOf(server, NOTE),
    STARTED_FIELDS,
  );

  expect(started.error).toBeUndefined();
  const { folder, session } = started.data as Record<string, string>;
  expect(folder).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z-]+$/);
  expect(
    git(server.repo, "show", `change/${folder}:specs/changes/${folder}/proposal.md`),
  ).toContain(NOTE);
  expect(readFileSync(join(server.repo, INBOX), "utf8")).not.toContain(NOTE);
  expect(git(server.repo, "log", "-1", "--format=%s", "main")).toBe(
    `chore: remove "${NOTE}" from the inbox\n`,
  );
  expect(git(server.repo, "status", "--porcelain", INBOX)).toBe("");
  expect(readFileSync(join(server.repo, "specs/README.md"), "utf8")).toBe("# Specs, edited\n");
  const [sent] = await sentRun(server, session);
  expect(sent.text).toMatch(new RegExp(`^/uraeda Continue the change specs/changes/${folder}/`));
});

/**
 * A note with a note file: the change takes the note's title, the file's text as typed, and its
 * image, read before the note leaves the inbox.
 */
test("change.fromNote starts a change from a note file's title, text, and image", async () => {
  const server = await testServer();
  const { hash } = await binding.readInbox(server.repo);
  const file = await binding.addNoteWithImages(
    server.repo,
    "Headings are flat",
    hash,
    [readFileSync(fixture("images/phone.png"))],
    ["phone.png"],
  );
  // Typed under the title of the freeform note file.
  const typed = readFileSync(join(server.repo, file), "utf8").replace(
    "# Headings are flat\n",
    "# Headings are flat\n\nReaders lose their place.\n",
  );
  writeFileSync(join(server.repo, file), typed);
  server.adapter.script([]);

  const started = await mutate(
    server.app,
    "change.fromNote",
    await noteOf(server, "Headings are flat"),
    STARTED_FIELDS,
  );

  expect(started.error).toBeUndefined();
  const { folder } = started.data as Record<string, string>;
  const branch = `change/${folder}`;
  const proposal = git(server.repo, "show", `${branch}:specs/changes/${folder}/proposal.md`);
  expect(proposal.startsWith("# Headings are flat\n")).toBe(true);
  expect(proposal).toContain("Readers lose their place.");
  expect(proposal).toMatch(/\]\(images\/[^)]+\.webp\)/);
  const files = git(server.repo, "ls-tree", "-r", "--name-only", branch);
  expect(files).toMatch(new RegExp(`^specs/changes/${folder}/images/.+\\.webp$`, "m"));
  const subject = git(server.repo, "log", "-1", "--format=%s", branch);
  expect(subject).toContain("Headings are flat");
  expect(subject).not.toContain("](");
  expect(readFileSync(join(server.repo, INBOX), "utf8")).not.toContain("Headings are flat");
});

test("change.fromNote refused keeps the note in the inbox", async () => {
  const server = await testServer();
  const taken = await mutate(
    server.app,
    "change.start",
    { slug: "home-icon", text: "Another home icon" },
    STARTED_FIELDS,
  );
  expect(taken.error).toBeUndefined();
  const before = readFileSync(join(server.repo, INBOX), "utf8");

  const refused = await mutate(
    server.app,
    "change.fromNote",
    { ...(await noteOf(server, NOTE)), slug: "home-icon" },
    STARTED_FIELDS,
  );

  expect((refused.error as Data | undefined)?.message).toMatch(/^refused: .*home-icon/);
  expect(readFileSync(join(server.repo, INBOX), "utf8")).toBe(before);
  // Only the change that took the slug started.
  expect(git(server.repo, "branch", "--list", "--format=%(refname:short)", "change/*")).toBe(
    `change/${taken.data.folder}\n`,
  );
});

/** US3 2, from a proposal: its file starts as a change, and the change's agent works. */
test("change.startProposal starts the proposal file as a change and sends its first run", async () => {
  const server = await testServer();
  server.adapter.script([]);

  const started = await mutate(
    server.app,
    "change.startProposal",
    { proposal: "specs/proposals/git-listener.md", slug: "git-listener" },
    STARTED_FIELDS,
  );

  expect(started.error).toBeUndefined();
  const { folder, session } = started.data as Record<string, string>;
  expect(started.data).toMatchObject({
    folder: expect.stringMatching(/-git-listener$/),
    kind: "change",
  });
  const [sent] = await sentRun(server, session);
  expect(sent.text).toMatch(new RegExp(`^/uraeda Continue the change specs/changes/${folder}/`));
});

/** US6.1: `change.start`'s `line` reaches the core, which replaces the line of Now by the link. */
test("change.start from a line of Now replaces it by the change's link", async () => {
  const server = await testServer();
  const priorities = join(server.repo, "specs/PRIORITIES.md");
  writeFileSync(
    priorities,
    readFileSync(priorities, "utf8").replace(
      "- [Plan review](/specs/2026-10-13-plan-review/proposal.md)\n",
      "- [Plan review](/specs/2026-10-13-plan-review/proposal.md)\n- Centre the x\n",
    ),
  );
  git(server.repo, "commit", "--quiet", "--all", "-m", "chore: a line of Now");
  server.adapter.script([]);

  const started = await mutate(
    server.app,
    "change.start",
    { line: "Centre the x", slug: "centre-x", text: "Centre the x" },
    STARTED_FIELDS,
  );
  expect(started.error).toBeUndefined();
  await server.hosts.get(server.name)!.queue.idle();

  const after = readFileSync(priorities, "utf8");
  expect(after).toContain("[Centre the x](/specs/changes/");
  expect(after).not.toContain("- Centre the x\n");
});
