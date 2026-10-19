import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { fixture, temporaryFolder } from "uraeda-binding/test-utils";
import { allowRule, type Blocks, lines, parseLine } from "../claude-events.ts";
import { layout } from "../../paths.ts";
import { ClaudeAdapter, claudeArgs } from "../claude.ts";
import type { AgentEvent, Denial } from "../events.ts";
import { chatOpening } from "../message.ts";

const SESSION = "06e0f968-6806-4810-b91e-df3ca38e0f25";
const open = { cwd: "/w", nativeId: "id" };

/** The lines of a recorded fixture, in `fixtures/claude/`. */
function recorded(file: string): Array<string> {
  return readFileSync(fixture(`claude/${file}`), "utf8")
    .split("\n")
    .filter(Boolean);
}

async function collect<T>(items: AsyncIterable<T>): Promise<Array<T>> {
  const all: Array<T> = [];
  for await (const item of items) {
    all.push(item);
  }
  return all;
}

/** An images folder in a temporary folder, not created yet: opening a process creates it. */
function images(): string {
  return join(temporaryFolder("uraeda-data"), "images");
}

async function* chunks(...parts: Array<Buffer>) {
  for (const part of parts) {
    yield part;
  }
}

test("SC-006: a new session's arguments", () => {
  expect(claudeArgs({ ...open, resume: false }, "/plugin", "/data/images")).toEqual([
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--permission-mode",
    "auto",
    "--plugin-dir",
    "/plugin",
    "--add-dir",
    "/data/images",
    "--session-id",
    "id",
  ]);
});

test("a resumed session with an allow rule", () => {
  expect(
    claudeArgs(
      { ...open, allowed: ["Bash(gh pr create --draft)"], resume: true },
      "/plugin",
      "/data/images",
    ).slice(13),
  ).toEqual(["--resume", "id", "--allowedTools", "Bash(gh pr create --draft)"]);
});

test("several allow rules are each their own argument, last", () => {
  expect(
    claudeArgs(
      { ...open, allowed: ["Bash(rm -rf dist)", "Edit(src/a.ts)"], resume: true },
      "/plugin",
      "/data/images",
    ).slice(13),
  ).toEqual(["--resume", "id", "--allowedTools", "Bash(rm -rf dist)", "Edit(src/a.ts)"]);
});

test("no argument skips permissions or sets a model", () => {
  for (const args of [
    claudeArgs({ ...open, resume: false }, "/plugin", "/data/images"),
    claudeArgs(
      { ...open, allowed: ["Bash(gh pr create --draft)"], resume: true },
      "/plugin",
      "/data/images",
    ),
  ]) {
    for (const forbidden of [
      "bypassPermissions",
      "--dangerously-skip-permissions",
      "--model",
      "--effort",
    ]) {
      expect(args).not.toContain(forbidden);
    }
  }
});

test("Claude Code declares what it can do", () => {
  const adapter = new ClaudeAdapter({ imagesDir: "/data/images", pluginDir: "/plugin" });
  expect([adapter.kind, adapter.name]).toEqual(["claude", "Claude Code"]);
  expect(adapter.capabilities).toEqual({
    approvals: false,
    images: true,
    queue: true,
    steer: true,
    subagents: true,
    takeBack: true,
  });
});

