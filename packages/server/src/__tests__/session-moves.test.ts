import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import type { AgentEvent } from "../runner/events.ts";
import { movedOpening } from "../runner/moves.ts";
import { binding, type Data, git, mutate, testServer } from "./helpers.ts";
import { connect, subscribe } from "./live-stream.ts";

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";

const PROPOSAL =
  "# Login redirects twice\n\nAfter signing in, the app shows the home page, then the sign-in page again.";
/** The refusal of a message, a run, or a new session of a dropped change or feature. */
const DROPPED = "This change or feature was dropped: its branch stays.";
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

/** The core's other taken-name refusals read the card's words, never the CLI's `--slug` hint. */
test.each(["a slug with an accent", "a worktree folder"])(
  "a name taken by %s is refused with the card's message",
  async (taken) => {
    const server = await testServer();
    const first = await chatThatEdited(server);
    const second = await chatThatEdited(server);
    const slug = taken === "a worktree folder" ? "login-redirect" : "connexion-réussie";
    let folder: string;
    if (taken === "a worktree folder") {
      const today = ((await toChange(server, first, "other")).data.folder as string).slice(0, 10);
      folder = `${today}-${slug}`;
      mkdirSync(join(server.repo, ".worktrees", folder), { recursive: true });
    } else {
      folder = (await toChange(server, first, slug)).data.folder as string;
    }

    server.adapter.script([]);
    const refused = await mutate(
      server.app,
      "session.toChange",
      { session: second, slug, text: PROPOSAL },
      FEATURE_FIELDS,
    );

    expect(refused.error?.message).toBe(
      `refused: A branch or folder named ${folder} exists: pick another slug`,
    );
    expect(server.sessions.cache.session(second)?.folder).toBeNull();
  },
);

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

