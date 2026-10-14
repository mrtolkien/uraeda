import { expect, test } from "vite-plus/test";
import type { AgentEvent } from "../runner/events.ts";
import { byId, mutate, testServer } from "./helpers.ts";

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";
/** Waits on the human, at its questions. */
const HUMAN = "2026-10-11-web-ui";

const SESSION_FIELDS = [
  "id",
  "folder",
  "agent",
  "title",
  "status",
  "statusLabel",
  "statusReason",
  "unseen",
  "place",
  "turns",
  "archived",
  "subagents",
];
const TURN_FIELDS = [
  "id",
  "session",
  "kind",
  "trigger",
  "step",
  "allowed",
  "state",
  "reason",
  "startedAt",
  "endedAt",
  "pages",
];

const REFUSED = {
  code: "BAD_REQUEST",
  message: "refused: An agent is working on this feature. Stop it first, or wait for it.",
};

const result = (extra: Partial<Extract<AgentEvent, { type: "result" }>> = {}): AgentEvent => ({
  type: "result",
  ok: true,
  errors: [],
  denials: [],
  interrupted: false,
  ...extra,
});

/** Lets the session manager read the events emitted so far. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

type Server = Awaited<ReturnType<typeof testServer>>;

/** Sends a message through `session.send`, and returns the session it went to. */
async function send(server: Server, input: Record<string, unknown>) {
  const sent = await mutate(server.app, "session.send", input, SESSION_FIELDS);
  expect(sent.error).toBeUndefined();
  return sent.data as Record<string, any>;
}

/** Waits for the session's latest turn to end. */
async function settle(server: Server, session: Record<string, any>) {
  await server.sessions.settled(Number(session.turns.at(-1)));
}

/** Stops the session's turn, and waits for it. */
async function stop(server: Server, session: Record<string, any>) {
  await server.sessions.mainRoot(server.repo);
  server.sessions.stop(server.repo, session.id);
  await settle(server, session);
}

const list = async (server: Server) =>
  ((await byId(server.app, "SessionList", ["all"], ["id", "rows"]))[0]?.rows ?? []) as Array<
    Record<string, any>
  >;

test("session.send on a feature creates its session and returns it with its first turn", async () => {
  const server = await testServer();

  const session = await send(server, { folder: HUMAN, text: "Why did you recommend A in Q6?" });

  expect(session).toMatchObject({
    folder: HUMAN,
    agent: "fake",
    title: "Web UI for the workflow files",
    status: "working",
    statusLabel: "Working",
    statusReason: null,
    unseen: false,
    place: `branch ${HUMAN}`,
    archived: false,
    subagents: [],
  });
  expect(session.turns).toHaveLength(1);
  const [turn] = await byId(server.app, "Turn", session.turns, TURN_FIELDS);
  expect(turn).toMatchObject({
    id: session.turns[0],
    session: session.id,
    kind: "chat",
    trigger: null,
    state: "running",
    pages: 1,
  });
  const [feature] = await byId(server.app, "Feature", [HUMAN], ["id", "session"]);
  expect(feature.session).toBe(session.id);
  const [other] = await byId(server.app, "Feature", [AGENT], ["id", "session"]);
  expect(other.session).toBeNull();

  // The same feature's next message goes to the same session.
  const again = await send(server, { folder: HUMAN, text: "And Q7?" });
  expect(again.id).toBe(session.id);
  await stop(server, session);
});