test.each<[string, Array<AgentEvent>]>([
  [
    "init.jsonl",
    [
      {
        pluginErrors: [],
        plugins: ["uraeda", "cc-plugin-telemetry"],
        sessionId: SESSION,
        type: "init",
      },
    ],
  ],
  [
    "init-plugin-error.jsonl",
    [
      {
        pluginErrors: ["Path not found: /tmp/no-such-plugin (commands)"],
        plugins: ["cc-plugin-telemetry"],
        sessionId: "cb94b45c-b09a-43bb-88f4-a60071539d67",
        type: "init",
      },
    ],
  ],
  // A thinking block shows nothing, then the text.
  ["text.jsonl", [{ text: "ready", type: "text" }]],
  [
    "tool.jsonl",
    [
      {
        id: "toolu_01SVEKzLxnSQyRcc45azZnG9",
        input: { command: "echo ok", description: "Print ok" },
        kind: "execute",
        name: "Bash",
        target: "echo ok",
        type: "toolStart",
      },
      { id: "toolu_01SVEKzLxnSQyRcc45azZnG9", isError: false, output: "ok", type: "toolEnd" },
    ],
  ],
  ["retry.jsonl", [{ attempt: 1, delayMs: 30_000, error: "rate_limit", type: "retry" }]],
  [
    "result-success.jsonl",
    [
      {
        costUsd: 0.188748,
        denials: [],
        errors: [],
        interrupted: false,
        ok: true,
        type: "result",
      },
    ],
  ],
  // The running total of every model, sub-agents included, before the result.
  [
    "result-usage.jsonl",
    [
      { total: { cacheRead: 11_304, cacheWrite: 7791, input: 2, output: 4 }, type: "tokens" },
      {
        costUsd: 0.0646768,
        denials: [],
        errors: [],
        interrupted: false,
        models: ["claude-opus-5-5", "claude-haiku-4-5"],
        ok: true,
        type: "result",
      },
    ],
  ],
  [
    "result-denied.jsonl",
    [
      {
        costUsd: 0.1160696,
        denials: [
          {
            input: { command: "gh pr create --draft", description: "Create a draft pull request" },
            tool: "Bash",
          },
        ],
        errors: [],
        interrupted: false,
        ok: true,
        type: "result",
      },
    ],
  ],
  [
    "result-error.jsonl",
    [
      {
        costUsd: 0.0907116,
        denials: [],
        errors: ["Reached maximum number of turns (1)"],
        interrupted: false,
        ok: false,
        type: "result",
      },
    ],
  ],
  // Hooks, thinking tokens, the denial notice and a push give no transcript items.
  [
    "ignored.jsonl",
    [
      {
        fiveHour: { percentUsed: 43, resetsAt: new Date(1_791_798_000 * 1000).toISOString() },
        type: "usage",
      },
    ],
  ],
  ["unknown.jsonl", [{ type: "skipped" }]],
])("the lines of %s", (file, events) => {
  expect(recorded(file).flatMap((line) => parseLine(line))).toEqual(events);
});

test.each<[string, unknown]>([
  ["an empty modelUsage", {}],
  ["a modelUsage without counts", { "claude-x": { costUSD: 0.1, inputTokens: "2" } }],
])("%s sends no tokens, which would reset the baseline", (_, modelUsage) => {
  const line = JSON.stringify({
    is_error: false,
    modelUsage,
    permission_denials: [],
    subtype: "success",
    type: "result",
  });
  expect(parseLine(line)).toEqual([
    {
      denials: [],
      errors: [],
      interrupted: false,
      // The models are named even when their counts are unreadable.
      ...(Object.keys(modelUsage as object).length > 0
        ? { models: Object.keys(modelUsage as object) }
        : {}),
      ok: true,
      type: "result",
    },
  ]);
});

test("a tool result made of text blocks is joined", () => {
  const line = JSON.stringify({
    message: {
      content: [
        {
          content: [
            { text: "Exit code 1", type: "text" },
            { text: "no git remotes found", type: "text" },
          ],
          is_error: true,
          tool_use_id: "toolu_1",
          type: "tool_result",
        },
      ],
      role: "user",
    },
    type: "user",
  });
  expect(parseLine(line)).toEqual([
    { id: "toolu_1", isError: true, output: "Exit code 1\nno git remotes found", type: "toolEnd" },
  ]);
});

test("a success result marked as an error is not ok, and gives its text", () => {
  const line = JSON.stringify({
    is_error: true,
    permission_denials: [],
    result: "API Error: 500",
    subtype: "success",
    type: "result",
  });
  expect(parseLine(line)).toEqual([
    {
      denials: [],
      errors: ["API Error: 500"],
      interrupted: false,
      ok: false,
      type: "result",
    },
  ]);
});

/** The `result` event of a result line with these fields. */
function resultOf(fields: Record<string, unknown>) {
  const line = JSON.stringify({
    permission_denials: [],
    subtype: "success",
    type: "result",
    ...fields,
  });
  return parseLine(line).at(-1);
}

test("a result line's cost and models reach the result event", () => {
  const usage = { inputTokens: 1, outputTokens: 2 };

  const event = resultOf({ modelUsage: { "claude-sonnet-5-5": usage }, total_cost_usd: 0.42 });

  expect(event).toMatchObject({
    costUsd: 0.42,
    models: ["claude-sonnet-5-5"],
    type: "result",
  });
});

test("a result with no cost or models keeps both fields absent", () => {
  const event = resultOf({});

  expect(event).not.toHaveProperty("costUsd");
  expect(event).not.toHaveProperty("models");
});

test("a line that is not JSON is skipped", () =>
  expect(parseLine("Warning: x")).toEqual([{ type: "skipped" }]));

