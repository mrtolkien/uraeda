// Notifications of `codex app-server` written by hand, in the shapes of Codex 0.163.0, for what
// no recording shows: `node-events.ts` writes them as the exchanges `written/items.jsonl` and
// `written/limits.jsonl`. They are the cases of the Node runtime's tests, in
// `packages/server/src/runner/__tests__/codex-events.test.ts` and `codex-limits.test.ts`.

type Json = Record<string, unknown>;

const THREAD = "01a1bba7-37d5-70b2-a846-298e7aa9fa2a";
const TURN = "01a1bba7-3854-7a40-b64d-4291bac94b14";
const CWD = "/session-dir";

const note = (method: string, params: Json): Json => ({ method, params });
const started = (item: Json, threadId = THREAD) =>
  note("item/started", { item, threadId, turnId: TURN });
const completed = (item: Json, threadId = THREAD) =>
  note("item/completed", { item, threadId, turnId: TURN });
const review = (status: string, riskLevel: string | null, rationale: string | null) =>
  note("item/autoApprovalReview/completed", {
    review: { rationale, riskLevel, status, userAuthorization: "high" },
    threadId: THREAD,
  });
const turnCompleted = (status: string, error: unknown = null, threadId = THREAD) =>
  note("turn/completed", { threadId, turn: { error, id: TURN, items: [], status } });

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
const CHANGES = [
  { diff: "+hi\n", kind: { type: "add" }, path: `${CWD}/a.txt` },
  { diff: "-old\n+new\n", kind: { type: "update" }, path: "/elsewhere/b.txt" },
];
const command = (id: string, line: string, more: Json = {}) => ({
  command: line,
  cwd: CWD,
  id,
  type: "commandExecution",
  ...more,
});