test("a session of another repository is not read", async () => {
  const server = await testServer();
  // The data folder is shared: another repository's server wrote this session, on the same folder.
  const { cache } = server.sessions;
  const row = cache.createSession({
    repo: "/elsewhere/repo",
    folder: AGENT,
    agent: "fake",
    nativeId: "3f2c",
    title: null,
  });
  const turn = cache.addTurn({
    sessionId: row.id,
    kind: "chat",
    trigger: null,
    step: null,
    allowed: null,
    state: "running",
  });
  cache.appendItem(turn, {
    kind: "denial",
    tool: "Bash",
    target: "ls",
    rule: "Bash(ls)",
    allowed: false,
  });

  expect(await byId(server.app, "Session", [row.id], ["id"])).toEqual([]);
  expect(await byId(server.app, "Turn", [String(turn)], ["id"])).toEqual([]);
  expect(await byId(server.app, "TurnLog", [`${turn}:0`], ["id"])).toEqual([]);
  expect((await list(server)).map((each) => each.id)).not.toContain(row.id);
  const [feature] = await byId(server.app, "Feature", [AGENT], ["id", "session"]);
  expect(feature.session).toBeNull();
  for (const [name, input] of [
    ["session.send", { session: row.id, text: "Hello" }],
    ["session.stop", { session: row.id }],
    ["session.allow", { session: row.id, turn: String(turn), seq: 0 }],
    ["session.seen", { session: row.id }],
  ] as const) {
    const refused = await mutate(server.app, name, input, ["id"]);
    expect(refused.error).toEqual({
      code: "BAD_REQUEST",
      message: `refused: no session ${row.id}`,
    });
  }
  expect(server.adapter.opens).toHaveLength(0);
});

test("US3.6: SessionList lists features' and chats' sessions with their status, needs you first", async () => {
  const server = await testServer();
  server.adapter.script([result({ ok: false, errors: ["The plan could not be written."] })]);
  const failed = await send(server, { folder: AGENT, text: "Plan it" });
  await settle(server, failed);
  server.adapter.script([]);
  const human = await send(server, { folder: HUMAN, text: "Why A?" });
  await settle(server, human);
  const chat = (await mutate(server.app, "session.newChat", {}, ["id"])).data as { id: string };
  server.adapter.script([{ type: "text", text: "Three drafts are open." }]);
  const replied = await send(server, { session: chat.id, text: "List the open draft files" });
  await settle(server, replied);

  const rows = await list(server);

  expect(rows.map((row) => [row.id, row.folder, row.title, row.status, row.statusLabel])).toEqual([
    [human.id, HUMAN, "Web UI for the workflow files", "needs-you", "Needs you"],
    [failed.id, AGENT, expect.any(String), "failed", "Failed"],
    [chat.id, null, "List the open draft files", "unread", "New reply"],
  ]);
  expect(rows[0]).toMatchObject({ archived: false, subagents: [], updatedAt: expect.any(String) });
});

test("US3.4: a running sub-agent shows in its session's row and record", async () => {
  const server = await testServer();
  const session = await send(server, { folder: AGENT, text: "Plan it" });
  server.adapter.emit({
    type: "toolStart",
    id: "task-1",
    name: "Task",
    kind: "other",
    input: {},
    subagent: { description: "Map the runner code" },
  });
  await flush();

  const [record] = await byId(server.app, "Session", [session.id], ["id", "subagents"]);
  expect(record.subagents).toEqual([{ id: "task-1", description: "Map the runner code" }]);
  expect((await list(server))[0].subagents).toEqual([
    { id: "task-1", description: "Map the runner code" },
  ]);

  server.adapter.emit({ type: "toolEnd", id: "task-1", isError: false, output: "Mapped." });
  await flush();
  const [after] = await byId(server.app, "Session", [session.id], ["id", "subagents"]);
  expect(after.subagents).toEqual([]);
  await stop(server, session);
});

test("US3.5: SessionSearch finds a chat by its message text", async () => {
  const server = await testServer();
  const chat = (await mutate(server.app, "session.newChat", {}, ["id"])).data as { id: string };
  server.adapter.script([{ type: "text", text: "The cache uses WAL mode." }]);
  const replied = await send(server, { session: chat.id, text: "How does the cache lock?" });
  await settle(server, replied);
  server.adapter.script([]);
  const other = await send(server, { folder: HUMAN, text: "Why A?" });
  await settle(server, other);

  const [found] = await byId(server.app, "SessionSearch", ["wal"], ["id", "rows"]);

  expect(found.id).toBe("wal");
  expect(found.rows.map((row: { id: string }) => row.id)).toEqual([chat.id]);
  expect(found.rows[0]).toMatchObject({ title: "How does the cache lock?", status: "unread" });
  // A feature is found by its title too.
  const [byTitle] = await byId(server.app, "SessionSearch", ["web ui"], ["id", "rows"]);
  expect(byTitle.rows.map((row: { id: string }) => row.id)).toEqual([other.id]);
});