test("review focus 1: a line split across chunks, in the middle of a character, is one line", async () => {
  const line = Buffer.from(
    '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Café"}]}}\n',
  );
  // "é" is two bytes: the cut falls between them.
  const cut = line.indexOf(Buffer.from("é")) + 1;
  const result = await collect(lines(chunks(line.subarray(0, cut), line.subarray(cut))));
  expect(result).toHaveLength(1);
  expect(parseLine(result[0]!)).toEqual([{ text: "Café", type: "text" }]);
});

test("lines() keeps a last line without a newline, and drops empty lines", async () => {
  expect(await collect(lines(chunks(Buffer.from("a\n\nb\r\nc"))))).toEqual(["a", "b", "c"]);
});

test("a session exists when its transcript is found", () => {
  const configDir = temporaryFolder("uraeda-claude");
  mkdirSync(join(configDir, "projects", "-w"), { recursive: true });
  writeFileSync(join(configDir, "projects", "-w", "3f2c.jsonl"), "");
  const adapter = new ClaudeAdapter({ configDir, imagesDir: images(), pluginDir: "/p" });
  expect(adapter.hasSession("3f2c")).toBe(true);
  expect(adapter.hasSession("9a9a")).toBe(false);
  expect(
    new ClaudeAdapter({
      configDir: join(configDir, "none"),
      imagesDir: images(),
      pluginDir: "/p",
    }).hasSession("3f2c"),
  ).toBe(false);
});

/** A line of Claude Code's output, as JSON. */
const line = (value: Record<string, unknown>) => JSON.stringify(value);
const assistant = (content: Array<Record<string, unknown>>, parent: string | null = null) =>
  line({
    message: { content, role: "assistant" },
    parent_tool_use_id: parent,
    session_id: SESSION,
    type: "assistant",
  });
const toolUse = (name: string, input: Record<string, unknown>, id = "toolu_2") =>
  assistant([{ id, input, name, type: "tool_use" }]);
const init = line({
  plugin_errors: null,
  plugins: [{ name: "uraeda", path: "/plugin" }],
  session_id: SESSION,
  subtype: "init",
  type: "system",
});