/** One turn with each kind of item, Codex's own sub-agents, and its reviews' other ends. */
export const ITEMS: Array<Json> = [
  note("turn/started", { threadId: THREAD, turn: { id: TURN, items: [], status: "inProgress" } }),
  // A thought, with its summary.
  started({ content: [], id: "rs-1", summary: [], type: "reasoning" }),
  completed({
    content: ["The raw thought."],
    id: "rs-1",
    summary: ["Reading the plan", "Then the tests"],
    type: "reasoning",
  }),
  // One with its content only, and one with neither.
  completed({ content: ["The raw thought."], id: "rs-2", summary: [], type: "reasoning" }),
  completed({ content: [], id: "rs-3", summary: [], type: "reasoning" }),
  // A commentary message is text, with no piece before it.
  completed({ id: "msg-1", phase: "commentary", text: "Looking at the tests.", type: "agentMessage" }),
  // A message that streamed, and says nothing whole: its pieces are its text.
  note("item/agentMessage/delta", { delta: "Do", itemId: "msg-2", threadId: THREAD, turnId: TURN }),
  note("item/agentMessage/delta", { delta: "", itemId: "msg-2", threadId: THREAD, turnId: TURN }),
  note("item/agentMessage/delta", { delta: "ne", itemId: "msg-2", threadId: THREAD, turnId: TURN }),
  completed({ id: "msg-2", text: "", type: "agentMessage" }),
  completed({ id: "msg-3", text: "", type: "agentMessage" }),
  // A file change targets its paths, relative in the session's directory.
  started({ changes: CHANGES, id: "patch-1", status: "inProgress", type: "fileChange" }),
  completed({ changes: CHANGES, id: "patch-1", status: "completed", type: "fileChange" }),
  completed({ changes: [], id: "patch-2", status: "failed", type: "fileChange" }),
  // Uraeda's tools, and any other MCP server's.
  started({
    arguments: { path: `${CWD}/src/main.rs`, prompt: "Review it" },
    id: "mcp-1",
    server: "uraeda",
    status: "inProgress",
    tool: "run_agent",
    type: "mcpToolCall",
  }),
  completed({
    arguments: { path: `${CWD}/src/main.rs`, prompt: "Review it" },
    error: null,
    id: "mcp-1",
    result: { content: [{ text: "Done.", type: "text" }, { type: "image" }, { text: "Twice.", type: "text" }] },
    server: "uraeda",
    status: "completed",
    tool: "run_agent",
    type: "mcpToolCall",
  }),
  // First seen as it ends: it starts there.
  completed({
    arguments: { url: "https://example.com/a" },
    error: { message: "No such tool" },
    id: "mcp-2",
    result: null,
    server: "docs",
    status: "failed",
    tool: "fetch",
    type: "mcpToolCall",
  }),
  completed({
    arguments: { pattern: "TODO" },
    contentItems: [{ text: "Nothing found.", type: "inputText" }],
    id: "dyn-1",
    status: "completed",
    success: false,
    tool: "grep",
    type: "dynamicToolCall",
  }),
  // A web search, by its query, its action's, or its address.
  started({ action: null, id: "ws-1", query: "codex app-server", type: "webSearch" }),
  completed({ action: null, id: "ws-1", query: "codex app-server", type: "webSearch" }),
  started({ action: { query: "rust serde", type: "search" }, id: "ws-2", query: "", type: "webSearch" }),
  started({ action: { type: "openPage", url: "https://example.com" }, id: "ws-3", query: "", type: "webSearch" }),
  started({ action: { type: "other" }, id: "ws-4", query: "", type: "webSearch" }),
  // Commands: a failed one, each shell's quotes, and one that is no shell's.
  completed(
    command("exec-1", "git status", {
      aggregatedOutput: "fatal: not a git repository",
      exitCode: 128,
      status: "failed",
    }),
  ),
  started(command("exec-2", String.raw`/usr/bin/zsh -lc "echo \"hi\" && echo \$HOME \\ \`date\`"`)),
  completed(command("exec-2", "", { aggregatedOutput: "hi\n", exitCode: 0, status: "completed" })),
  started(command("exec-3", String.raw`sh -lc 'echo '\''quoted'\'' text'`)),
  completed(command("exec-3", "", { aggregatedOutput: null, exitCode: 2, status: "completed" })),
  started(command("exec-4", "python3 script.py --flag")),
  started(command("exec-5", "bash -lc unquoted")),
  started(command("exec-6", "/bin/bash -lc 'two\nlines'")),
  // Twice the same start is one tool call, and an item that is no tool call is none.
  started(command("exec-6", "/bin/bash -lc 'two\nlines'")),
  started({ id: "plan-1", text: "The plan", type: "plan" }),
  completed({ id: "plan-1", text: "The plan", type: "plan" }),
  started(command("", "ls")),
  // Codex's own sub-agent: its call, then what its thread does under it.
  started(SPAWN),
  note("thread/started", { thread: { id: "child-1", parentThreadId: THREAD } }),
  completed({
    ...SPAWN,
    agentsStates: { "child-1": { message: "Started", status: "running" }, "child-2": { status: "running" } },
    receiverThreadIds: ["child-1"],
    status: "completed",
  }),
  started(command("exec-c1", "ls"), "child-1"),
  started({ content: [], id: "rs-c1", summary: [], type: "reasoning" }, "child-1"),
  completed({ content: [], id: "rs-c1", summary: ["Listing the files"], type: "reasoning" }, "child-1"),
  note("item/agentMessage/delta", { delta: "Found", itemId: "msg-c", threadId: "child-1", turnId: "t" }),
  completed({ id: "msg-c", text: "Found it.", type: "agentMessage" }, "child-1"),
  completed(command("exec-c1", "ls", { aggregatedOutput: "a.txt\n", exitCode: 0, status: "completed" }), "child-1"),
  note("thread/tokenUsage/updated", { threadId: "child-1", tokenUsage: { total: { inputTokens: 9, outputTokens: 9 } } }),
  turnCompleted("completed", null, "child-1"),
  // A call that waits for it, and a failed one.
  completed({ ...SPAWN, id: "call-wait", status: "completed", tool: "wait" }),
  completed({ ...SPAWN, id: "call-failed", status: "failed", tool: "closeAgent" }),
  // Another thread's is not the session's.
  completed({ id: "msg-s", text: "Not mine.", type: "agentMessage" }, "stranger"),
  turnCompleted("completed", null, "stranger"),
  // The reviews' ends: a decision carries its risk, an end without one does not.
  review("inProgress", null, null),
  review("denied", "high", "It pushes to a remote."),
  review("timedOut", null, "The reviewer did not answer in time."),
  review("aborted", null, null),
  review("approved", null, null),
  note("item/autoApprovalReview/completed", { review: null, threadId: THREAD }),
  // What it runs on: its settings, at the default effort the one Codex resolved, and a reroute.
  note("thread/settings/updated", { threadId: THREAD, threadSettings: { effort: "xhigh", model: "gpt-6-luna" } }),
  note("thread/settings/updated", { threadId: THREAD, threadSettings: { effort: null, model: "gpt-6-luna" } }),
  note("thread/settings/updated", { threadId: THREAD, threadSettings: { effort: "weird", model: "" } }),
  note("model/rerouted", { fromModel: "gpt-6-luna", threadId: THREAD, toModel: "gpt-unlisted" }),
  // Tokens: an all-zero total says nothing, and what the cache gave back is not read again.
  note("thread/tokenUsage/updated", { threadId: THREAD, tokenUsage: { total: { inputTokens: 0, outputTokens: 0 } } }),
  note("thread/tokenUsage/updated", {
    threadId: THREAD,
    tokenUsage: { total: { cachedInputTokens: 900, inputTokens: 1000, outputTokens: 20, reasoningOutputTokens: 5 } },
  }),
  note("thread/tokenUsage/updated", { threadId: THREAD, tokenUsage: { total: { cachedInputTokens: 50, inputTokens: 10 } } }),
  // Notifications Uraeda has no use for.
  note("thread/moderationMetadata", {}),
  note("thread/status/changed", { status: { type: "idle" }, threadId: THREAD }),
  { method: "configWarning" },
  turnCompleted("interrupted"),
];