/** Review: without the agent, the session would move with no run to tell it where it works now. */
test("toChange waits for the agent", async () => {
  const server = await testServer();
  const chat = await chatThatEdited(server);
  server.adapter.installed = false;
  await server.sessions.check();

  const refused = await mutate(
    server.app,
    "session.toChange",
    { session: chat, slug: "login-redirect", text: PROPOSAL },
    FEATURE_FIELDS,
  );

  expect(refused.error?.message).toBe("refused: Claude Code is not available on this machine.");
  expect(branches(server, "change/*")).toBe("");
  expect(server.sessions.cache.session(chat)?.folder).toBeNull();
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
  // Its next message is a chat's, in the main checkout: no change's folder works while it runs.
  vi.restoreAllMocks();
  let working: Array<string> | undefined;
  server.adapter.script([
    () => {
      working = server.sessions.working(server.repo);
    },
  ]);
  const sent = await mutate(server.app, "session.send", { session: chat, text: "Go on" }, ["id"]);
  expect(sent.error).toBeUndefined();
  const turn = server.sessions.cache.turns(chat).at(-1)!;
  await server.sessions.settled(turn.id);
  expect(turn).toMatchObject({ kind: "chat", step: null });
  expect(server.sessions.cache.items(turn.id, 0, 1)).toEqual([
    expect.not.objectContaining({ opening: expect.anything() }),
  ]);
  expect(working).toEqual([]);
  expect(server.adapter.opens.at(-1)?.cwd).toBe(server.repo);
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

/** US5.1: an open feature's page is sent its new session, so its Sessions card lists both. */
test("a new session of a feature reaches a subscribed feature", async () => {
  const server = await testServer();
  const first = await server.sessions.featureSession(server.repo, AGENT);
  const stream = await connect(server.app, server.name, "c-new");
  expect(await stream.arrival("connected", 5000)).toBeDefined();
  await subscribe(server.app, server.name, "c-new", {
    entityId: AGENT,
    select: ["id", "sessions"],
    type: "Feature",
  });
  const before = stream.mark();

  const created = await mutate(server.app, "session.new", { folder: AGENT }, ["id"]);

  const sessions = JSON.stringify([created.data.id, first.id]);
  const arrived = await stream.arrival(sessions, 5000, before);
  await stream.close();
  expect(arrived, "no update of the feature within 5 seconds").toBeDefined();
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

/** Review: a dropped change takes no message, and nothing recreates its worktree. */
test.each([
  ["a message to its session", "session"],
  ["its run", "run"],
  ["a new session", "new"],
])("a dropped change refuses %s", async (_name, how) => {
  const server = await testServer();
  const chat = await chatThatEdited(server);
  const folder = (await toChange(server, chat)).data.folder as string;
  await mutate(server.app, "feature.drop", { folder }, ["id"]);
  const opens = server.adapter.opens.length;

  const refused =
    how === "new"
      ? await mutate(server.app, "session.new", { folder }, ["id"])
      : await mutate(
          server.app,
          "session.send",
          how === "session"
            ? { session: chat, text: "Go on" }
            : { folder, text: "Go on", workflow: { trigger: "manual" } },
          ["id"],
        );

  expect(refused.error?.message).toBe(`refused: ${DROPPED}`);
  const { cache } = server.sessions;
  expect(cache.session(chat)?.archivedAt).not.toBeNull();
  expect(cache.folderSessions(cache.session(chat)!.repo, folder)).toHaveLength(1);
  expect(cache.turns(chat)).toHaveLength(2);
  expect(server.adapter.opens).toHaveLength(opens);
  expect(existsSync(join(server.repo, ".worktrees", folder))).toBe(false);
});

/** A binding whose `call` waits, once `armed`, until the test releases it. */
function holding(call: "dropItem" | "promoteChange" | "startChange" | "workDir") {
  const gate = { armed: false, calls: 0, ...Promise.withResolvers<void>() };
  const real = binding[call] as (...args: Array<unknown>) => Promise<unknown>;
  const using = {
    ...binding,
    [call]: async (...args: Array<unknown>) => {
      if (gate.armed) {
        gate.calls++;
        await gate.promise;
      }
      return real(...args);
    },
  } as typeof binding;
  return { gate, using };
}

/** A change made from a session, and a second session of it, never run. */
async function changeWithTwoSessions(server: Server) {
  const chat = await chatThatEdited(server);
  const folder = (await toChange(server, chat)).data.folder as string;
  const created = await mutate(server.app, "session.new", { folder }, ["id"]);
  return { chat, folder, other: created.data.id as string };
}

/** A session of the change works, or its turn only starts: its process opens. */
test.each([
  ["feature.drop", "works"],
  ["feature.drop", "starts"],
  ["feature.promote", "works"],
  ["feature.promote", "starts"],
])("%s waits while a session of it %s", async (move, state) => {
  const { gate, using } = holding("workDir");
  const server = await testServer(undefined, { binding: using });
  const { folder, other } = await changeWithTwoSessions(server);
  gate.armed = state === "starts";
  // Without a script, the turn runs until it is stopped.
  const sent = mutate(server.app, "session.send", { session: other, text: "Fix it" }, ["id"]);
  if (state === "starts") {
    await vi.waitFor(() => expect(gate.calls).toBe(1));
  } else {
    await sent;
  }

  const refused = await mutate(server.app, move, { folder }, ["id"]);

  expect(refused.error?.message).toBe("refused: The agent is working");
  expect(branches(server, `change/${folder}`).trim()).toBe(`change/${folder}`);
  gate.armed = false;
  gate.resolve();
  expect((await sent).error).toBeUndefined();
});

/** The sessions of a folder that moves, or of a session becoming a change, take no message. */
test.each([
  ["feature.drop", "dropItem"],
  ["feature.promote", "promoteChange"],
  ["session.toChange", "startChange"],
] as const)("%s refuses a message sent during it", async (move, call) => {
  const { gate, using } = holding(call);
  const server = await testServer(undefined, { binding: using });
  const target =
    move === "session.toChange"
      ? { folder: undefined, session: await chatThatEdited(server) }
      : await changeWithTwoSessions(server).then(({ folder, other }) => ({
          folder,
          session: other,
        }));
  gate.armed = true;
  const input =
    move === "session.toChange"
      ? { session: target.session, slug: "login-redirect", text: PROPOSAL }
      : { folder: target.folder };
  server.adapter.script([]);
  const moving = mutate(server.app, move, input, ["id"]);
  await vi.waitFor(() => expect(gate.calls).toBe(1));

  const refused = await mutate(
    server.app,
    "session.send",
    { session: target.session, text: "And this?" },
    ["id"],
  );

  expect(refused.error?.message).toBe("refused: The agent is working");
  gate.armed = false;
  gate.resolve();
  expect((await moving).error).toBeUndefined();
  expect(server.adapter.sent.map(({ text }) => text)).not.toContain("And this?");
});