test.each<[string, Array<string>, Array<Partial<AgentEvent>>]>([
  [
    "a partial text delta",
    [
      line({
        event: {
          delta: { text: "Hel", type: "text_delta" },
          index: 0,
          type: "content_block_delta",
        },
        parent_tool_use_id: null,
        session_id: SESSION,
        type: "stream_event",
      }),
    ],
    [{ text: "Hel", type: "textDelta" }],
  ],
  [
    "a sub-agent's delta, and other stream events",
    [
      line({
        event: { delta: { text: "x", type: "text_delta" }, index: 0, type: "content_block_delta" },
        parent_tool_use_id: "toolu_1",
        type: "stream_event",
      }),
      line({ event: { type: "message_start" }, parent_tool_use_id: null, type: "stream_event" }),
      line({
        event: { delta: { type: "thinking_delta" }, index: 0, type: "content_block_delta" },
        parent_tool_use_id: null,
        type: "stream_event",
      }),
    ],
    [],
  ],
  [
    "an assistant text block",
    [assistant([{ text: "Done.", type: "text" }])],
    [{ text: "Done.", type: "text" }],
  ],
  [
    "a Read",
    [toolUse("Read", { file_path: "/w/src/a.ts" })],
    [
      {
        id: "toolu_2",
        input: { file_path: "/w/src/a.ts" },
        kind: "read",
        name: "Read",
        target: "src/a.ts",
        type: "toolStart",
      },
    ],
  ],
  [
    "a Bash",
    [toolUse("Bash", { command: "ls" })],
    [
      {
        id: "toolu_2",
        input: { command: "ls" },
        kind: "execute",
        name: "Bash",
        target: "ls",
        type: "toolStart",
      },
    ],
  ],
  [
    "a Grep",
    [toolUse("Grep", { pattern: "TODO" })],
    [
      {
        id: "toolu_2",
        input: { pattern: "TODO" },
        kind: "search",
        name: "Grep",
        target: "TODO",
        type: "toolStart",
      },
    ],
  ],
  [
    "a WebFetch",
    [toolUse("WebFetch", { url: "https://example.com" })],
    [
      {
        id: "toolu_2",
        input: { url: "https://example.com" },
        kind: "fetch",
        name: "WebFetch",
        target: "https://example.com",
        type: "toolStart",
      },
    ],
  ],
  [
    "an Edit",
    [toolUse("Edit", { file_path: "/w/a.ts" })],
    [
      {
        id: "toolu_2",
        input: { file_path: "/w/a.ts" },
        kind: "edit",
        name: "Edit",
        target: "a.ts",
        type: "toolStart",
      },
    ],
  ],
  [
    "a tool Claude Code adds later",
    [toolUse("TodoWrite", { todos: [] })],
    [{ id: "toolu_2", input: { todos: [] }, kind: "other", name: "TodoWrite", type: "toolStart" }],
  ],
  [
    "an Agent",
    [toolUse("Agent", { description: "Map the runner code", prompt: "p" }, "toolu_1")],
    [
      {
        id: "toolu_1",
        input: { description: "Map the runner code", prompt: "p" },
        kind: "other",
        name: "Agent",
        subagent: { description: "Map the runner code" },
        type: "toolStart",
      },
    ],
  ],
  [
    "a Task, as Claude Code 2.1.296 names it",
    [toolUse("Task", { description: "Map the runner code" }, "toolu_1")],
    [
      {
        id: "toolu_1",
        input: { description: "Map the runner code" },
        kind: "other",
        name: "Task",
        subagent: { description: "Map the runner code" },
        type: "toolStart",
      },
    ],
  ],
  [
    "a sub-agent's tool, and its result; its text is not the main agent's",
    [
      assistant(
        [
          { text: "Looking.", type: "text" },
          { id: "toolu_3", input: { pattern: "*.ts" }, name: "Glob", type: "tool_use" },
        ],
        "toolu_1",
      ),
      line({
        message: {
          content: [{ content: "a.ts", tool_use_id: "toolu_3", type: "tool_result" }],
          role: "user",
        },
        parent_tool_use_id: "toolu_1",
        type: "user",
      }),
    ],
    [
      {
        id: "toolu_3",
        input: { pattern: "*.ts" },
        kind: "search",
        name: "Glob",
        parent: "toolu_1",
        target: "*.ts",
        type: "toolStart",
      },
      { id: "toolu_3", isError: false, output: "a.ts", type: "toolEnd" },
    ],
  ],
  [
    "a message started",
    [line({ command_uuid: "m1", state: "started", type: "command_lifecycle" })],
    [{ id: "m1", type: "accepted" }],
  ],
  [
    "a message cancelled",
    [line({ command_uuid: "m1", state: "cancelled", type: "command_lifecycle" })],
    [{ id: "m1", type: "cancelled" }],
  ],
  [
    "a message queued, then completed",
    [
      line({ command_uuid: "m1", state: "queued", type: "command_lifecycle" }),
      line({ command_uuid: "m1", state: "completed", type: "command_lifecycle" }),
    ],
    [],
  ],
  [
    "an interrupted turn",
    [
      line({
        errors: ["[ede_diagnostic] aborted"],
        is_error: true,
        permission_denials: [],
        subtype: "error_during_execution",
        terminal_reason: "aborted_streaming",
        type: "result",
      }),
    ],
    [{ denials: [], interrupted: true, ok: false, type: "result" }],
  ],
  [
    "init at each turn",
    [init, init],
    [
      { pluginErrors: [], plugins: ["uraeda"], sessionId: SESSION, type: "init" },
      { pluginErrors: [], plugins: ["uraeda"], sessionId: SESSION, type: "init" },
    ],
  ],
  [
    "control responses, and the system lines of 2.1.296 with nothing to show",
    [
      line({ response: { request_id: "r1", subtype: "success" }, type: "control_response" }),
      ...[
        "status",
        "hook_started",
        "task_started",
        "task_progress",
        "thinking_tokens",
        "background_tasks_changed",
      ].map((subtype) => line({ subtype, type: "system" })),
      line({ type: "rate_limit_event" }),
    ],
    [],
  ],
])("%s", (_name, input, events) => {
  const parsed = input.flatMap((text) => parseLine(text, "/w"));
  expect(parsed).toHaveLength(events.length);
  events.forEach((event, i) => expect(parsed[i]).toMatchObject(event));
  // Exact: no key beyond those expected, like a null parent.
  if (events.length > 0 && events[0]!.type === "toolStart") {
    expect(parsed[0]).toEqual(events[0]);
  }
});

