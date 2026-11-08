import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { CodexEvents, type CodexNotification } from "../codex-events.ts";
import type { AgentEvent } from "../events.ts";

const CWD = "/work/project";
const THREAD = "01a1bba7-37d5-70b2-a846-298e7aa9fa2a";
const TURN = "01a1bba7-3854-7a40-b64d-4291bac94b14";
const NAMES: Record<string, string> = { "gpt-6-luna": "GPT-6-Luna" };
const names = (model: string) => NAMES[model] ?? model;

/** The notifications of a recorded file, one JSON message a line. */
function fixture(file: string): Array<CodexNotification> {
  return readFileSync(join(import.meta.dirname, "fixtures", file), "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as CodexNotification);
}

/** Every event of notifications read in order by one process's reader. */
function readAll(messages: Array<CodexNotification>, events = new CodexEvents(CWD, names)) {
  return messages.flatMap((message) => events.read(message));
}

const started = (item: Record<string, unknown>, threadId = THREAD): CodexNotification => ({
  method: "item/started",
  params: { item, threadId, turnId: TURN },
});
const completed = (item: Record<string, unknown>, threadId = THREAD): CodexNotification => ({
  method: "item/completed",
  params: { item, threadId, turnId: TURN },
});
const turnCompleted = (status: string, error: unknown = null): CodexNotification => ({
  method: "turn/completed",
  params: { threadId: THREAD, turn: { error, id: TURN, items: [], status } },
});
const turnFailed = (message: string, codexErrorInfo: unknown = "badRequest") =>
  turnCompleted("failed", { additionalDetails: null, codexErrorInfo, message });
const turnInterrupted = () => turnCompleted("interrupted");
const SPAWN = {
  agentsStates: {},
  id: "call-spawn",
  model: "gpt-6-luna",
  prompt: "Read the tests",
  reasoningEffort: "low",
  receiverThreadIds: [],
  senderThreadId: THREAD,
  status: "inProgress",
  tool: "spawnAgent",
  type: "collabAgentToolCall",
};
const collabStarted = () => started(SPAWN);
const review = (
  status: string,
  riskLevel: string | null,
  rationale: string | null,
): CodexNotification => ({
  method: "item/autoApprovalReview/completed",
  params: { review: { rationale, riskLevel, status, userAuthorization: "high" }, threadId: THREAD },
});

test("an escalated command and its review", () => {
  const events = readAll(fixture("codex-turn.jsonl"));
  expect(events).toContainEqual(
    expect.objectContaining({
      kind: "execute",
      target: "git add a.txt && git commit -m 'add a'",
      type: "toolStart",
    }),
  );
  expect(events).toContainEqual({
    text: expect.stringMatching(/^Automatic review approved \(risk: medium\): The user explicitly/),
    type: "notice",
  });
  expect(events.filter((event) => event.type === "notice")).toHaveLength(1);
  expect(events).toContainEqual({ effort: "Low", model: "GPT-6-Luna", type: "runsOn" });
  expect(events).toContainEqual({ sessionId: THREAD, type: "init" });
  expect(events).toContainEqual({ text: "DONE", type: "text" });
  expect(events).toContainEqual({
    total: { cacheRead: 67_072, cacheWrite: 0, input: 8705, output: 224 },
    type: "tokens",
  });
  expect(events.at(-1)).toEqual({
    denials: [],
    errors: [],
    interrupted: false,
    ok: true,
    type: "result",
  });
  expect(events).not.toContainEqual({ type: "skipped" });
});

test("the current turn's ID is kept for the caller", () => {
  const events = new CodexEvents(CWD, names);
  expect(events.turnId).toBeUndefined();
  readAll(fixture("codex-turn.jsonl").slice(0, 4), events);
  expect(events.turnId).toBe(TURN);
});

test.each<[string, Array<CodexNotification>, unknown]>([
  [
    "a failed turn gives Codex's error",
    [
      turnFailed(
        "The 'gpt-bogus-9' model is not supported when using Codex with a ChatGPT account.",
      ),
    ],
    {
      errors: ["The 'gpt-bogus-9' model is not supported when using Codex with a ChatGPT account."],
      ok: false,
      type: "result",
    },
  ],
  ["an interrupted turn is a stop", [turnInterrupted()], { interrupted: true, type: "result" }],
  [
    "a sub-agent call is a tool call",
    [collabStarted()],
    { kind: "other", subagent: { description: "Read the tests" }, type: "toolStart" },
  ],
  [
    "a sub-agent's command belongs to its call",
    [
      completed({ ...SPAWN, receiverThreadIds: ["child"], status: "completed" }),
      started({ command: "ls", cwd: CWD, id: "exec-1", type: "commandExecution" }, "child"),
    ],
    { id: "exec-1", parent: "call-spawn", type: "toolStart" },
  ],
  [
    "a commentary message is text",
    [
      completed({
        id: "msg-1",
        phase: "commentary",
        text: "Looking at the tests.",
        type: "agentMessage",
      }),
    ],
    { text: "Looking at the tests.", type: "text" },
  ],
  [
    "a message streams by its deltas",
    [
      {
        method: "item/agentMessage/delta",
        params: { delta: "Do", itemId: "msg-1", threadId: THREAD, turnId: TURN },
      },
    ],
    { text: "Do", type: "textDelta" },
  ],
  [
    "a reasoning item is a thought",
    [completed({ content: [], id: "rs-1", summary: ["Reading the plan"], type: "reasoning" })],
    { text: "Reading the plan", type: "thought" },
  ],
  [
    "a reasoning item starts thinking",
    [started({ content: [], id: "rs-1", summary: [], type: "reasoning" })],
    { activity: { kind: "thinking" }, type: "activity" },
  ],
  [
    "a file change targets its path in the session's directory",
    [
      started({
        changes: [{ diff: "+hi\n", kind: { type: "add" }, path: `${CWD}/a.txt` }],
        id: "patch-1",
        status: "inProgress",
        type: "fileChange",
      }),
    ],
    { kind: "edit", target: "a.txt", type: "toolStart" },
  ],
  [
    "a failed command ends in error",
    [
      completed({
        aggregatedOutput: "fatal: not a git repository",
        command: "git status",
        exitCode: 128,
        id: "exec-1",
        status: "failed",
        type: "commandExecution",
      }),
    ],
    { id: "exec-1", isError: true, output: "fatal: not a git repository", type: "toolEnd" },
  ],
  [
    "a web search fetches",
    [started({ action: null, id: "ws-1", query: "codex app-server", type: "webSearch" })],
    { kind: "fetch", target: "codex app-server", type: "toolStart" },
  ],
  [
    "a denied review",
    [review("denied", "high", "It pushes to a remote.")],
    { text: "Automatic review denied (risk: high): It pushes to a remote.", type: "notice" },
  ],
  [
    "a review that timed out",
    [review("timedOut", null, "The reviewer did not answer in time.")],
    { text: "Automatic review timed out: The reviewer did not answer in time.", type: "notice" },
  ],
  [
    "an aborted review",
    [review("aborted", null, null)],
    { text: "Automatic review aborted", type: "notice" },
  ],
  [
    "a turn refused by the usage limit",
    [turnFailed("You've hit your usage limit.", "usageLimitExceeded")],
    { limit: { kind: "other", text: "You've hit your usage limit." }, type: "limit" },
  ],
])("%s", (_name, messages, expected) => {
  expect(readAll(messages)).toContainEqual(expect.objectContaining(expected as object));
});

test("a usage limit comes before the result", () => {
  const events = readAll([turnFailed("You've hit your usage limit.", "usageLimitExceeded")]);
  expect(events.map((event) => event.type)).toEqual(["limit", "result"]);
});

test.each<[string, Array<CodexNotification>]>([
  ["an unknown notification", [{ method: "thread/moderationMetadata", params: {} }]],
  ["a review in progress", [review("inProgress", null, null)]],
  [
    "a sub-agent's thread starting",
    [
      {
        method: "thread/started",
        params: { thread: { id: "child", parentThreadId: THREAD } },
      },
    ],
  ],
  [
    "another thread's turn ending",
    [
      { method: "thread/started", params: { thread: { id: THREAD, parentThreadId: null } } },
      {
        method: "turn/completed",
        params: {
          threadId: "child",
          turn: { error: null, id: "t", items: [], status: "completed" },
        },
      },
    ],
  ],
])("%s gives no event of its own", (_name, messages) => {
  const events: Array<AgentEvent> = readAll(messages);
  expect(events.filter((event) => event.type !== "init")).toEqual([]);
  expect(events).not.toContainEqual({ sessionId: "child", type: "init" });
});
