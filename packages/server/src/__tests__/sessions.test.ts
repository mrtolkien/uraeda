import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { chatImages } from "../attach.ts";
import type { AgentEvent } from "../runner/events.ts";
import { imagesInUse } from "../runner/image-uses.ts";
import { ChatImages } from "../runner/images.ts";
import { addChange, byId, type Data, fixture, git, mutate, testServer } from "./helpers.ts";

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
  "backgroundCommands",
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
  denials: [],
  errors: [],
  interrupted: false,
  ok: true,
  type: "result",
  ...extra,
});

/** Lets the session manager read the events emitted so far. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

type Server = Awaited<ReturnType<typeof testServer>>;

/** Sends a message through `session.send`, and returns the session it went to. */
async function send(server: Server, input: Record<string, unknown>) {
  const sent = await mutate(server.app, "session.send", input, SESSION_FIELDS);
  expect(sent.error).toBeUndefined();
  return sent.data as Record<string, Data>;
}

/** Waits for the session's latest turn to end. */
async function settle(server: Server, session: Record<string, Data>) {
  await server.sessions.settled(Number(session.turns.at(-1)));
}

/** Stops the session's turn, and waits for it. */
async function stop(server: Server, session: Record<string, Data>) {
  await server.sessions.mainRoot(server.repo);
  server.sessions.stop(server.repo, session.id);
  await settle(server, session);
}

const list = async (server: Server) =>
  ((await byId(server.app, "SessionList", ["all"], ["id", "rows"]))[0]?.rows ?? []) as Array<
    Record<string, Data>
  >;

test("session.send on a feature creates its session and returns it with its first turn", async () => {
  const server = await testServer();

  const session = await send(server, { folder: HUMAN, text: "Why did you recommend A in Q6?" });

  expect(session).toMatchObject({
    agent: "fake",
    archived: false,
    folder: HUMAN,
    place: `branch ${HUMAN}`,
    status: "working",
    statusLabel: "Working",
    statusReason: null,
    subagents: [],
    title: "Web UI for the workflow files",
    unseen: false,
  });
  expect(session.turns).toHaveLength(1);
  const [turn] = await byId(server.app, "Turn", session.turns, TURN_FIELDS);
  expect(turn).toMatchObject({
    id: session.turns[0],
    kind: "chat",
    pages: 1,
    session: session.id,
    state: "running",
    trigger: null,
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
    agent: "fake",
    folder: AGENT,
    nativeId: "3f2c",
    repo: "/elsewhere/repo",
    title: null,
  });
  const turn = cache.addTurn({
    allowed: null,
    kind: "chat",
    sessionId: row.id,
    state: "running",
    step: null,
    trigger: null,
  });
  cache.appendItem(turn, {
    allowed: false,
    kind: "denial",
    rule: "Bash(ls)",
    target: "ls",
    tool: "Bash",
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
    ["session.allow", { seq: 0, session: row.id, turn: String(turn) }],
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
  server.adapter.script([result({ errors: ["The plan could not be written."], ok: false })]);
  const failed = await send(server, { folder: AGENT, text: "Plan it" });
  await settle(server, failed);
  server.adapter.script([]);
  const human = await send(server, { folder: HUMAN, text: "Why A?" });
  await settle(server, human);
  const chat = (await mutate(server.app, "session.newChat", {}, ["id"])).data as { id: string };
  server.adapter.script([{ text: "Three drafts are open.", type: "text" }]);
  const replied = await send(server, { session: chat.id, text: "List the open draft files" });
  await settle(server, replied);

  const rows = await list(server);

  expect(rows.map((row) => [row.id, row.folder, row.title, row.status, row.statusLabel])).toEqual([
    [human.id, HUMAN, "Web UI for the workflow files", "needs-you", "Needs you"],
    [failed.id, AGENT, expect.any(String), "attention", "Needs attention"],
    [chat.id, null, "List the open draft files", "unread", "New reply"],
  ]);
  expect(rows[0]).toMatchObject({ archived: false, subagents: [], updatedAt: expect.any(String) });
});

test("US3.4: a running sub-agent shows in its session's row and record", async () => {
  const server = await testServer();
  const session = await send(server, { folder: AGENT, text: "Plan it" });
  server.adapter.emit({
    id: "task-1",
    input: {},
    kind: "other",
    name: "Task",
    subagent: { description: "Map the runner code" },
    type: "toolStart",
  });
  await flush();

  const [record] = await byId(server.app, "Session", [session.id], ["id", "subagents"]);
  expect(record.subagents).toEqual([{ description: "Map the runner code", id: "task-1" }]);
  expect((await list(server))[0].subagents).toEqual([
    { description: "Map the runner code", id: "task-1" },
  ]);

  server.adapter.emit({ id: "task-1", isError: false, output: "Mapped.", type: "toolEnd" });
  await flush();
  const [after] = await byId(server.app, "Session", [session.id], ["id", "subagents"]);
  expect(after.subagents).toEqual([]);
  await stop(server, session);
});

test("US3.5: SessionSearch finds a chat by its message text", async () => {
  const server = await testServer();
  const chat = (await mutate(server.app, "session.newChat", {}, ["id"])).data as { id: string };
  server.adapter.script([{ text: "The cache uses WAL mode.", type: "text" }]);
  const replied = await send(server, { session: chat.id, text: "How does the cache lock?" });
  await settle(server, replied);
  server.adapter.script([]);
  const other = await send(server, { folder: HUMAN, text: "Why A?" });
  await settle(server, other);

  const [found] = await byId(server.app, "SessionSearch", ["wal"], ["id", "rows"]);

  expect(found.id).toBe("wal");
  expect(found.rows.map((row: { id: string }) => row.id)).toEqual([chat.id]);
  expect(found.rows[0]).toMatchObject({ status: "unread", title: "How does the cache lock?" });
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
    refusal: null,
    step: "plan",
    text:
      `/uraeda Continue the feature specs/${AGENT}/ on branch ${AGENT}: ` +
      "Write the plan, starting with skills/uraeda/references/plan.md.\n" +
      "Stop when the plan waits for my review, and earlier only if you need a decision from me.\n",
  });
});