test("the main agent's thinking and tool calls being written are activities; a sub-agent's are not", () => {
  const blocks: Blocks = new Map();
  const parse = (event: Record<string, unknown>, parent: string | null = null) =>
    parseLine(
      line({ event, parent_tool_use_id: parent, type: "stream_event" }),
      "/w",
      new Map(),
      blocks,
    );
  const start = (index: number, block: Record<string, unknown>) =>
    parse({ content_block: block, index, type: "content_block_start" });
  const input = (index: number, partial_json: string) =>
    parse({
      delta: { partial_json, type: "input_json_delta" },
      index,
      type: "content_block_delta",
    });

  expect(start(0, { thinking: "", type: "thinking" })).toEqual([
    { activity: { kind: "thinking" }, type: "activity" },
  ]);
  expect(start(1, { id: "toolu_1", input: {}, name: "Write", type: "tool_use" })).toEqual([
    { activity: { kind: "tool", name: "Write" }, type: "activity" },
  ]);
  // The path is named once it is whole, made relative to the session's folder, and only once.
  expect(input(1, '{"file_path": "/w/specs/a/sp')).toEqual([]);
  expect(input(1, 'ec.md", "content": "# Spec')).toEqual([
    { activity: { kind: "tool", name: "Write", target: "specs/a/spec.md" }, type: "activity" },
  ]);
  expect(input(1, String.raw`\n\nMore", "file_path": "/w/b.md"}`)).toEqual([]);
  parse({ index: 1, type: "content_block_stop" });
  expect(blocks.size).toBe(0);
  // An escaped quote stays in the path.
  start(2, { id: "toolu_2", input: {}, name: "Edit", type: "tool_use" });
  expect(input(2, String.raw`{"file_path": "/w/a \"b\".md"}`)).toEqual([
    { activity: { kind: "tool", name: "Edit", target: 'a "b".md' }, type: "activity" },
  ]);
  // A sub-agent's blocks are its own: its thinking and tools show as its tool calls end.
  expect(
    parse(
      { content_block: { type: "thinking" }, index: 0, type: "content_block_start" },
      "toolu_9",
    ),
  ).toEqual([]);
});

/** A background task's fields, as Claude Code reports them. */
const task = (id: string, type: string, extra: Record<string, unknown> = {}) => ({
  description: id,
  task_id: id,
  task_type: type,
  ...extra,
});

test("every background task but an ambient one is reported, a sub-agent or a command", () => {
  const tasks = new Map<string, string>();
  const parse = (value: Record<string, unknown>) =>
    parseLine(line({ type: "system", ...value }), undefined, tasks);

  expect(
    parse({ description: "Map", subtype: "task_started", task_id: "t1", tool_use_id: "toolu_1" }),
  ).toEqual([]);
  expect(
    parse({
      subtype: "background_tasks_changed",
      tasks: [
        task("t1", "local_agent"),
        task("t2", "local_workflow"),
        task("t3", "local_bash"),
        task("t4", "local_agent", { ambient: true }),
      ],
    }),
  ).toEqual([
    {
      tasks: [
        { kind: "subagent", tool: "toolu_1" },
        { kind: "subagent", tool: "t2" },
        { kind: "command", tool: "t3" },
      ],
      type: "background",
    },
  ]);
  expect(parse({ subtype: "background_tasks_changed", tasks: [] })).toEqual([
    { tasks: [], type: "background" },
  ]);
});

test.each<[Denial, string]>([
  [{ input: { command: "gh pr create --draft" }, tool: "Bash" }, "Bash(gh pr create --draft)"],
  // An absolute path takes two slashes: one is relative to the settings' folder. Claude Code checks
  // a write against `Edit` rules only.
  [{ input: { file_path: "/home/me/.ssh/config" }, tool: "Write" }, "Edit(//home/me/.ssh/config)"],
  [{ input: { file_path: "/w/a.ts" }, tool: "MultiEdit" }, "Edit(//w/a.ts)"],
  [{ input: { file_path: "/w/a.ts" }, tool: "Edit" }, "Edit(//w/a.ts)"],
  [{ input: { file_path: "/w/b.ts" }, tool: "Read" }, "Read(//w/b.ts)"],
  [{ input: { file_path: "src/a.ts" }, tool: "Edit" }, "Edit(src/a.ts)"],
  [{ input: { url: "https://example.com/a?b" }, tool: "WebFetch" }, "WebFetch(domain:example.com)"],
  [{ input: {}, tool: "mcp__x__y" }, "mcp__x__y"],
  // A path rule is a gitignore pattern: its special characters are escaped, as Claude Code escapes
  // the paths it saves, so the rule matches only the path.
  [{ input: { file_path: "/w/*.ts" }, tool: "Edit" }, String.raw`Edit(//w/\*.ts)`],
  [
    { input: { file_path: "/w/**/a?[0].md" }, tool: "Write" },
    String.raw`Edit(//w/\*\*/a\?\[0\].md)`,
  ],
  [{ input: { file_path: "a\\b" }, tool: "Read" }, String.raw`Read(a\\b)`],
  [{ input: { file_path: "!a.ts" }, tool: "Edit" }, String.raw`Edit(\!a.ts)`],
  [{ input: { file_path: "#a.ts" }, tool: "Edit" }, String.raw`Edit(\#a.ts)`],
])("the allow rule of %o", (denial, rule) => {
  expect(allowRule(denial)).toBe(rule);
  expect(
    new ClaudeAdapter({ imagesDir: "/data/images", pluginDir: "/plugin" }).allowRule(denial),
  ).toBe(rule);
});

