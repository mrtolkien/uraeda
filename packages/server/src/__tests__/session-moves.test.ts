import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import type { AgentEvent } from "../runner/events.ts";
import { movedOpening } from "../runner/moves.ts";
import { binding, type Data, git, mutate, testServer } from "./helpers.ts";

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";

const PROPOSAL =
  "# Login redirects twice\n\nAfter signing in, the app shows the home page, then the sign-in page again.";
const FEATURE_FIELDS = ["id", "folder", "kind", "session"];

type Server = Awaited<ReturnType<typeof testServer>>;

/** The branches matching `pattern`, a line each, without the marks of checked-out ones. */
const branches = (server: Server, pattern: string) =>
  git(server.repo, "branch", "--list", "--format=%(refname:short)", pattern);

/** An edit of `file`, as the agent's tool call reports it. */
const edit = (file: string): Array<AgentEvent> => [
  { id: `edit-${file}`, input: {}, kind: "edit", name: "Edit", target: file, type: "toolStart" },
  { id: `edit-${file}`, isError: false, output: "", type: "toolEnd" },
];

/** A session without a workflow, whose agent edited `src/auth/guard.ts` in the main checkout. */
async function chatThatEdited(server: Server): Promise<string> {
  const chat = await mutate(server.app, "session.newChat", {}, ["id"]);
  const id = chat.data.id as string;
  server.adapter.script(edit("src/auth/guard.ts"));
  const sent = await mutate(
    server.app,
    "session.send",
    { session: id, text: "Why does login redirect twice?" },
    ["id", "turns"],
  );
  await server.sessions.settled(Number(sent.data.turns.at(-1)));
  mkdirSync(join(server.repo, "src/auth"), { recursive: true });
  writeFileSync(join(server.repo, "src/auth/guard.ts"), "export const once = true;\n");
  return id;
}

/** Moves the session to a change, and waits for the change's run to end. */
async function toChange(server: Server, session: string, slug = "login-redirect") {
  server.adapter.script([]);
  const moved = await mutate(
    server.app,
    "session.toChange",
    { session, slug, text: PROPOSAL },
    FEATURE_FIELDS,
  );
  const turns = server.sessions.cache.turns(session);
  await server.sessions.settled(turns.at(-1)!.id);
  return moved;
}

test("toChange starts the change and runs it in the session", async () => {
  const server = await testServer();
  const chat = await chatThatEdited(server);

  const moved = await toChange(server, chat);

  expect(moved.error).toBeUndefined();
  const { folder } = moved.data as Record<string, Data>;
  expect(folder).toMatch(/^\d{4}-\d{2}-\d{2}-login-redirect$/);
  expect(moved.data).toMatchObject({ kind: "change", session: chat });
  const branch = `change/${folder}`;
  expect(git(server.repo, "show", `${branch}:specs/changes/${folder}/proposal.md`)).toBe(
    `${PROPOSAL}\n`,
  );
  const { cache } = server.sessions;
  expect(cache.session(chat)?.folder).toBe(folder);
  const opening = movedOpening({
    branch,
    edited: ["src/auth/guard.ts"],
    folder,
    worktree: await binding.workDir(server.repo, folder),
  });
  const turn = cache.turns(chat).at(-1)!;
  expect(turn).toMatchObject({ kind: "workflow", state: "done", step: "change", trigger: "start" });
  expect(cache.items(turn.id, 0, 1)).toEqual([
    expect.objectContaining({ kind: "message", opening, origin: "workflow" }),
  ]);
  const sent = server.adapter.sent.at(-1)?.text ?? "";
  expect(sent.startsWith(`${opening}\n/uraeda Continue the change specs/changes/${folder}/`)).toBe(
    true,
  );
  expect(server.adapter.opens.at(-1)?.cwd).toBe(await binding.workDir(server.repo, folder));
});

/** SC-002: the turns before a move, or before a new session, stay where they were. */
test("earlier turns stay on their session", async () => {
  const server = await testServer();
  const chat = await chatThatEdited(server);
  const [first] = server.sessions.cache.turns(chat);
  const items = server.sessions.cache.items(first!.id, 0, 10);

  const moved = await toChange(server, chat);
  const created = await mutate(server.app, "session.new", { folder: moved.data.folder }, ["id"]);

  const { cache } = server.sessions;
  expect(cache.turns(chat).map((turn) => turn.id)[0]).toBe(first!.id);
  expect(cache.turns(chat)).toHaveLength(2);
  expect(cache.items(first!.id, 0, 10)).toEqual(items);
  expect(cache.turns(created.data.id as string)).toEqual([]);
});

test("a taken slug is refused with its message", async () => {
  const server = await testServer();
  const first = await chatThatEdited(server);
  const second = await chatThatEdited(server);
  const moved = await toChange(server, first);

  server.adapter.script([]);
  const refused = await mutate(
    server.app,
    "session.toChange",
    { session: second, slug: "login-redirect", text: PROPOSAL },
    FEATURE_FIELDS,
  );

  expect(refused.error?.message).toBe(
    `refused: A branch or folder named ${moved.data.folder} exists: pick another slug`,
  );
  expect(server.sessions.cache.session(second)?.folder).toBeNull();
});