test("WorkflowMessage for the comments gives the comments message", async () => {
  const server = await testServer();

  const [message] = await byId(
    server.app,
    "WorkflowMessage",
    [`${AGENT}:comments`],
    ["id", "text", "step", "refusal"],
  );

  expect(message).toEqual({
    id: `${AGENT}:comments`,
    refusal: null,
    step: "plan",
    text:
      `/uraeda Continue the feature specs/${AGENT}/ on branch ${AGENT}: ` +
      "Address the comments on its pull request, starting with " +
      "skills/uraeda/references/implementation.md.\n" +
      "Stop when the pull request is ready for review again, and earlier only if you need a " +
      "decision from me.\n",
  });
});

const RECOMMENDED_FIELDS = ["id", "name", "reason", "step", "text", "trigger"];

/** US4.1, US4.2 */
test("RecommendedMessage gives the feature's one message, or why there is none", async () => {
  const server = await testServer();

  const [plan, human] = await byId(
    server.app,
    "RecommendedMessage",
    [AGENT, HUMAN],
    RECOMMENDED_FIELDS,
  );

  expect(plan).toEqual({
    id: AGENT,
    name: "Continue, write the plan",
    reason: null,
    step: "plan",
    text:
      `/uraeda Continue the feature specs/${AGENT}/ on branch ${AGENT}: ` +
      "Write the plan, starting with skills/uraeda/references/plan.md.\n" +
      "Stop when the plan waits for my review, and earlier only if you need a decision from me.\n",
    trigger: "manual",
  });
  expect(human).toEqual({
    id: HUMAN,
    name: null,
    reason: "No recommended message: the feature waits on you",
    step: null,
    text: "",
    trigger: null,
  });
  expect(await byId(server.app, "RecommendedMessage", ["no-such-folder"], ["id"])).toEqual([]);
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
    refusal: "The feature waits on you now: there is nothing to continue.",
    step: expect.any(String),
    text: "",
  });
});