test("a command with a `*` has no allow rule: Claude Code would read it as a wildcard", () => {
  for (const command of ["rm -rf build/*", "git log --format=*", "ls:*"]) {
    expect(allowRule({ input: { command }, tool: "Bash" })).toBeUndefined();
  }
});

test("a rule with a line break is no rule: a stored rule is one line", () => {
  expect(allowRule({ input: { command: "echo a\necho b" }, tool: "Bash" })).toBeUndefined();
  expect(allowRule({ input: { file_path: "src/a\nb.ts" }, tool: "Edit" })).toBeUndefined();
  expect(allowRule({ input: { file_path: "src/a\nb.ts" }, tool: "Write" })).toBeUndefined();
});

test("review focus 5: a missing command exits as missing", async () => {
  const agent = new ClaudeAdapter({
    command: "/nonexistent/claude",
    imagesDir: images(),
    pluginDir: "/p",
  }).open({
    ...open,
    cwd: tmpdir(),
    resume: false,
  });
  const events = await collect(agent.events);
  expect(events.at(-1)).toMatchObject({ missing: true, type: "exit" });
  // Writing to a process that is gone does nothing.
  agent.send({ id: "m1", images: [], text: "hi", when: "steer" });
  agent.interrupt();
  agent.close();
});

test("a missing directory exits with why, not as a missing command", async () => {
  const cwd = join(tmpdir(), "uraeda-no-such-directory");
  const command = script("exit 0");
  const agent = new ClaudeAdapter({ command, imagesDir: images(), pluginDir: "/p" }).open({
    ...open,
    cwd,
    resume: false,
  });
  const events = await collect(agent.events);
  const exit = events.at(-1) as Extract<AgentEvent, { type: "exit" }>;
  expect(exit).toMatchObject({ code: null, type: "exit" });
  expect(exit.missing).toBeUndefined();
  expect(exit.stderr).toBe(`The session's directory is gone: ${cwd}`);
});

test("version() is undefined without the command", async () => {
  expect(
    await new ClaudeAdapter({
      command: "/nonexistent/claude",
      imagesDir: images(),
      pluginDir: "/p",
    }).version(),
  ).toBeUndefined();
});

/** A command standing in for `claude`: a shell script, which runs no agent. */
function script(body: string): string {
  const dir = temporaryFolder("uraeda-claude");
  const path = join(dir, "claude");
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
  return path;
}

/** The JSON lines a stand-in command read on its stdin. */
const written = (path: string) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((text) => JSON.parse(text) as Record<string, unknown>);

test("version() is the command's first line", async () => {
  const command = script('echo "2.1.296 (Claude Code)"; echo more');
  expect(await new ClaudeAdapter({ command, imagesDir: images(), pluginDir: "/p" }).version()).toBe(
    "2.1.296 (Claude Code)",
  );
});

test("an open process streams its events, and exits with its stderr", async () => {
  const dir = temporaryFolder("uraeda-claude");
  const command = script(
    [
      `echo "$@" > "${join(dir, "args")}"`,
      `cat "${fixture("claude/tool.jsonl")}"`,
      "echo not json",
      'for i in $(seq 1 25); do echo "line $i" >&2; done',
      "exit 3",
    ].join("\n"),
  );
  const imagesDir = images();
  const agent = new ClaudeAdapter({ command, imagesDir, pluginDir: "/plugin" }).open({
    ...open,
    cwd: dir,
    resume: false,
  });
  const events = await collect(agent.events);

  expect(readFileSync(join(dir, "args"), "utf8").trim()).toBe(
    claudeArgs({ ...open, cwd: dir, resume: false }, "/plugin", imagesDir).join(" "),
  );
  expect(events.map((event) => event.type)).toEqual(["toolStart", "toolEnd", "skipped", "exit"]);
  const exit = events.at(-1) as Extract<AgentEvent, { type: "exit" }>;
  expect(exit.code).toBe(3);
  expect(exit.missing).toBeUndefined();
  expect(exit.stderr.split("\n")).toEqual(Array.from({ length: 20 }, (_, i) => `line ${i + 6}`));
});