test("US3.5: a query matching nothing gives no rows", async () => {
  const server = await testServer();
  server.adapter.script([]);
  await settle(server, await send(server, { folder: HUMAN, text: "Why A?" }));

  const [found] = await byId(server.app, "SessionSearch", ["zzz"], ["id", "rows"]);

  expect(found).toEqual({ id: "zzz", rows: [] });
});

test("US2.1: WorkflowMessage gives the message the composer is filled with", async () => {
  const server = await testServer();

  const [message] = await byId(
    server.app,
    "WorkflowMessage",
    [`${AGENT}:manual`],
    ["id", "text", "step", "refusal"],
  );

  expect(message).toEqual({
    id: `${AGENT}:manual`,
    text:
      `/uraeda:uraeda Continue the feature specs/${AGENT}/, on branch ${AGENT}.\n` +
      "The human asked you to continue.\n" +
      "Its next step is plan: follow skills/uraeda/references/plan.md.\n",
    step: "plan",
    refusal: null,
  });
});

test("US2.4: WorkflowMessage on a feature waiting on the human is empty, with the refusal", async () => {
  const server = await testServer();

  const [message] = await byId(
    server.app,
    "WorkflowMessage",
    [`${HUMAN}:answers:clarifications-01.md`],
    ["id", "text", "step", "refusal"],
  );

  expect(message).toEqual({
    id: `${HUMAN}:answers:clarifications-01.md`,
    text: "",
    step: expect.any(String),
    refusal: "The feature waits on you now: there is nothing to continue.",
  });
});

test("US2.2: session.send with the workflow's message starts a workflow turn", async () => {
  const server = await testServer();
  server.adapter.script([]);

  const session = await send(server, {
    folder: AGENT,
    text: "/uraeda:uraeda Continue.\nKeep the plan short.",
    workflow: { trigger: "manual" },
  });
  await settle(server, session);

  const [turn] = await byId(server.app, "Turn", session.turns, TURN_FIELDS);
  expect(turn).toMatchObject({ kind: "workflow", trigger: "manual", step: "plan", state: "done" });
  const refused = await mutate(
    server.app,
    "session.send",
    { folder: HUMAN, text: "Continue", workflow: { trigger: "manual" } },
    ["id"],
  );
  expect(refused.error).toEqual({
    code: "BAD_REQUEST",
    message: "refused: The feature waits on you now: there is nothing to continue.",
  });
});

test("US3.3: session.seen turns New reply into Idle", async () => {
  const server = await testServer();
  server.adapter.script([]);
  const session = await send(server, { folder: AGENT, text: "Plan it" });
  await settle(server, session);
  const [before] = await byId(server.app, "Session", [session.id], ["id", "status", "statusLabel"]);
  expect(before).toMatchObject({ status: "unread", statusLabel: "New reply" });

  const seen = await mutate(server.app, "session.seen", { session: session.id }, [
    "id",
    "status",
    "statusLabel",
  ]);

  expect(seen.data).toEqual({ id: session.id, status: "idle", statusLabel: "Idle" });
});

test("a session at a gate whose turn ended is unseen until session.seen, though it needs you", async () => {
  const server = await testServer();
  server.adapter.script([]);
  const session = await send(server, { folder: HUMAN, text: "Why A?" });
  await settle(server, session);
  const fields = ["id", "status", "unseen"];
  const [before] = await byId(server.app, "Session", [session.id], fields);
  expect(before).toEqual({ id: session.id, status: "needs-you", unseen: true });

  const seen = await mutate(server.app, "session.seen", { session: session.id }, fields);

  expect(seen.data).toEqual({ id: session.id, status: "needs-you", unseen: false });
});