test("US2.2: session.send with the workflow's message starts a workflow turn", async () => {
  const server = await testServer();
  server.adapter.script([]);

  const session = await send(server, {
    folder: AGENT,
    text: "/uraeda Continue.\nKeep the plan short.",
    workflow: { trigger: "manual" },
  });
  await settle(server, session);

  const [turn] = await byId(server.app, "Turn", session.turns, TURN_FIELDS);
  expect(turn).toMatchObject({ kind: "workflow", state: "done", step: "plan", trigger: "manual" });
});

/** US4 more 1 */
test("session.send with a step's message the feature moved on from sends it as a chat", async () => {
  const server = await testServer();
  server.adapter.script([]);

  const session = await send(server, {
    folder: HUMAN,
    text: "/uraeda Continue.",
    workflow: { step: "plan", trigger: "manual" },
  });
  await settle(server, session);

  const [turn] = await byId(server.app, "Turn", session.turns, TURN_FIELDS);
  expect(turn).toMatchObject({ kind: "chat", state: "done", step: null, trigger: null });
  const [log] = await byId(server.app, "TurnLog", [`${session.turns[0]}:0`], ["id", "items"]);
  expect(log?.items).toContainEqual({
    kind: "system",
    seq: 1,
    text: "Sent as a chat: the feature now waits on you.",
  });
});

test("session.send with a fresh workflow message starts a new agent session in the same session", async () => {
  const server = await testServer();
  server.adapter.script([]);
  const chat = await send(server, { folder: AGENT, text: "Hello" });
  await settle(server, chat);
  server.adapter.script([]);

  const session = await send(server, {
    folder: AGENT,
    text: "/uraeda Continue.",
    workflow: { fresh: true, trigger: "manual" },
  });
  await settle(server, session);

  expect(session.id).toBe(chat.id);
  expect(server.adapter.opens).toHaveLength(2);
  expect(server.adapter.opens[1]?.resume).toBe(false);
  expect(server.adapter.opens[1]?.nativeId).not.toBe(server.adapter.opens[0]?.nativeId);
});

/** The agents decision: a run after a spec's approval sent without `fresh` follows the setting. */
test("session.send of the plan's message without fresh follows the build_in_fresh_session setting", async () => {
  for (const on of [true, false]) {
    const server = await testServer();
    writeFileSync(
      join(server.configDir, "config.toml"),
      `[runs]\nbuild_in_fresh_session = ${on}\n`,
    );
    await server.settings.reload();
    server.adapter.script([]);
    await settle(server, await send(server, { folder: AGENT, text: "Hello" }));
    server.adapter.script([]);

    const session = await send(server, {
      folder: AGENT,
      text: "/uraeda Continue.",
      workflow: { trigger: "manual" },
    });
    await settle(server, session);

    expect(server.adapter.opens.map((open) => open.resume)).toEqual(on ? [false, false] : [false]);
  }
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
    { comment: "", folder: AGENT, letters: ["A"], previous: "", question: "Q1" },
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
    { hash: priorities.hash, section: "next", text: "Show the agent's last commit" },
    ["id"],
  );
  const answered = await mutate(
    server.app,
    "answer.save",
    { comment: "", folder: HUMAN, letters: ["A"], previous: "", question: "Q1" },
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
  const [record] = await byId(server.app, "Session", [session.id], ["statusLabel", "statusReason"]);
  expect(record).toMatchObject({ statusLabel: "Needs attention", statusReason: "stopped" });
  const seen = await mutate(server.app, "session.seen", { session: session.id }, ["statusLabel"]);
  expect(seen.data.statusLabel).toBe("Needs attention");
});