test("send writes a user message with its uuid and priority", async () => {
  const dir = temporaryFolder("uraeda-claude");
  const command = script(`cat > "${join(dir, "stdin")}"`);
  const agent = new ClaudeAdapter({ command, imagesDir: images(), pluginDir: "/p" }).open({
    ...open,
    cwd: dir,
    resume: false,
  });
  agent.send({ id: "m1", images: [], text: "hi", when: "steer" });
  agent.send({ id: "m2", images: [], text: "then this", when: "queue" });
  agent.takeBack("m2");
  agent.close();
  const events = await collect(agent.events);

  expect(events).toEqual([{ code: 0, stderr: "", type: "exit" }]);
  const [steer, queue, takeBack] = written(join(dir, "stdin"));
  expect(steer).toEqual({
    message: { content: "hi", role: "user" },
    priority: "next",
    type: "user",
    uuid: "m1",
  });
  expect(queue).toEqual({
    message: { content: "then this", role: "user" },
    priority: "later",
    type: "user",
    uuid: "m2",
  });
  expect(takeBack).toMatchObject({
    request: { message_uuid: "m2", subtype: "cancel_async_message" },
    type: "control_request",
  });
  expect(takeBack!.request_id).toEqual(expect.any(String));
});

test("US2.2: a message with images is its text, a blank line, then one line per image", async () => {
  const dir = temporaryFolder("uraeda-claude");
  const command = script(`cat > "${join(dir, "stdin")}"`);
  const imagesDir = images();
  const agent = new ClaudeAdapter({ command, imagesDir, pluginDir: "/p" }).open({
    ...open,
    cwd: dir,
    resume: false,
  });
  const [a, b] = [join(imagesDir, "a.webp"), join(imagesDir, "b.webp")];
  agent.send({
    id: "m1",
    images: [{ path: a }, { path: b }],
    text: "What is wrong here?",
    when: "queue",
  });
  agent.send({ id: "m2", images: [{ path: a }], text: "", when: "steer" });
  agent.close();
  await collect(agent.events);

  expect(written(join(dir, "stdin"))).toEqual([
    {
      message: {
        content: `What is wrong here?\n\n[Image: ${a}]\n[Image: ${b}]`,
        role: "user",
      },
      priority: "later",
      type: "user",
      uuid: "m1",
    },
    {
      message: { content: `[Image: ${a}]`, role: "user" },
      priority: "next",
      type: "user",
      uuid: "m2",
    },
  ]);
});

test("US2.4: a feature chat's first message is its opening line, its text, then its images", async () => {
  const dir = temporaryFolder("uraeda-claude");
  const command = script(`cat > "${join(dir, "stdin")}"`);
  const imagesDir = images();
  const agent = new ClaudeAdapter({ command, imagesDir, pluginDir: "/p" }).open({
    ...open,
    cwd: dir,
    resume: false,
  });
  const opening = chatOpening({
    branch: "2026-10-12-cli-tuis",
    feature: { kind: "feature", path: "specs/2026-10-12-cli-tuis" },
  });
  const a = join(imagesDir, "a.webp");
  // The session manager joins the opening line and the text; the adapter adds the images.
  agent.send({
    id: "m1",
    images: [{ path: a }],
    text: `${opening}\nWhat is wrong here?`,
    when: "queue",
  });
  agent.close();
  await collect(agent.events);

  expect(written(join(dir, "stdin"))).toEqual([
    {
      message: { content: `${opening}\nWhat is wrong here?\n\n[Image: ${a}]`, role: "user" },
      priority: "later",
      type: "user",
      uuid: "m1",
    },
  ]);
});

test("US6.2: the images folder exists before the process starts, which --add-dir needs", async () => {
  const dir = temporaryFolder("uraeda-claude");
  const imagesDir = images();
  const command = script(`[ -d "${imagesDir}" ] && echo found > "${join(dir, "found")}"`);
  const agent = new ClaudeAdapter({ command, imagesDir, pluginDir: "/p" }).open({
    ...open,
    cwd: dir,
    resume: false,
  });
  await collect(agent.events);

  expect(readFileSync(join(dir, "found"), "utf8")).toBe("found\n");
});

test("an image the agent read stays out of its tool's output", () => {
  const base64 = "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA=";
  const line = JSON.stringify({
    message: {
      content: [
        {
          content: [
            { source: { data: base64, media_type: "image/webp", type: "base64" }, type: "image" },
          ],
          tool_use_id: "toolu_1",
          type: "tool_result",
        },
      ],
      role: "user",
    },
    tool_use_result: {
      file: { base64, originalSize: 40, type: "image/webp" },
      type: "image",
    },
    type: "user",
  });

  expect(parseLine(line)).toEqual([{ id: "toolu_1", isError: false, output: "", type: "toolEnd" }]);
});

