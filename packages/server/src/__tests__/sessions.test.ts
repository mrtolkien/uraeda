import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { chatImages } from "../attach.ts";
import type { AgentEvent } from "../runner/events.ts";
import { imagesInUse } from "../runner/image-uses.ts";
import { OUTPUT_LIMIT, SERVER_STOPPED } from "../runner/session-state.ts";
import { ChatImages } from "../runner/images.ts";
import {
  addChange,
  byId,
  byIdAt,
  commitOnBranch,
  type Data,
  fixture,
  git,
  mutate,
  testServer,
} from "./helpers.ts";

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
  "allowable",
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

test("a session's row carries its agent's kind", async () => {
  const server = await testServer();
  const chat = (await mutate(server.app, "session.newChat", {}, ["id"])).data as { id: string };

  const rows = await list(server);

  expect(rows.find((row) => row.id === chat.id)).toMatchObject({ agent: "fake" });
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
  const running = {
    calls: 0,
    description: "Map the runner code",
    id: "task-1",
    latest: null,
    parent: null,
    startedAt: expect.any(String),
  };
  expect(record.subagents).toEqual([running]);
  expect((await list(server))[0].subagents).toEqual([running]);

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
    text: "Sent as a message: the feature now waits on you.",
  });
});

test("session.send with a fresh workflow message answers with the new session it started", async () => {
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

  expect(session.id).not.toBe(chat.id);
  expect(session.folder).toBe(AGENT);
  expect(session.turns).toHaveLength(1);
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

test("US3.3: session.seen turns a chat's Needs attention into Idle", async () => {
  const server = await testServer();
  server.adapter.script([]);
  const session = await send(server, { folder: AGENT, text: "Plan it" });
  await settle(server, session);
  const [before] = await byId(server.app, "Session", [session.id], ["id", "status", "statusLabel"]);
  expect(before).toMatchObject({ status: "attention", statusLabel: "Needs attention" });

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

test("proposal files, priorities, and other features stay writable during a turn", async () => {
  const server = await testServer();
  const session = await send(server, { folder: AGENT, text: "Plan it" });
  const [priorities] = await byId(server.app, "Priorities", ["priorities"], ["id", "hash"]);

  const added = await mutate(
    server.app,
    "proposals.add",
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
  expect(await subagents()).toEqual([
    {
      calls: 0,
      description: "Research the tools",
      id: "agent-1",
      latest: null,
      parent: null,
      startedAt: expect.any(String),
    },
  ]);

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

/** The thoughts of the session's first turn, without their sequence numbers. */
async function thoughtsOf(server: Server, session: Record<string, Data>) {
  await flush();
  const [log] = await byId(server.app, "TurnLog", [`${session.turns[0]}:0`], ["id", "items"]);
  return (log!.items as Array<Record<string, unknown>>)
    .filter((item) => item.kind === "thought")
    .map(({ seq: _, ...item }) => item);
}

test("review focus 6: a thought lasts from its block's start to its whole block, each its own", async () => {
  const t0 = new Date("2026-10-25T10:00:00.000Z").getTime();
  vi.useFakeTimers({ now: t0, toFake: ["Date"] });
  try {
    const server = await testServer();
    const session = await send(server, { folder: AGENT, text: "Write the spec" });
    const at = async (ms: number, event: AgentEvent) => {
      vi.setSystemTime(t0 + ms);
      server.adapter.emit(event);
      await flush();
    };
    await at(0, { activity: { kind: "thinking" }, type: "activity" });
    await at(8000, { type: "thought" });
    await at(9000, { activity: { kind: "thinking" }, type: "activity" });
    await at(14_000, { type: "thought" });
    expect(await thoughtsOf(server, session)).toEqual([
      { durationMs: 8000, kind: "thought" },
      { durationMs: 5000, kind: "thought" },
    ]);
  } finally {
    vi.useRealTimers();
  }
});

test("a text or a call of the main agent ends its thinking block: a later thought is not timed from it", async () => {
  const t0 = new Date("2026-10-25T10:00:00.000Z").getTime();
  vi.useFakeTimers({ now: t0, toFake: ["Date"] });
  try {
    const server = await testServer();
    const session = await send(server, { folder: AGENT, text: "Write the spec" });
    const at = async (ms: number, event: AgentEvent) => {
      vi.setSystemTime(t0 + ms);
      server.adapter.emit(event);
      await flush();
    };
    // Two thinking blocks the harness gave no whole thought for, the first ended by a text, the
    // second by a tool call: the thoughts after them have no start to time them.
    await at(0, { activity: { kind: "thinking" }, type: "activity" });
    await at(1000, { text: "Reading the spec.", type: "textDelta" });
    await at(30_000, { type: "thought" });
    await at(31_000, { activity: { kind: "thinking" }, type: "activity" });
    await at(32_000, { id: "read-1", input: {}, kind: "read", name: "Read", type: "toolStart" });
    await at(90_000, { type: "thought" });
    expect(await thoughtsOf(server, session)).toEqual([
      { durationMs: 0, kind: "thought" },
      { durationMs: 0, kind: "thought" },
    ]);
  } finally {
    vi.useRealTimers();
  }
});

test("a sub-agent's thought has no start to time it: its length is 0", async () => {
  const t0 = new Date("2026-10-25T10:00:00.000Z").getTime();
  vi.useFakeTimers({ now: t0, toFake: ["Date"] });
  try {
    const server = await testServer();
    const session = await send(server, { folder: AGENT, text: "Map the code" });
    // The main agent's thinking start is not the sub-agent's.
    server.adapter.emit({ activity: { kind: "thinking" }, type: "activity" });
    await flush();
    vi.setSystemTime(t0 + 6000);
    server.adapter.emit({ parent: "agent-1", text: "Look in src/", type: "thought" });
    expect(await thoughtsOf(server, session)).toEqual([
      { durationMs: 0, kind: "thought", parent: "agent-1", text: "Look in src/" },
    ]);
  } finally {
    vi.useRealTimers();
  }
});

test("a thought's text is cut to the tool output's limit", async () => {
  const server = await testServer();
  const session = await send(server, { folder: AGENT, text: "Write the spec" });
  server.adapter.emit({ text: "x".repeat(OUTPUT_LIMIT + 10), type: "thought" });
  const [thought] = await thoughtsOf(server, session);
  expect(thought?.text).toBe("x".repeat(OUTPUT_LIMIT));
});

test("each call of the main agent restarts the activity's time", async () => {
  const t0 = new Date("2026-10-25T10:00:00.000Z").getTime();
  vi.useFakeTimers({ now: t0, toFake: ["Date"] });
  try {
    const server = await testServer();
    const session = await send(server, { folder: AGENT, text: "Read the rules" });
    const read = (id: string) =>
      server.adapter.emit({ id, input: {}, kind: "read", name: "Read", type: "toolStart" });
    read("read-1");
    await flush();
    vi.setSystemTime(t0 + 30_000);
    read("read-2");
    await flush();
    const [turn] = await byId(server.app, "Turn", session.turns, ["id", "activity"]);
    const activity = turn!.activity as { label: string; since: string };
    expect(activity).toEqual({ label: "Working", since: new Date(t0 + 30_000).toISOString() });
  } finally {
    vi.useRealTimers();
  }
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

  expect(server.adapter.opens.at(-1)?.allowed).toEqual(["Bash(git push origin HEAD)"]);
  const [turn] = await byId(server.app, "Turn", [allowed.data.turns.at(-1)], TURN_FIELDS);
  expect(turn).toMatchObject({ allowed: "Bash(git push origin HEAD)", kind: "allow" });
});

test("US3: the session's allowable count follows what Allow all would allow", async () => {
  const server = await testServer();
  server.adapter.script([
    result({
      denials: [
        { input: { command: "rm -rf dist" }, tool: "Bash" },
        { input: { file_path: "src/store/tasks.ts" }, tool: "Edit" },
        { input: { command: "rm -rf build/*" }, tool: "Bash" },
      ],
    }),
  ]);
  const session = await send(server, { folder: AGENT, text: "Clean up" });
  await settle(server, session);
  const allowable = async () =>
    (await byId(server.app, "Session", [session.id], ["id", "allowable"]))[0].allowable;
  const [page] = await byId(server.app, "TurnLog", [`${session.turns[0]}:0`], ["id", "items"]);
  const first = page.items.find((item: { kind: string }) => item.kind === "denial");

  // The command with a `*` has no rule: two of the three count.
  expect(await allowable()).toBe(2);
  // The retry turn is the latest: the agent is blocked on the edit again, and only that counts.
  server.adapter.script([
    result({ denials: [{ input: { file_path: "src/store/tasks.ts" }, tool: "Edit" }] }),
  ]);
  const allowed = await mutate(
    server.app,
    "session.allow",
    { seq: first.seq, session: session.id, turn: session.turns[0] },
    ["id", "turns"],
  );
  await server.sessions.settled(Number(allowed.data.turns.at(-1)));
  expect(await allowable()).toBe(1);
  server.adapter.script([]);
  await settle(server, await send(server, { folder: AGENT, text: "Thanks" }));
  expect(await allowable()).toBe(0);
});

test("US3: session.allowAll allows the covered actions in one turn, and refuses with none", async () => {
  const server = await testServer();
  server.adapter.script([
    result({
      denials: [
        { input: { command: "rm -rf dist" }, tool: "Bash" },
        { input: { file_path: "src/store/tasks.ts" }, tool: "Edit" },
      ],
    }),
  ]);
  const session = await send(server, { folder: AGENT, text: "Clean up" });
  await settle(server, session);
  server.adapter.script([]);

  const allowed = await mutate(server.app, "session.allowAll", { session: session.id }, [
    "id",
    "turns",
    "allowable",
  ]);
  await server.sessions.settled(Number(allowed.data.turns.at(-1)));

  expect(allowed.data.turns).toHaveLength(2);
  expect(server.adapter.opens.at(-1)?.allowed).toEqual([
    "Bash(rm -rf dist)",
    "Edit(src/store/tasks.ts)",
  ]);
  const again = await mutate(server.app, "session.allowAll", { session: session.id }, ["id"]);
  expect(again.error).toMatchObject({
    code: "BAD_REQUEST",
    message: "refused: No blocked action to allow.",
  });
});

test("US4.2 and US4.3: a chat is renamed, archived, and brought back by a message", async () => {
  const server = await testServer();
  const chat = (await mutate(server.app, "session.newChat", {}, SESSION_FIELDS)).data;
  expect(chat).toMatchObject({ folder: null, status: "idle", title: "New session", turns: [] });
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
  const [before] = await byId(server.app, "ProposalFile", [path], ["id", "hash"]);
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

/** A session of the folder, written to the cache as another server or a fresh step would. */
async function folderSession(server: Server, folder: string) {
  const repo = await server.sessions.mainRoot(server.repo);
  return server.sessions.cache.createSession({
    agent: "fake",
    folder,
    nativeId: "n",
    repo,
    title: null,
  });
}

/**
 * Adds a turn to a session that ends done, or as `state` with its `reason`, or still runs, with its
 * token counts when given.
 */
function doneTurn(
  server: Server,
  session: string,
  {
    denied = false,
    kind = "chat",
    reason,
    state = "done",
    tokens,
  }: {
    denied?: boolean;
    kind?: "chat" | "workflow";
    reason?: string;
    state?: "done" | "failed" | "running" | "stopped";
    tokens?: Parameters<Server["sessions"]["cache"]["addTurnTokens"]>[1];
  } = {},
) {
  const { cache } = server.sessions;
  const turn = cache.addTurn({
    allowed: null,
    kind,
    sessionId: session,
    state: "running",
    step: kind === "workflow" ? "plan" : null,
    trigger: kind === "workflow" ? "manual" : null,
  });
  if (denied) {
    cache.appendItem(turn, {
      allowed: false,
      kind: "denial",
      rule: "Bash(git push)",
      target: "git push",
      tool: "Bash",
    });
  }
  if (tokens) {
    cache.addTurnTokens(turn, tokens);
  }
  if (state !== "running") {
    cache.endTurn(turn, { state, ...(reason === undefined ? {} : { reason }) });
  }
  return turn;
}

const rowOf = async (server: Server, id: string) =>
  (await list(server)).find((row) => row.id === id);

test("US1.2: a session read to its end is done", async () => {
  const server = await testServer();
  const chat = (await mutate(server.app, "session.newChat", {}, ["id"])).data as { id: string };
  // A new session, read before its first message, is not done.
  await mutate(server.app, "session.seen", { session: chat.id }, ["id"]);
  expect(await rowOf(server, chat.id)).toMatchObject({ done: false });
  server.adapter.script([{ text: "It keeps merged branches.", type: "text" }]);
  await settle(server, await send(server, { session: chat.id, text: "What does ura clean keep?" }));
  const created = server.sessions.cache.session(chat.id)!.createdAt;
  expect(await rowOf(server, chat.id)).toMatchObject({ done: false, startedAt: created });

  await mutate(server.app, "session.seen", { session: chat.id }, ["id"]);

  expect(await rowOf(server, chat.id)).toMatchObject({ done: true, startedAt: created });
});

/** An archived session leaves Done, as it leaves the list. */
test("an archived session is not done", async () => {
  const server = await testServer();
  const chat = (await mutate(server.app, "session.newChat", {}, ["id"])).data as { id: string };
  server.adapter.script([{ text: "It keeps merged branches.", type: "text" }]);
  await settle(server, await send(server, { session: chat.id, text: "What does ura clean keep?" }));
  await mutate(server.app, "session.seen", { session: chat.id }, ["id"]);

  await mutate(server.app, "session.archive", { archived: true, session: chat.id }, ["id"]);

  expect(await rowOf(server, chat.id)).toMatchObject({ archived: true, done: false });
});

test("US1 more 1: a reply brings a done session back, at its start date", async () => {
  const server = await testServer();
  const chat = (await mutate(server.app, "session.newChat", {}, ["id"])).data as { id: string };
  server.adapter.script([{ text: "It keeps merged branches.", type: "text" }]);
  const first = await send(server, { session: chat.id, text: "What does ura clean keep?" });
  await settle(server, first);
  // Read at 10:00 on a past day, after its turn ended at 09:00: a reply ends later.
  const { cache } = server.sessions;
  cache.db
    .prepare("UPDATE turns SET ended_at = ? WHERE id = ?")
    .run("2000-01-01T09:00:00.000Z", Number(first.turns.at(-1)));
  cache.updateSession(chat.id, { seenAt: "2000-01-01T10:00:00.000Z" });
  const created = cache.session(chat.id)!.createdAt;
  expect(await rowOf(server, chat.id)).toMatchObject({ done: true });

  server.adapter.script([{ text: "And unmerged ones are kept too.", type: "text" }]);
  await settle(server, await send(server, { session: chat.id, text: "And unmerged ones?" }));

  expect(await rowOf(server, chat.id)).toMatchObject({ done: false, startedAt: created });
});

test("a feature's session is never done, however read", async () => {
  const server = await testServer();
  const session = await folderSession(server, AGENT);
  doneTurn(server, session.id);

  await mutate(server.app, "session.seen", { session: session.id }, ["id"]);

  expect(await rowOf(server, session.id)).toMatchObject({ done: false });
});

/** The feature's row in what needs the human, if any. */
async function needsYouRow(server: Server, folder: string) {
  const [needsYou] = await byIdAt(server.app, null, "NeedsYouList", ["all"], ["rows"]);
  return (needsYou!.rows as Array<Record<string, string>>).find((row) => row.folder === folder);
}

/** An older session's run that ended before a gate does not halt the feature its latest works on. */
test("an older session's halted run does not hold its feature", async () => {
  const server = await testServer();
  const older = await folderSession(server, AGENT);
  doneTurn(server, older.id, { kind: "workflow" });
  await mutate(server.app, "session.seen", { session: older.id }, ["id"]);
  const latest = await folderSession(server, AGENT);
  doneTurn(server, latest.id, { state: "running" });

  expect(await needsYouRow(server, AGENT)).toBeUndefined();
  expect(await rowOf(server, older.id)).toMatchObject({ status: "idle" });
  expect(await rowOf(server, latest.id)).toMatchObject({ status: "working" });
});

/** The feature's status, as its `Feature` record and its workspace's feature carry it. */
async function statusesOf(server: Server, folder: string) {
  const [feature] = await byId(server.app, "Feature", [folder], ["id", "status"]);
  const [workspace] = await byId(server.app, "Workspace", ["workspace"], ["features"]);
  const listed = (workspace!.features as Array<{ folder: string; status: Data }>).find(
    (each) => each.folder === folder,
  );
  expect(listed?.status).toEqual(feature!.status);
  return feature!.status as Record<string, Data>;
}

/** US1.1, and its edge case of two sessions running after a crash. */
test("a running session makes its feature Working everywhere, then it follows its latest", async () => {
  const server = await testServer();
  const older = await folderSession(server, AGENT);
  const running = doneTurn(server, older.id, { state: "running" });
  const latest = await folderSession(server, AGENT);
  const stopped = doneTurn(server, latest.id, { reason: SERVER_STOPPED, state: "stopped" });

  // The latest session was stopped by the server; the older one still runs: Working, from it.
  expect(await statusesOf(server, AGENT)).toEqual({
    label: "Working",
    reason: null,
    session: older.id,
    status: "working",
    turn: String(running),
  });
  expect(await needsYouRow(server, AGENT)).toBeUndefined();

  // Its run ends: the feature follows its latest session, which asks until dismissed.
  server.sessions.cache.endTurn(running, { state: "done" });

  expect(await statusesOf(server, AGENT)).toMatchObject({
    reason: "interrupted",
    session: latest.id,
    status: "attention",
    turn: String(stopped),
  });
  expect(await needsYouRow(server, AGENT)).toMatchObject({ reason: "attention" });
});

/** US1 more 1: the replaced rules raised the feature to an older session's blocked or failed run. */
test("an older session's blocked or failed run does not hold its feature", async () => {
  const server = await testServer();
  doneTurn(server, (await folderSession(server, AGENT)).id, { denied: true });
  doneTurn(server, (await folderSession(server, AGENT)).id, { state: "failed" });
  const latest = await folderSession(server, AGENT);
  doneTurn(server, latest.id);
  await mutate(server.app, "session.seen", { session: latest.id }, ["id"]);

  expect(await statusesOf(server, AGENT)).toMatchObject({ session: latest.id, status: "idle" });
  expect(await needsYouRow(server, AGENT)).toBeUndefined();
  expect(await rowOf(server, latest.id)).toMatchObject({ status: "idle" });
});

/** US1.2 and US1.3: a run on a feature at a gate reads Working, then notifies the gate again (R5). */
test("a run at a gate reads Working, and its end notifies the gate under a new key", async () => {
  const server = await testServer();
  const session = await folderSession(server, HUMAN);
  const first = doneTurn(server, session.id);
  await mutate(server.app, "session.seen", { session: session.id }, ["id"]);
  expect(await statusesOf(server, HUMAN)).toMatchObject({
    status: "needs-you",
    turn: String(first),
  });
  const before = await needsYouRow(server, HUMAN);
  expect(before?.key).toMatch(new RegExp(`:${first}$`));

  const run = doneTurn(server, session.id, { state: "running" });

  expect(await statusesOf(server, HUMAN)).toMatchObject({ status: "working", turn: String(run) });
  expect(await needsYouRow(server, HUMAN)).toBeUndefined();

  server.sessions.cache.endTurn(run, { state: "done" });

  expect(await statusesOf(server, HUMAN)).toMatchObject({ status: "needs-you", turn: String(run) });
  const after = await needsYouRow(server, HUMAN);
  expect(after).toMatchObject({ reason: before!.reason });
  expect(after!.key).toMatch(new RegExp(`:${run}$`));
});

test("a feature at a gate without a session needs the human, following no session", async () => {
  const server = await testServer();

  expect(await statusesOf(server, HUMAN)).toEqual({
    label: "Needs you",
    reason: "step",
    session: null,
    status: "needs-you",
    turn: null,
  });
  expect(await needsYouRow(server, HUMAN)).toMatchObject({
    message: "Questions to answer",
    reason: "step",
  });
});

/**
 * A feature with problems reads "Needs you" with no reason, with or without a session (R12). Its
 * step is `none`, which the notifier skips, as it did before.
 */
test("a feature with problems needs the human, and the notifier skips it", async () => {
  const server = await testServer();
  commitOnBranch(server.repo, AGENT, {
    [`specs/${AGENT}/clarifications-09.md`]: "No frontmatter.\n",
  });

  expect(await statusesOf(server, AGENT)).toEqual({
    label: "Needs you",
    reason: null,
    session: null,
    status: "needs-you",
    turn: null,
  });
  expect(await needsYouRow(server, AGENT)).toBeUndefined();

  const session = await folderSession(server, AGENT);
  const turn = doneTurn(server, session.id);

  expect(await statusesOf(server, AGENT)).toEqual({
    label: "Needs you",
    reason: null,
    session: session.id,
    status: "needs-you",
    turn: String(turn),
  });
  expect(await needsYouRow(server, AGENT)).toBeUndefined();
});

test("a feature lists its sessions, latest first", async () => {
  const server = await testServer();
  const older = await folderSession(server, AGENT);
  const latest = await folderSession(server, AGENT);

  const [feature] = await byId(server.app, "Feature", [AGENT], ["id", "session", "sessions"]);

  expect(feature).toEqual({ id: AGENT, session: latest.id, sessions: [latest.id, older.id] });
});

/** An archived session leaves the lists (the spec's Assumptions): the feature's among them. */
test("a feature lists no archived session", async () => {
  const server = await testServer();
  const older = await folderSession(server, AGENT);
  const archived = await folderSession(server, AGENT);
  server.sessions.cache.updateSession(archived.id, { archivedAt: new Date().toISOString() });

  const [feature] = await byId(server.app, "Feature", [AGENT], ["id", "sessions"]);

  expect(feature).toEqual({ id: AGENT, sessions: [older.id] });
});

test("a feature's tokens count every session", async () => {
  const server = await testServer();
  const counts = { cacheRead: 100, cacheWrite: 20, input: 3, output: 40 };
  const older = await folderSession(server, AGENT);
  doneTurn(server, older.id, { tokens: counts });
  const latest = await folderSession(server, AGENT);
  doneTurn(server, latest.id, { tokens: counts });

  const [feature] = await byId(server.app, "Feature", [AGENT], ["id", "tokens"]);

  expect(feature.tokens).toMatchObject({ input: 46, output: 80, partial: false });
});

test("US3.5: a search for a feature finds every session of it", async () => {
  const server = await testServer();
  const older = await folderSession(server, HUMAN);
  const latest = await folderSession(server, HUMAN);

  const [found] = await byId(server.app, "SessionSearch", ["web ui"], ["id", "rows"]);

  expect(found.rows.map((row: { id: string }) => row.id).sort()).toEqual(
    [older.id, latest.id].sort(),
  );
});