/** US2 more 2: the card's start waits while the agent works. */
test("toChange waits while the agent works", async () => {
  const server = await testServer();
  const chat = await mutate(server.app, "session.newChat", {}, ["id"]);
  await mutate(server.app, "session.send", { session: chat.data.id, text: "Hello" }, ["id"]);

  const refused = await mutate(
    server.app,
    "session.toChange",
    { session: chat.data.id, slug: "login-redirect", text: PROPOSAL },
    FEATURE_FIELDS,
  );

  expect(refused.error?.message).toBe("refused: The agent is working");
  expect(branches(server, "change/*")).toBe("");
});

/** Edge case: the change starts, then the session cannot move to it. */
test("a failed attach leaves the session without a workflow", async () => {
  const server = await testServer();
  const chat = await chatThatEdited(server);
  vi.spyOn(server.sessions.cache, "attach").mockImplementation(() => {
    throw new Error("database is locked");
  });

  const moved = await mutate(
    server.app,
    "session.toChange",
    { session: chat, slug: "login-redirect", text: PROPOSAL },
    FEATURE_FIELDS,
  );

  const folder = branches(server, "change/*")
    .trim()
    .replace(/^change\//, "");
  expect(folder).toMatch(/^\d{4}-\d{2}-\d{2}-login-redirect$/);
  expect(moved.error?.message).toBe(
    `refused: The change ${folder} started, but this session could not move to it: database is locked`,
  );
  expect(server.sessions.cache.session(chat)?.folder).toBeNull();
  expect(server.sessions.cache.turns(chat)).toHaveLength(1);
});

/** US4.1: the same session goes on with the feature's next step. */
test("promote runs the next step in the session", async () => {
  const server = await testServer();
  const chat = await chatThatEdited(server);
  const moved = await toChange(server, chat);
  const folder = moved.data.folder as string;

  server.adapter.script([]);
  const promoted = await mutate(server.app, "feature.promote", { folder }, FEATURE_FIELDS);

  expect(promoted.error).toBeUndefined();
  expect(promoted.data).toMatchObject({ folder, kind: "feature", session: chat });
  expect(branches(server, folder).trim()).toBe(folder);
  const turn = server.sessions.cache.turns(chat).at(-1)!;
  await server.sessions.settled(turn.id);
  expect(turn).toMatchObject({ kind: "workflow", trigger: "manual" });
  expect(server.adapter.sent.at(-1)?.text).toContain(
    `/uraeda Continue the feature specs/${folder}/ on branch ${folder}: `,
  );
});

/** US5.1: a new session of a feature, in its worktree, without the earlier turns. */
test("a new session of a feature works in its worktree", async () => {
  const server = await testServer();
  server.adapter.script([]);
  const first = await mutate(server.app, "session.send", { folder: AGENT, text: "Hello" }, [
    "id",
    "turns",
  ]);
  await server.sessions.settled(Number(first.data.turns.at(-1)));

  const created = await mutate(server.app, "session.new", { folder: AGENT }, [
    "id",
    "folder",
    "turns",
  ]);
  expect(created.error).toBeUndefined();
  expect(created.data).toMatchObject({ folder: AGENT, turns: [] });
  expect(created.data.id).not.toBe(first.data.id);
  server.adapter.script([]);
  const sent = await mutate(
    server.app,
    "session.send",
    { session: created.data.id, text: "Go on" },
    ["id", "turns"],
  );
  await server.sessions.settled(Number(sent.data.turns.at(-1)));

  expect(server.adapter.opens.at(-1)).toMatchObject({
    cwd: await binding.workDir(server.repo, AGENT),
    resume: false,
  });
  const root = await server.sessions.mainRoot(server.repo);
  expect(server.sessions.cache.latestSession(root, AGENT)?.id).toBe(created.data.id);
});

/** US2 more 4: a dropped change's sessions are archived, and its branch stays. */
test("drop archives the sessions", async () => {
  const server = await testServer();
  const chat = await chatThatEdited(server);
  const moved = await toChange(server, chat);
  const folder = moved.data.folder as string;
  const created = await mutate(server.app, "session.new", { folder }, ["id"]);

  const dropped = await mutate(server.app, "feature.drop", { folder }, [
    "id",
    "branch",
    "worktreeLeft",
    "committed",
  ]);

  expect(dropped.error).toBeUndefined();
  expect(dropped.data).toMatchObject({
    branch: `change/${folder}`,
    committed: true,
    id: folder,
    worktreeLeft: null,
  });
  const { cache } = server.sessions;
  expect(cache.session(chat)?.archivedAt).not.toBeNull();
  expect(cache.session(created.data.id as string)?.archivedAt).not.toBeNull();
  expect(branches(server, `change/${folder}`).trim()).toBe(`change/${folder}`);
});