test("interrupt writes the interrupt control request, and close ends stdin", async () => {
  const dir = temporaryFolder("uraeda-claude");
  const command = script(`cat > "${join(dir, "stdin")}"\necho closed >&2`);
  const agent = new ClaudeAdapter({ command, imagesDir: images(), pluginDir: "/p" }).open({
    ...open,
    cwd: dir,
    resume: false,
  });
  agent.interrupt();
  agent.interrupt();
  agent.close();
  const events = await collect(agent.events);

  expect(events).toEqual([{ code: 0, stderr: "closed", type: "exit" }]);
  const [first, second] = written(join(dir, "stdin"));
  expect(first).toEqual({
    request: { subtype: "interrupt" },
    request_id: expect.any(String),
    type: "control_request",
  });
  expect(second!.request_id).not.toBe(first!.request_id);
});

test("kill sends its signal to the process", async () => {
  const dir = temporaryFolder("uraeda-claude");
  const command = script(
    `trap 'echo interrupted >&2; exit 130' INT\necho not json\nwhile true; do sleep 0.1; done`,
  );
  const agent = new ClaudeAdapter({ command, imagesDir: images(), pluginDir: "/p" }).open({
    ...open,
    cwd: dir,
    resume: false,
  });
  const events: Array<AgentEvent> = [];
  for await (const event of agent.events) {
    events.push(event);
    if (event.type !== "exit") {
      agent.kill("SIGINT");
    }
  }
  expect(events.at(-1)).toEqual({ code: 130, stderr: "interrupted", type: "exit" });
});

/** Whether the process is running. */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Resolves once the process is gone, or rejects after 10 seconds, killing it. */
async function gone(pid: number): Promise<void> {
  try {
    await vi.waitFor(
      () => {
        if (alive(pid)) {
          throw new Error(`process ${pid} outlived its session's process`);
        }
      },
      { interval: 50, timeout: 10_000 },
    );
  } catch (error) {
    process.kill(pid, "SIGKILL");
    throw error;
  }
}

/** Waits for a stand-in command to write its child's pid. */
function childPid(file: string): Promise<number> {
  return vi.waitFor(
    () => {
      const pid = existsSync(file) ? readFileSync(file, "utf8").trim() : "";
      if (pid === "") {
        throw new Error("the stand-in command did not start");
      }
      return Number(pid);
    },
    { interval: 50, timeout: 10_000 },
  );
}

test("kill signals the process's group: the processes it started end with it", async () => {
  const dir = temporaryFolder("uraeda-claude");
  const command = script(`sleep 30 &\necho $! > "${join(dir, "pid")}"\nwait`);
  const agent = new ClaudeAdapter({ command, imagesDir: images(), pluginDir: "/p" }).open({
    ...open,
    cwd: dir,
    resume: false,
  });
  const pid = await childPid(join(dir, "pid"));

  agent.kill("SIGTERM");
  const events = await collect(agent.events);

  expect(events.at(-1)).toMatchObject({ type: "exit" });
  await gone(pid);
});

test("a session's process and the processes it started end with the server", async () => {
  const dir = temporaryFolder("uraeda-claude");
  // It does not read its stdin, so the end of its pipe does not end it.
  const command = script(`sleep 30 &\necho $! > "${join(dir, "pid")}"\nwait`);
  const server = [
    `import { existsSync } from "node:fs";
`,
    `import { ClaudeAdapter } from ${JSON.stringify(join(import.meta.dirname, "../claude.ts"))};`,
    `new ClaudeAdapter({ command: ${JSON.stringify(command)}, imagesDir: ${JSON.stringify(images())}, pluginDir: "/p" })`,
    `  .open({ cwd: ${JSON.stringify(dir)}, nativeId: "id", resume: false });`,
    `const wait = setInterval(() => {`,
    `  if (existsSync(${JSON.stringify(join(dir, "pid"))})) { clearInterval(wait); process.exit(0); }`,
    `}, 20);`,
  ].join("\n");
  writeFileSync(join(dir, "server.ts"), server);

  const { status } = spawnSync(process.execPath, [join(dir, "server.ts")], { timeout: 10_000 });

  expect(status).toBe(0);
  await gone(await childPid(join(dir, "pid")));
});

test("the plugin folder holds the skill", () => {
  const { plugin } = layout();

  expect(JSON.parse(readFileSync(join(plugin, ".claude-plugin", "plugin.json"), "utf8"))).toEqual({
    name: "uraeda",
  });
  expect(existsSync(join(plugin, "skills", "uraeda", "SKILL.md"))).toBe(true);
});