test("a turn waits for its background sub-agents to report back, and lists them meanwhile", async () => {
  const server = await testServer();
  const session = await send(server, { folder: AGENT, text: "Discover it" });
  const subagents = async () =>
    (await byId(server.app, "Session", [session.id], ["id", "subagents"]))[0]!.subagents;
  const state = async () =>
    (await byId(server.app, "Turn", session.turns, ["id", "state"]))[0]!.state;
  server.adapter.emit({
    id: "agent-1",
    input: {},
    kind: "other",
    name: "Agent",
    subagent: { description: "Research the tools" },
    type: "toolStart",
  });
  server.adapter.emit({ tasks: [{ kind: "subagent", tool: "agent-1" }], type: "background" });
  server.adapter.emit({ id: "agent-1", isError: false, output: "Launched.", type: "toolEnd" });
  server.adapter.emit({ text: "I'll write the files once it reports back.", type: "text" });
  server.adapter.emit(result());
  await flush();

  expect(await state()).toBe("running");
  expect(await subagents()).toEqual([{ description: "Research the tools", id: "agent-1" }]);

  server.adapter.emit({ tasks: [], type: "background" });
  await flush();
  expect(await subagents()).toEqual([]);
  expect(await state()).toBe("running");

  server.adapter.emit({ text: "Written.", type: "text" });
  server.adapter.emit(result());
  await settle(server, session);
  expect(await state()).toBe("done");
});

/** US1.9, SC-003 */
test("a run with a live background command reads Working, and counts it", async () => {
  const server = await testServer();
  const session = await send(server, { folder: AGENT, text: "Review it" });
  const read = async () =>
    (await byId(server.app, "Session", [session.id], ["statusLabel", "backgroundCommands"]))[0]!;
  server.adapter.emit({ tasks: [{ kind: "command", tool: "bash-1" }], type: "background" });
  server.adapter.emit({ text: "The review runs.", type: "text" });
  server.adapter.emit(result());
  await flush();

  expect(await read()).toMatchObject({ backgroundCommands: 1, statusLabel: "Working" });

  server.adapter.emit({ tasks: [], type: "background" });
  server.adapter.emit(result());
  await settle(server, session);
  expect((await read()).backgroundCommands).toBe(0);
});

test("a running turn says what its agent does, and since when, until it ends", async () => {
  const server = await testServer();
  const session = await send(server, { folder: AGENT, text: "Write the spec" });
  const activity = async () => {
    await flush();
    const [turn] = await byId(server.app, "Turn", session.turns, ["id", "activity"]);
    return turn!.activity as { label: string; since: string } | null;
  };
  expect((await activity())?.label).toBe("Working");

  server.adapter.emit({ activity: { kind: "thinking" }, type: "activity" });
  const thinking = await activity();
  expect(thinking?.label).toBe("Thinking");
  // The same activity again keeps its start.
  server.adapter.emit({ activity: { kind: "thinking" }, type: "activity" });
  expect((await activity())?.since).toBe(thinking?.since);

  server.adapter.emit({ activity: { kind: "tool", name: "Write" }, type: "activity" });
  expect((await activity())?.label).toBe("Writing a file");
  server.adapter.emit({
    activity: { kind: "tool", name: "Write", target: "spec.md" },
    type: "activity",
  });
  expect((await activity())?.label).toBe("Writing spec.md");
  server.adapter.emit({
    id: "agent-1",
    input: {},
    kind: "other",
    name: "Agent",
    subagent: { description: "Map the code" },
    type: "toolStart",
  });
  expect((await activity())?.label).toBe("Working");

  // A sub-agent's tools show as their own rows: the main agent's activity stays.
  server.adapter.emit({ activity: { kind: "thinking" }, type: "activity" });
  server.adapter.emit({
    id: "grep-1",
    input: {},
    kind: "search",
    name: "Grep",
    parent: "agent-1",
    type: "toolStart",
  });
  server.adapter.emit({ id: "grep-1", isError: false, output: "", type: "toolEnd" });
  expect((await activity())?.label).toBe("Thinking");

  // A reply that ended while background sub-agents run waits for them, by count.
  server.adapter.emit({ tasks: [{ kind: "subagent", tool: "agent-1" }], type: "background" });
  server.adapter.emit({ id: "agent-1", isError: false, output: "Launched.", type: "toolEnd" });
  server.adapter.emit({ text: "Waiting on the map.", type: "text" });
  server.adapter.emit(result());
  expect((await activity())?.label).toBe("Waiting for 1 sub-agent");
  server.adapter.emit({ tasks: [], type: "background" });
  expect((await activity())?.label).toBe("Working");

  server.adapter.emit({ text: "Written.", type: "text" });
  server.adapter.emit(result());
  await settle(server, session);
  expect(await activity()).toBeNull();
});