test("US1.6: a write on a feature is refused while its turn runs", async () => {
  const server = await testServer();
  const session = await send(server, { folder: AGENT, text: "Plan it" });

  const refused = await mutate(
    server.app,
    "answer.save",
    { folder: AGENT, question: "Q1", letters: ["A"], comment: "", previous: "" },
    ["id"],
  );
  const committed = await mutate(
    server.app,
    "text.commit",
    { path: `specs/${AGENT}/proposal.md` },
    ["id"],
  );
  const [workspace] = await byId(server.app, "Workspace", ["workspace"], ["id", "running"]);

  expect(refused.error).toEqual(REFUSED);
  expect(committed.error).toEqual(REFUSED);
  expect(workspace.running).toEqual([AGENT]);
  await stop(server, session);
  const [after] = await byId(server.app, "Workspace", ["workspace"], ["id", "running"]);
  expect(after.running).toEqual([]);
});

test("drafts, priorities, and other features stay writable during a turn", async () => {
  const server = await testServer();
  const session = await send(server, { folder: AGENT, text: "Plan it" });
  const [priorities] = await byId(server.app, "Priorities", ["priorities"], ["id", "hash"]);

  const added = await mutate(
    server.app,
    "priorities.add",
    { section: "next", text: "Show the agent's last commit", hash: priorities.hash },
    ["id"],
  );
  const answered = await mutate(
    server.app,
    "answer.save",
    { folder: HUMAN, question: "Q1", letters: ["A"], comment: "", previous: "" },
    ["id"],
  );

  expect([added.ok, answered.ok]).toEqual([true, true]);
  await stop(server, session);
});

test("session.stop stops the turn, and keeps the session", async () => {
  const server = await testServer();
  const session = await send(server, { folder: AGENT, text: "Plan it" });

  const stopped = await mutate(server.app, "session.stop", { session: session.id }, ["id"]);
  await settle(server, session);

  expect(stopped.data).toEqual({ id: session.id });
  expect(server.adapter.interrupts).toBe(1);
  const [turn] = await byId(server.app, "Turn", session.turns, ["id", "state"]);
  expect(turn.state).toBe("stopped");
  const [record] = await byId(server.app, "Session", [session.id], ["id", "statusLabel"]);
  expect(record.statusLabel).toBe("New reply");
  const seen = await mutate(server.app, "session.seen", { session: session.id }, ["statusLabel"]);
  expect(seen.data.statusLabel).toBe("Stopped");
});

test("a turn waits for its background sub-agents to report back, and lists them meanwhile", async () => {
  const server = await testServer();
  const session = await send(server, { folder: AGENT, text: "Discover it" });
  const subagents = async () =>
    (await byId(server.app, "Session", [session.id], ["id", "subagents"]))[0]!.subagents;
  const state = async () =>
    (await byId(server.app, "Turn", session.turns, ["id", "state"]))[0]!.state;
  server.adapter.emit({
    type: "toolStart",
    id: "agent-1",
    name: "Agent",
    kind: "other",
    input: {},
    subagent: { description: "Research the tools" },
  });
  server.adapter.emit({ type: "background", tools: ["agent-1"] });
  server.adapter.emit({ type: "toolEnd", id: "agent-1", isError: false, output: "Launched." });
  server.adapter.emit({ type: "text", text: "I'll write the files once it reports back." });
  server.adapter.emit(result());
  await flush();

  expect(await state()).toBe("running");
  expect(await subagents()).toEqual([{ id: "agent-1", description: "Research the tools" }]);

  server.adapter.emit({ type: "background", tools: [] });
  await flush();
  expect(await subagents()).toEqual([]);
  expect(await state()).toBe("running");

  server.adapter.emit({ type: "text", text: "Written." });
  server.adapter.emit(result());
  await settle(server, session);
  expect(await state()).toBe("done");
});

