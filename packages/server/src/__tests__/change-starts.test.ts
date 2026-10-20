// The starts of a change from the New page's lists: an inbox note (US3 2), its note leaving the
// inbox in its own commit, and a priority line's draft, each sending the change's first run.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { binding, type Data, git, mutate, testServer } from "./helpers.ts";

const INBOX = "specs/INBOX.md";
/** A note of the fixture's inbox, committed. */
const NOTE = "We need a home icon";
const STARTED_FIELDS = ["id", "folder", "kind", "session"];

type Server = Awaited<ReturnType<typeof testServer>>;

/** The id of the note reading `text`, and the inbox's hash. */
async function noteOf(server: Server, text: string) {
  const inbox = await binding.readInbox(server.repo);
  const note = inbox.categories
    .flatMap((category) => category.notes)
    .find((found) => found.text === text);
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
  // An unrelated edit in the main checkout: a typed start leaves it (R10).
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

/** US3 2, from a priority line: its draft starts as a change, and the change's agent works. */
test("change.startDraft starts the draft as a change and sends its first run", async () => {
  const server = await testServer();
  server.adapter.script([]);

  const started = await mutate(
    server.app,
    "change.startDraft",
    { draft: "specs/drafts/git-listener.md", slug: "git-listener" },
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