/** A report of the account's usage: its windows, as `[used, minutes, reset]`. */
const limits = (
  windows: { primary?: Array<number | null> | null; secondary?: Array<number | null> | null },
  more: Json = {},
) => {
  const window = (given: Array<number | null> | null | undefined) =>
    given === null || given === undefined
      ? null
      : { resetsAt: given[2], usedPercent: given[0], windowDurationMins: given[1] };
  return note("account/rateLimits/updated", {
    rateLimits: {
      credits: null,
      limitId: "codex",
      limitName: null,
      planType: null,
      primary: window(windows.primary),
      rateLimitReachedType: null,
      secondary: window(windows.secondary),
      ...more,
    },
  });
};
const RESET = 1_794_155_269;
const LATER = 1_794_205_264;
const usageError = {
  additionalDetails: null,
  codexErrorInfo: "usageLimitExceeded",
  message: "You've hit your usage limit.",
};

/** The account's usage windows, the limits that refuse a turn, and a turn each refuses. */
export const LIMITS: Array<Json> = [
  // The five-hour and weekly windows, by Claude Code's names.
  limits({ primary: [7, 300, RESET], secondary: [64, 10_080, LATER] }),
  // A per-model bucket's report is that model's alone.
  limits({ primary: [90, 300, RESET] }, { limitId: "codex_luna" }),
  // A sparse report, unnamed, is merged over the last.
  limits({ primary: [8, 300, RESET] }, { limitId: null }),
  // Any other window, by its length, and a share to a tenth of a percent, at most the whole.
  limits({ primary: [12.34, 60, RESET], secondary: [250, 2880, LATER] }),
  limits({ primary: [0.05, 45, RESET + 0.5], secondary: [3, null, LATER] }),
  limits({ primary: [3, 0, RESET], secondary: [3, 90, LATER] }),
  // A window without its reset is left out, as one malformed.
  limits({ primary: [7, 300, null], secondary: [-1, 10_080, LATER] }),
  limits({ primary: [7, 300, 9e15], secondary: null }),
  note("account/rateLimits/updated", { rateLimits: "none" }),
  // A limit reached: the session's when the five-hour window is the full one that resets last.
  limits({ primary: [100, 300, LATER], secondary: [100, 10_080, RESET] }, { rateLimitReachedType: "rate_limit_reached" }),
  limits({ primary: [100, 300, RESET], secondary: [100, 10_080, LATER] }, { rateLimitReachedType: "rate_limit_reached" }),
  limits({ primary: [100, 300, RESET], secondary: [100, 10_080, RESET] }, { rateLimitReachedType: "rate_limit_reached" }),
  // No window reads full yet: the five-hour one, when it is the primary.
  limits({ primary: [97, 300, RESET], secondary: [40, 10_080, LATER] }, { rateLimitReachedType: "rate_limit_reached" }),
  limits({ primary: [97, 10_080, RESET], secondary: [40, 300, LATER] }, { rateLimitReachedType: "rate_limit_reached" }),
  // Credits run out: no window resets them.
  limits({ primary: [97, 300, RESET] }, { rateLimitReachedType: "workspace_owner_credits_depleted" }),
  // The limit is over.
  limits({ primary: [10, 300, RESET], secondary: [40, 10_080, LATER] }, { rateLimitReachedType: null }),
  // A turn the usage limit refused: its limit comes before its result.
  turnCompleted("failed", usageError),
];