test("TurnLog reads a turn's items in pages of 100, without taken-back messages", async () => {
  const server = await testServer();
  const texts: Array<AgentEvent> = Array.from({ length: 249 }, (_, n) => ({
    type: "text",
    text: `Line ${n}`,
  }));
  server.adapter.script([...texts, result()]);
  const session = await send(server, { folder: AGENT, text: "Plan it" });
  await settle(server, session);
  const id = session.turns[0];

  const [turn] = await byId(server.app, "Turn", [id], ["id", "pages"]);
  const pages = await byId(
    server.app,
    "TurnLog",
    [`${id}:0`, `${id}:1`, `${id}:2`],
    ["id", "turn", "page", "items"],
  );

  expect(turn.pages).toBe(3);
  expect(pages.map((page) => [page.id, page.turn, page.page, page.items.length])).toEqual([
    [`${id}:0`, id, 0, 100],
    [`${id}:1`, id, 1, 100],
    [`${id}:2`, id, 2, 50],
  ]);
  expect(pages[0].items[0]).toMatchObject({ seq: 0, kind: "message", text: "Plan it" });
  expect(pages[2].items.at(-1)).toEqual({
    seq: 249,
    kind: "text",
    text: "Line 248",
    streaming: false,
  });
});

test("US5.2: session.allow reopens the process with the rule, in a turn of its own", async () => {
  const server = await testServer();
  server.adapter.script([
    result({ denials: [{ tool: "Bash", input: { command: "git push origin HEAD" } }] }),
  ]);
  const session = await send(server, { folder: AGENT, text: "Push it" });
  await settle(server, session);
  const [blocked] = await byId(
    server.app,
    "Session",
    [session.id],
    ["id", "status", "statusReason"],
  );
  expect(blocked).toEqual({ id: session.id, status: "needs-you", statusReason: "blocked" });
  const [page] = await byId(server.app, "TurnLog", [`${session.turns[0]}:0`], ["id", "items"]);
  const denial = page.items.find((item: { kind: string }) => item.kind === "denial");
  server.adapter.script([]);

  const allowed = await mutate(
    server.app,
    "session.allow",
    { session: session.id, turn: session.turns[0], seq: denial.seq },
    ["id", "turns"],
  );
  await server.sessions.settled(Number(allowed.data.turns.at(-1)));

  expect(server.adapter.opens.at(-1)?.allowed).toBe("Bash(git push origin HEAD)");
  const [turn] = await byId(server.app, "Turn", [allowed.data.turns.at(-1)], TURN_FIELDS);
  expect(turn).toMatchObject({ kind: "allow", allowed: "Bash(git push origin HEAD)" });
});

test("US4.2 and US4.3: a chat is renamed, archived, and brought back by a message", async () => {
  const server = await testServer();
  const chat = (await mutate(server.app, "session.newChat", {}, SESSION_FIELDS)).data;
  expect(chat).toMatchObject({ folder: null, title: "New chat", turns: [], status: "idle" });
  expect(chat.place).toMatch(/^main checkout, branch /);

  const renamed = await mutate(
    server.app,
    "session.rename",
    { session: chat.id, title: "Drafts" },
    ["id", "title"],
  );
  const archived = await mutate(
    server.app,
    "session.archive",
    { session: chat.id, archived: true },
    ["id", "archived"],
  );
  expect(renamed.data.title).toBe("Drafts");
  expect(archived.data.archived).toBe(true);
  expect((await list(server)).find((row) => row.id === chat.id)?.archived).toBe(true);

  server.adapter.script([]);
  const sent = await send(server, { session: chat.id, text: "Any new draft?" });
  await settle(server, sent);
  expect(sent).toMatchObject({ title: "Drafts", archived: false });
});

test("Agent reads the agent's name, availability, version, and capabilities", async () => {
  const server = await testServer();

  const [agent] = await byId(
    server.app,
    "Agent",
    ["agent"],
    ["id", "kind", "name", "available", "version", "capabilities"],
  );

  expect(agent).toEqual({
    id: "agent",
    kind: "fake",
    name: "Claude Code",
    available: true,
    version: "0.0.0 (fake agent)",
    capabilities: { steer: true, queue: true, takeBack: true, approvals: false, subagents: true },
  });
});

test("US4.4: without the agent, Agent reads unavailable and a send is refused", async () => {
  const server = await testServer(undefined, { installed: false });

  const [agent] = await byId(server.app, "Agent", ["agent"], ["id", "available", "version"]);
  const refused = await mutate(server.app, "session.send", { folder: AGENT, text: "Plan it" }, [
    "id",
  ]);

  expect(agent).toEqual({ id: "agent", available: false, version: null });
  expect(refused.error?.message).toBe("refused: Claude Code is not available on this machine.");
});