test("TurnLog reads a turn's items in pages of 100, without taken-back messages", async () => {
  const server = await testServer();
  const texts: Array<AgentEvent> = Array.from({ length: 249 }, (_, n) => ({
    text: `Line ${n}`,
    type: "text",
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
  expect(pages[0].items[0]).toMatchObject({ kind: "message", seq: 0, text: "Plan it" });
  expect(pages[2].items.at(-1)).toEqual({
    kind: "text",
    seq: 249,
    streaming: false,
    text: "Line 248",
  });
});

test("US5.2: session.allow reopens the process with the rule, in a turn of its own", async () => {
  const server = await testServer();
  server.adapter.script([
    result({ denials: [{ input: { command: "git push origin HEAD" }, tool: "Bash" }] }),
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
    { seq: denial.seq, session: session.id, turn: session.turns[0] },
    ["id", "turns"],
  );
  await server.sessions.settled(Number(allowed.data.turns.at(-1)));

  expect(server.adapter.opens.at(-1)?.allowed).toBe("Bash(git push origin HEAD)");
  const [turn] = await byId(server.app, "Turn", [allowed.data.turns.at(-1)], TURN_FIELDS);
  expect(turn).toMatchObject({ allowed: "Bash(git push origin HEAD)", kind: "allow" });
});

test("US4.2 and US4.3: a chat is renamed, archived, and brought back by a message", async () => {
  const server = await testServer();
  const chat = (await mutate(server.app, "session.newChat", {}, SESSION_FIELDS)).data;
  expect(chat).toMatchObject({ folder: null, status: "idle", title: "New chat", turns: [] });
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
    { archived: true, session: chat.id },
    ["id", "archived"],
  );
  expect(renamed.data.title).toBe("Drafts");
  expect(archived.data.archived).toBe(true);
  expect((await list(server)).find((row) => row.id === chat.id)?.archived).toBe(true);

  server.adapter.script([]);
  const sent = await send(server, { session: chat.id, text: "Any new draft?" });
  await settle(server, sent);
  expect(sent).toMatchObject({ archived: false, title: "Drafts" });
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
    available: true,
    capabilities: {
      approvals: false,
      images: true,
      queue: true,
      steer: true,
      subagents: true,
      takeBack: true,
    },
    id: "agent",
    kind: "fake",
    name: "Claude Code",
    version: "0.0.0 (fake agent)",
  });
});

test("US4.4: without the agent, Agent reads unavailable and a send is refused", async () => {
  const server = await testServer(undefined, { installed: false });

  const [agent] = await byId(server.app, "Agent", ["agent"], ["id", "available", "version"]);
  const refused = await mutate(server.app, "session.send", { folder: AGENT, text: "Plan it" }, [
    "id",
  ]);

  expect(agent).toEqual({ available: false, id: "agent", version: null });
  expect(refused.error?.message).toBe("refused: Claude Code is not available on this machine.");
});

/** A chat image saved in the server's data folder, as `POST /attach` saves it. */
const saved = (server: Server) =>
  chatImages(server.dataDir).save({
    bytes: Buffer.from("RIFF....WEBP"),
    extension: "webp",
    height: 900,
    width: 1440,
  });

test("US2.2: session.send passes the images' paths in the data folder, and the item holds them", async () => {
  const server = await testServer();
  const [a, b] = [await saved(server), await saved(server)];
  const chat = await mutate(server.app, "session.newChat", {}, ["id"]);
  server.adapter.script([]);

  const session = await send(server, {
    images: [a, b],
    session: chat.data.id,
    text: "What is wrong here?",
  });
  await settle(server, session);

  expect(server.adapter.sent[0]).toMatchObject({
    images: [
      { path: join(server.dataDir, "images", a!.id) },
      { path: join(server.dataDir, "images", b!.id) },
    ],
    text: "What is wrong here?",
  });
  const [log] = await byId(server.app, "TurnLog", [`${session.turns[0]}:0`], ["id", "items"]);
  expect(log.items[0]).toMatchObject({ images: [a, b], kind: "message" });
  expect(imagesInUse(server.sessions.cache.db)).toEqual(new Set([a!.id, b!.id]));
});

test('US2.4: session.send takes an image alone, and titles the chat "Image"', async () => {
  const server = await testServer();
  const image = await saved(server);
  const chat = await mutate(server.app, "session.newChat", {}, ["id"]);
  server.adapter.script([]);

  const session = await send(server, { images: [image], session: chat.data.id, text: "" });
  await settle(server, session);

  expect(session.title).toBe("Image");
});

test("session.send refuses an image that is not in the data folder", async () => {
  const server = await testServer();
  const chat = await mutate(server.app, "session.newChat", {}, ["id"]);

  for (const id of ["0b9f9c4e-6a4f-4f3e-9d1e-2a7c1f0e5b3a.webp", "../runner.sqlite"]) {
    const refused = await mutate(
      server.app,
      "session.send",
      { images: [{ height: 1, id, width: 1 }], session: chat.data.id, text: "Look" },
      ["id"],
    );
    expect(refused.error?.message).toBe("refused: This image is gone: add it again.");
  }
  expect(server.adapter.sent).toEqual([]);
});

/** The refusal of a `session.send`, with its input's other fields. */
const refusalOf = async (server: Server, input: Record<string, unknown>) =>
  (await mutate(server.app, "session.send", input, ["id"])).error?.message;

test("session.send refuses images that are not { id, width, height } objects", async () => {
  const server = await testServer();
  const chat = await mutate(server.app, "session.newChat", {}, ["id"]);
  const image = await saved(server);

  for (const malformed of [null, 3, "id.webp", [image]]) {
    expect(
      await refusalOf(server, { images: [image, malformed], session: chat.data.id, text: "Look" }),
    ).toBe("refused: an image is an object of its id, width, and height");
  }
  expect(await refusalOf(server, { images: image, session: chat.data.id, text: "Look" })).toBe(
    "refused: images is a list",
  );
  expect(server.adapter.sent).toEqual([]);
});

test("session.send refuses a size that is not two positive integers, or over the core's", async () => {
  const server = await testServer();
  const chat = await mutate(server.app, "session.newChat", {}, ["id"]);
  const { id } = await saved(server);
  const gif = await chatImages(server.dataDir).save({
    bytes: Buffer.from("GIF89a"),
    extension: "gif",
    height: 1,
    width: 1,
  });

  for (const [width, height] of [
    [0, 900],
    [1440, -1],
    [1.5, 900],
    ["1440", 900],
    [2577, 900],
    [1440, 2577],
  ]) {
    expect(
      await refusalOf(server, {
        images: [{ height, id, width }],
        session: chat.data.id,
        text: "Look",
      }),
    ).toBe("refused: an image's size is two positive integers, within the core's limits");
  }
  // An animated GIF is kept as it came: over 2576 pixels, within 40 million.
  expect(
    await refusalOf(server, {
      images: [{ height: 5001, id: gif.id, width: 8000 }],
      session: chat.data.id,
      text: "Look",
    }),
  ).toBe("refused: an image's size is two positive integers, within the core's limits");
  server.adapter.script([]);
  const session = await send(server, {
    images: [
      { height: 2576, id, width: 2576 },
      { height: 5000, id: gif.id, width: 8000 },
    ],
    session: chat.data.id,
    text: "Look",
  });
  await settle(server, session);
  expect(server.adapter.sent).toHaveLength(1);
});

test("session.send sends an image given twice in one message once", async () => {
  const server = await testServer();
  const [a, b] = [await saved(server), await saved(server)];
  const chat = await mutate(server.app, "session.newChat", {}, ["id"]);
  server.adapter.script([]);

  const session = await send(server, { images: [a, b, a], session: chat.data.id, text: "Look" });
  await settle(server, session);

  expect(server.adapter.sent[0]?.images).toEqual([
    { path: join(server.dataDir, "images", a!.id) },
    { path: join(server.dataDir, "images", b!.id) },
  ]);
  const [log] = await byId(server.app, "TurnLog", [`${session.turns[0]}:0`], ["id", "items"]);
  expect(log.items[0].images).toEqual([a, b]);
});

test("session.send refuses images with the workflow's message", async () => {
  const server = await testServer();
  const image = await saved(server);

  expect(
    await refusalOf(server, {
      folder: AGENT,
      images: [image],
      text: "/uraeda Continue.",
      workflow: { trigger: "manual" },
    }),
  ).toBe("refused: The workflow's message takes no images.");
  const [feature] = await byId(server.app, "Feature", [AGENT], ["id", "session"]);
  expect(feature.session).toBeNull();
});

test("session.send refuses too many images, or images the agent cannot read, before creating the feature's session", async () => {
  const server = await testServer();
  const images = await Promise.all(Array.from({ length: 11 }, () => saved(server)));

  expect(await refusalOf(server, { folder: AGENT, images, text: "Look" })).toBe(
    "refused: A message takes at most 10 images.",
  );
  server.adapter.capabilities = { ...server.adapter.capabilities, images: false };
  expect(await refusalOf(server, { folder: AGENT, images: [images[0]], text: "Look" })).toBe(
    "refused: This agent cannot read images.",
  );

  const [feature] = await byId(server.app, "Feature", [AGENT], ["id", "session"]);
  expect(feature.session).toBeNull();
  expect(server.adapter.opens).toEqual([]);
});

/** The change US1.1 types: its title, a blank line, and its text. */
const TYPED = "Centre the x in failure circles\n\nIn failures the x sits low in its circle.";
const STARTED_FIELDS = ["id", "folder", "kind", "session"];

test("US1.1: change.start starts a change and sends its first run, its images in its folder", async () => {
  const server = await testServer();
  const bytes = readFileSync(fixture("images/lossy.webp"));
  const image = await chatImages(server.dataDir).save({
    bytes,
    extension: "webp",
    height: 874,
    width: 402,
  });
  server.adapter.script([]);

  const started = await mutate(
    server.app,
    "change.start",
    { images: [image], text: TYPED },
    STARTED_FIELDS,
  );

  expect(started.error).toBeUndefined();
  const { folder } = started.data as Record<string, Data>;
  expect(folder).toMatch(/^\d{4}-\d{2}-\d{2}-centre-x$/);
  expect(started.data).toMatchObject({ id: folder, kind: "change" });
  const branch = `change/${folder}`;
  expect(git(server.repo, "ls-tree", "-r", "--name-only", branch, `specs/changes/${folder}/`)).toBe(
    `specs/changes/${folder}/images/image-1.webp\nspecs/changes/${folder}/proposal.md\n`,
  );
  const [session] = await byId(server.app, "Session", [started.data.session], SESSION_FIELDS);
  expect(session).toMatchObject({ folder, place: `branch ${branch}` });
  await settle(server, session);
  expect(server.adapter.sent).toEqual([
    expect.objectContaining({
      images: [],
      text:
        `/uraeda Continue the change specs/changes/${folder}/ on branch ${branch}: ` +
        "Investigate it, then make the change, starting with skills/uraeda/references/change.md.\n" +
        "Stop when the pull request is ready for review, and earlier only if you need a decision from me.\n",
    }),
  ]);
  const [turn] = await byId(server.app, "Turn", session.turns, TURN_FIELDS);
  expect(turn).toMatchObject({ kind: "workflow", step: "change", trigger: "start" });
});

test("change.start without the agent starts the change and sends nothing", async () => {
  const server = await testServer(undefined, { installed: false });

  const started = await mutate(
    server.app,
    "change.start",
    { slug: "centred-x", text: TYPED },
    STARTED_FIELDS,
  );

  expect(started.error).toBeUndefined();
  expect(started.data).toMatchObject({
    folder: expect.stringMatching(/-centred-x$/),
    session: null,
  });
  expect(git(server.repo, "branch", "--list", "change/*")).toMatch(/-centred-x\n$/);
  expect(server.adapter.sent).toEqual([]);
});

test("change.start answers with the started change when its first run cannot be sent", async () => {
  const server = await testServer();
  server.adapter.open = () => {
    throw new Error("the agent could not start");
  };
  const logged = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

  const started = await mutate(
    server.app,
    "change.start",
    { slug: "centred-x", text: TYPED },
    STARTED_FIELDS,
  );

  expect(started.error).toBeUndefined();
  expect(started.data).toMatchObject({
    folder: expect.stringMatching(/-centred-x$/),
    session: null,
  });
  expect(git(server.repo, "branch", "--list", "change/*")).toMatch(/-centred-x\n$/);
  expect(logged).toHaveBeenCalledWith(
    `uraeda: ${started.data.folder} started, but its first run was not sent: the agent could not start\n`,
  );
  logged.mockRestore();
});

/** The fixture's WebP, saved as a chat image. */
const savedWebp = (server: Server) =>
  chatImages(server.dataDir).save({
    bytes: readFileSync(fixture("images/lossy.webp")),
    extension: "webp",
    height: 874,
    width: 402,
  });

test("change.start takes images the agent cannot read, as they go into the repository", async () => {
  const server = await testServer(undefined, { installed: false });
  server.adapter.capabilities = { ...server.adapter.capabilities, images: false };
  const eleven = await Promise.all(Array.from({ length: 11 }, () => savedWebp(server)));
  const [image] = eleven;
  const input = { slug: "centred-x", text: TYPED };

  const tooMany = await mutate(server.app, "change.start", { ...input, images: eleven }, ["id"]);
  const started = await mutate(server.app, "change.start", { ...input, images: [image] }, ["id"]);

  expect(tooMany.error?.message).toBe("refused: A message takes at most 10 images.");
  expect(started.error).toBeUndefined();
  const folder = started.data.id as string;
  expect(
    git(
      server.repo,
      "ls-tree",
      "-r",
      "--name-only",
      `change/${folder}`,
      `specs/changes/${folder}/`,
    ),
  ).toContain("images/image-1.webp");
});

test("change.start refuses an image whose file is gone as it is read", async () => {
  const server = await testServer(undefined, { installed: false });
  const image = await savedWebp(server);
  const gone = join(server.dataDir, "images", "gone.webp");
  const path = vi.spyOn(ChatImages.prototype, "path").mockReturnValue(gone);

  const started = await mutate(
    server.app,
    "change.start",
    { images: [image], slug: "centred-x", text: TYPED },
    ["id"],
  );

  path.mockRestore();
  expect(started.error).toEqual({
    code: "BAD_REQUEST",
    message: "refused: This image is gone: add it again.",
  });
});

test("change.start refuses a taken slug with the core's message", async () => {
  const server = await testServer(undefined, { installed: false });
  const first = await mutate(server.app, "change.start", { slug: "centred-x", text: TYPED }, [
    "id",
  ]);

  const again = await mutate(server.app, "change.start", { slug: "centred-x", text: TYPED }, [
    "id",
  ]);

  expect(again.error).toEqual({
    code: "BAD_REQUEST",
    message: `refused: ${first.data.id} exists: choose another slug with --slug`,
  });
});

test("SlugProposal proposes the core's slug for a typed text, from its title", async () => {
  const server = await testServer();
  const typed = "\n## Crash\n\nWhen saving, the app closes.";

  const [proposal] = await byId(server.app, "SlugProposal", [typed], ["id", "slug"]);

  expect(proposal).toEqual({ id: typed, slug: "crash" });
});

test("a change's files are writable until its agent runs", async () => {
  const server = await testServer();
  const folder = "2026-10-16-centred-x";
  const path = `specs/changes/${folder}/proposal.md`;
  addChange(server.repo, folder, { "proposal.md": "# Centre the x\n" });
  const [before] = await byId(server.app, "Draft", [path], ["id", "hash"]);
  const saved = await mutate(
    server.app,
    "text.save",
    { hash: before.hash, path, text: "# Centre the x\n\nIt sits low.\n" },
    ["id"],
  );
  expect(saved.error).toBeUndefined();
  const session = await send(server, { folder, text: "Look at it" });

  const refused = await mutate(server.app, "text.commit", { path }, ["id"]);

  expect(refused.error).toEqual(REFUSED);
  await stop(server, session);
});
