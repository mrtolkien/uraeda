import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { fixture, temporaryFolder } from "uraeda-binding/test-utils";
import { allowRule, type Blocks, lines, parseLine } from "../claude-events.ts";
import { ClaudeAdapter, claudeArgs, PLUGIN_DIR } from "../claude.ts";
import type { AgentEvent, Denial } from "../events.ts";

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

async function* chunks(...parts: Array<Buffer>) {
  for (const part of parts) {
    yield part;
  }
}

test("SC-006: a new session's arguments", () => {
  expect(claudeArgs({ ...open, resume: false }, "/plugin")).toEqual([
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
    "--session-id",
    "id",
  ]);
});

test("a resumed session with an allow rule", () => {
  expect(
    claudeArgs({ ...open, resume: true, allowed: "Bash(gh pr create --draft)" }, "/plugin").slice(
      11,
    ),
  ).toEqual(["--resume", "id", "--allowedTools", "Bash(gh pr create --draft)"]);
});

test("no argument skips permissions or sets a model", () => {
  for (const args of [
    claudeArgs({ ...open, resume: false }, "/plugin"),
    claudeArgs({ ...open, resume: true, allowed: "Bash(gh pr create --draft)" }, "/plugin"),
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
  const adapter = new ClaudeAdapter({ pluginDir: "/plugin" });
  expect([adapter.kind, adapter.name]).toEqual(["claude", "Claude Code"]);
  expect(adapter.capabilities).toEqual({
    steer: true,
    queue: true,
    takeBack: true,
    approvals: false,
    subagents: true,
  });
});

test.each<[string, Array<AgentEvent>]>([
  [
    "init.jsonl",
    [
      {
        type: "init",
        sessionId: SESSION,
        plugins: ["uraeda", "cc-plugin-telemetry"],
        pluginErrors: [],
      },
    ],
  ],
  [
    "init-plugin-error.jsonl",
    [
      {
        type: "init",
        sessionId: "cb94b45c-b09a-43bb-88f4-a60071539d67",
        plugins: ["cc-plugin-telemetry"],
        pluginErrors: ["Path not found: /tmp/no-such-plugin (commands)"],
      },
    ],
  ],
  // A thinking block shows nothing, then the text.
  ["text.jsonl", [{ type: "text", text: "ready" }]],
  [
    "tool.jsonl",
    [
      {
        type: "toolStart",
        id: "toolu_01SVEKzLxnSQyRcc45azZnG9",
        name: "Bash",
        kind: "execute",
        input: { command: "echo ok", description: "Print ok" },
        target: "echo ok",
      },
      { type: "toolEnd", id: "toolu_01SVEKzLxnSQyRcc45azZnG9", isError: false, output: "ok" },
    ],
  ],
  ["retry.jsonl", [{ type: "retry", attempt: 1, delayMs: 30000, error: "rate_limit" }]],
  [
    "result-success.jsonl",
    [
      {
        type: "result",
        ok: true,
        errors: [],
        denials: [],
        interrupted: false,
      },
    ],
  ],
  [
    "result-denied.jsonl",
    [
      {
        type: "result",
        ok: true,
        errors: [],
        denials: [
          {
            tool: "Bash",
            input: { command: "gh pr create --draft", description: "Create a draft pull request" },
          },
        ],
        interrupted: false,
      },
    ],
  ],
  [
    "result-error.jsonl",
    [
      {
        type: "result",
        ok: false,
        errors: ["Reached maximum number of turns (1)"],
        denials: [],
        interrupted: false,
      },
    ],
  ],
  // Hooks, rate limit status, thinking tokens, the denial notice, a push: nothing to show.
  ["ignored.jsonl", []],
  ["unknown.jsonl", [{ type: "skipped" }]],
])("the lines of %s", (file, events) => {
  expect(recorded(file).flatMap((line) => parseLine(line))).toEqual(events);
});

test("a tool result made of text blocks is joined", () => {
  const line = JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "toolu_1",
          is_error: true,
          content: [
            { type: "text", text: "Exit code 1" },
            { type: "text", text: "no git remotes found" },
          ],
        },
      ],
    },
  });
  expect(parseLine(line)).toEqual([
    { type: "toolEnd", id: "toolu_1", isError: true, output: "Exit code 1\nno git remotes found" },
  ]);
});

test("a success result marked as an error is not ok, and gives its text", () => {
  const line = JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: true,
    result: "API Error: 500",
    permission_denials: [],
  });
  expect(parseLine(line)).toEqual([
    {
      type: "result",
      ok: false,
      errors: ["API Error: 500"],
      denials: [],
      interrupted: false,
    },
  ]);
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
  expect(parseLine(result[0]!)).toEqual([{ type: "text", text: "Café" }]);
});

test("lines() keeps a last line without a newline, and drops empty lines", async () => {
  expect(await collect(lines(chunks(Buffer.from("a\n\nb\r\nc"))))).toEqual(["a", "b", "c"]);
});

test("a session exists when its transcript is found", () => {
  const configDir = temporaryFolder("uraeda-claude");
  mkdirSync(join(configDir, "projects", "-w"), { recursive: true });
  writeFileSync(join(configDir, "projects", "-w", "3f2c.jsonl"), "");
  const adapter = new ClaudeAdapter({ configDir, pluginDir: "/p" });
  expect(adapter.hasSession("3f2c")).toBe(true);
  expect(adapter.hasSession("9a9a")).toBe(false);
  expect(
    new ClaudeAdapter({ configDir: join(configDir, "none"), pluginDir: "/p" }).hasSession("3f2c"),
  ).toBe(false);
});

/** A line of Claude Code's output, as JSON. */
const line = (value: Record<string, unknown>) => JSON.stringify(value);
const assistant = (content: Array<Record<string, unknown>>, parent: string | null = null) =>
  line({
    type: "assistant",
    message: { role: "assistant", content },
    parent_tool_use_id: parent,
    session_id: SESSION,
  });
const toolUse = (name: string, input: Record<string, unknown>, id = "toolu_2") =>
  assistant([{ type: "tool_use", id, name, input }]);
const init = line({
  type: "system",
  subtype: "init",
  session_id: SESSION,
  plugins: [{ name: "uraeda", path: "/plugin" }],
  plugin_errors: null,
});

test.each<[string, Array<string>, Array<Partial<AgentEvent>>]>([
  [
    "a partial text delta",
    [
      line({
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hel" },
        },
        parent_tool_use_id: null,
        session_id: SESSION,
      }),
    ],
    [{ type: "textDelta", text: "Hel" }],
  ],
  [
    "a sub-agent's delta, and other stream events",
    [
      line({
        type: "stream_event",
        event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "x" } },
        parent_tool_use_id: "toolu_1",
      }),
      line({ type: "stream_event", event: { type: "message_start" }, parent_tool_use_id: null }),
      line({
        type: "stream_event",
        event: { type: "content_block_delta", index: 0, delta: { type: "thinking_delta" } },
        parent_tool_use_id: null,
      }),
    ],
    [],
  ],
  [
    "an assistant text block",
    [assistant([{ type: "text", text: "Done." }])],
    [{ type: "text", text: "Done." }],
  ],
  [
    "a Read",
    [toolUse("Read", { file_path: "/w/src/a.ts" })],
    [
      {
        type: "toolStart",
        id: "toolu_2",
        name: "Read",
        kind: "read",
        input: { file_path: "/w/src/a.ts" },
        target: "src/a.ts",
      },
    ],
  ],
  [
    "a Bash",
    [toolUse("Bash", { command: "ls" })],
    [
      {
        type: "toolStart",
        id: "toolu_2",
        name: "Bash",
        kind: "execute",
        input: { command: "ls" },
        target: "ls",
      },
    ],
  ],
  [
    "a Grep",
    [toolUse("Grep", { pattern: "TODO" })],
    [
      {
        type: "toolStart",
        id: "toolu_2",
        name: "Grep",
        kind: "search",
        input: { pattern: "TODO" },
        target: "TODO",
      },
    ],
  ],
  [
    "a WebFetch",
    [toolUse("WebFetch", { url: "https://example.com" })],
    [
      {
        type: "toolStart",
        id: "toolu_2",
        name: "WebFetch",
        kind: "fetch",
        input: { url: "https://example.com" },
        target: "https://example.com",
      },
    ],
  ],
  [
    "an Edit",
    [toolUse("Edit", { file_path: "/w/a.ts" })],
    [
      {
        type: "toolStart",
        id: "toolu_2",
        name: "Edit",
        kind: "edit",
        input: { file_path: "/w/a.ts" },
        target: "a.ts",
      },
    ],
  ],
  [
    "a tool Claude Code adds later",
    [toolUse("TodoWrite", { todos: [] })],
    [{ type: "toolStart", id: "toolu_2", name: "TodoWrite", kind: "other", input: { todos: [] } }],
  ],
  [
    "an Agent",
    [toolUse("Agent", { description: "Map the runner code", prompt: "p" }, "toolu_1")],
    [
      {
        type: "toolStart",
        id: "toolu_1",
        name: "Agent",
        kind: "other",
        input: { description: "Map the runner code", prompt: "p" },
        subagent: { description: "Map the runner code" },
      },
    ],
  ],
  [
    "a Task, as Claude Code 2.1.296 names it",
    [toolUse("Task", { description: "Map the runner code" }, "toolu_1")],
    [
      {
        type: "toolStart",
        id: "toolu_1",
        name: "Task",
        kind: "other",
        input: { description: "Map the runner code" },
        subagent: { description: "Map the runner code" },
      },
    ],
  ],
  [
    "a sub-agent's tool, and its result; its text is not the main agent's",
    [
      assistant(
        [
          { type: "text", text: "Looking." },
          { type: "tool_use", id: "toolu_3", name: "Glob", input: { pattern: "*.ts" } },
        ],
        "toolu_1",
      ),
      line({
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "toolu_3", content: "a.ts" }],
        },
        parent_tool_use_id: "toolu_1",
      }),
    ],
    [
      {
        type: "toolStart",
        id: "toolu_3",
        name: "Glob",
        kind: "search",
        input: { pattern: "*.ts" },
        target: "*.ts",
        parent: "toolu_1",
      },
      { type: "toolEnd", id: "toolu_3", isError: false, output: "a.ts" },
    ],
  ],
  [
    "a message started",
    [line({ type: "command_lifecycle", command_uuid: "m1", state: "started" })],
    [{ type: "accepted", id: "m1" }],
  ],
  [
    "a message cancelled",
    [line({ type: "command_lifecycle", command_uuid: "m1", state: "cancelled" })],
    [{ type: "cancelled", id: "m1" }],
  ],
  [
    "a message queued, then completed",
    [
      line({ type: "command_lifecycle", command_uuid: "m1", state: "queued" }),
      line({ type: "command_lifecycle", command_uuid: "m1", state: "completed" }),
    ],
    [],
  ],
  [
    "an interrupted turn",
    [
      line({
        type: "result",
        subtype: "error_during_execution",
        is_error: true,
        terminal_reason: "aborted_streaming",
        errors: ["[ede_diagnostic] aborted"],
        permission_denials: [],
      }),
    ],
    [{ type: "result", ok: false, denials: [], interrupted: true }],
  ],
  [
    "init at each turn",
    [init, init],
    [
      { type: "init", sessionId: SESSION, plugins: ["uraeda"], pluginErrors: [] },
      { type: "init", sessionId: SESSION, plugins: ["uraeda"], pluginErrors: [] },
    ],
  ],
  [
    "control responses, and the system lines of 2.1.296 with nothing to show",
    [
      line({ type: "control_response", response: { subtype: "success", request_id: "r1" } }),
      ...[
        "status",
        "hook_started",
        "task_started",
        "task_progress",
        "thinking_tokens",
        "background_tasks_changed",
      ].map((subtype) => line({ type: "system", subtype })),
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
      line({ type: "stream_event", event, parent_tool_use_id: parent }),
      "/w",
      new Map(),
      blocks,
    );
  const start = (index: number, block: Record<string, unknown>) =>
    parse({ type: "content_block_start", index, content_block: block });
  const input = (index: number, partial_json: string) =>
    parse({
      type: "content_block_delta",
      index,
      delta: { type: "input_json_delta", partial_json },
    });

  expect(start(0, { type: "thinking", thinking: "" })).toEqual([
    { type: "activity", activity: { kind: "thinking" } },
  ]);
  expect(start(1, { type: "tool_use", id: "toolu_1", name: "Write", input: {} })).toEqual([
    { type: "activity", activity: { kind: "tool", name: "Write" } },
  ]);
  // The path is named once it is whole, made relative to the session's folder, and only once.
  expect(input(1, '{"file_path": "/w/specs/a/sp')).toEqual([]);
  expect(input(1, 'ec.md", "content": "# Spec')).toEqual([
    { type: "activity", activity: { kind: "tool", name: "Write", target: "specs/a/spec.md" } },
  ]);
  expect(input(1, '\\n\\nMore", "file_path": "/w/b.md"}')).toEqual([]);
  parse({ type: "content_block_stop", index: 1 });
  expect(blocks.size).toBe(0);
  // An escaped quote stays in the path.
  start(2, { type: "tool_use", id: "toolu_2", name: "Edit", input: {} });
  expect(input(2, '{"file_path": "/w/a \\"b\\".md"}')).toEqual([
    { type: "activity", activity: { kind: "tool", name: "Edit", target: 'a "b".md' } },
  ]);
  // A sub-agent's blocks are its own: its thinking and tools show as its tool calls end.
  expect(
    parse(
      { type: "content_block_start", index: 0, content_block: { type: "thinking" } },
      "toolu_9",
    ),
  ).toEqual([]);
});

test("background sub-agents are reported by their tool calls; shells and watchers are not", () => {
  const tasks = new Map<string, string>();
  const parse = (value: Record<string, unknown>) =>
    parseLine(line({ type: "system", ...value }), undefined, tasks);
  const task = (id: string, type: string, extra: Record<string, unknown> = {}) => ({
    task_id: id,
    task_type: type,
    description: id,
    ...extra,
  });

  expect(
    parse({ subtype: "task_started", task_id: "t1", tool_use_id: "toolu_1", description: "Map" }),
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
  ).toEqual([{ type: "background", tools: ["toolu_1", "t2"] }]);
  expect(parse({ subtype: "background_tasks_changed", tasks: [] })).toEqual([
    { type: "background", tools: [] },
  ]);
});

test.each<[Denial, string]>([
  [{ tool: "Bash", input: { command: "gh pr create --draft" } }, "Bash(gh pr create --draft)"],
  // An absolute path takes two slashes: one is relative to the settings' folder. Claude Code checks
  // a write against `Edit` rules only.
  [{ tool: "Write", input: { file_path: "/home/me/.ssh/config" } }, "Edit(//home/me/.ssh/config)"],
  [{ tool: "MultiEdit", input: { file_path: "/w/a.ts" } }, "Edit(//w/a.ts)"],
  [{ tool: "Edit", input: { file_path: "/w/a.ts" } }, "Edit(//w/a.ts)"],
  [{ tool: "Read", input: { file_path: "/w/b.ts" } }, "Read(//w/b.ts)"],
  [{ tool: "Edit", input: { file_path: "src/a.ts" } }, "Edit(src/a.ts)"],
  [{ tool: "WebFetch", input: { url: "https://example.com/a?b" } }, "WebFetch(domain:example.com)"],
  [{ tool: "mcp__x__y", input: {} }, "mcp__x__y"],
  // A path rule is a gitignore pattern: its special characters are escaped, as Claude Code escapes
  // the paths it saves, so the rule matches only the path.
  [{ tool: "Edit", input: { file_path: "/w/*.ts" } }, "Edit(//w/\\*.ts)"],
  [{ tool: "Write", input: { file_path: "/w/**/a?[0].md" } }, "Edit(//w/\\*\\*/a\\?\\[0\\].md)"],
  [{ tool: "Read", input: { file_path: "a\\b" } }, "Read(a\\\\b)"],
  [{ tool: "Edit", input: { file_path: "!a.ts" } }, "Edit(\\!a.ts)"],
  [{ tool: "Edit", input: { file_path: "#a.ts" } }, "Edit(\\#a.ts)"],
])("the allow rule of %o", (denial, rule) => {
  expect(allowRule(denial)).toBe(rule);
  expect(new ClaudeAdapter({ pluginDir: "/plugin" }).allowRule(denial)).toBe(rule);
});

test("a command with a `*` has no allow rule: Claude Code would read it as a wildcard", () => {
  for (const command of ["rm -rf build/*", "git log --format=*", "ls:*"]) {
    expect(allowRule({ tool: "Bash", input: { command } })).toBeUndefined();
  }
});

test("review focus 5: a missing command exits as missing", async () => {
  const agent = new ClaudeAdapter({ command: "/nonexistent/claude", pluginDir: "/p" }).open({
    ...open,
    cwd: tmpdir(),
    resume: false,
  });
  const events = await collect(agent.events);
  expect(events.at(-1)).toMatchObject({ type: "exit", missing: true });
  // Writing to a process that is gone does nothing.
  agent.send({ id: "m1", text: "hi", when: "steer" });
  agent.interrupt();
  agent.close();
});

test("a missing directory exits with why, not as a missing command", async () => {
  const cwd = join(tmpdir(), "uraeda-no-such-directory");
  const command = script("exit 0");
  const agent = new ClaudeAdapter({ command, pluginDir: "/p" }).open({
    ...open,
    cwd,
    resume: false,
  });
  const events = await collect(agent.events);
  const exit = events.at(-1) as Extract<AgentEvent, { type: "exit" }>;
  expect(exit).toMatchObject({ type: "exit", code: null });
  expect(exit.missing).toBeUndefined();
  expect(exit.stderr).toBe(`The session's directory is gone: ${cwd}`);
});

test("version() is undefined without the command", async () => {
  expect(
    await new ClaudeAdapter({ command: "/nonexistent/claude", pluginDir: "/p" }).version(),
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
  expect(await new ClaudeAdapter({ command, pluginDir: "/p" }).version()).toBe(
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
  const agent = new ClaudeAdapter({ command, pluginDir: "/plugin" }).open({
    ...open,
    cwd: dir,
    resume: false,
  });
  const events = await collect(agent.events);

  expect(readFileSync(join(dir, "args"), "utf8").trim()).toBe(
    claudeArgs({ ...open, cwd: dir, resume: false }, "/plugin").join(" "),
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
  const agent = new ClaudeAdapter({ command, pluginDir: "/p" }).open({
    ...open,
    cwd: dir,
    resume: false,
  });
  agent.send({ id: "m1", text: "hi", when: "steer" });
  agent.send({ id: "m2", text: "then this", when: "queue" });
  agent.takeBack("m2");
  agent.close();
  const events = await collect(agent.events);

  expect(events).toEqual([{ type: "exit", code: 0, stderr: "" }]);
  const [steer, queue, takeBack] = written(join(dir, "stdin"));
  expect(steer).toEqual({
    type: "user",
    message: { role: "user", content: "hi" },
    uuid: "m1",
    priority: "next",
  });
  expect(queue).toEqual({
    type: "user",
    message: { role: "user", content: "then this" },
    uuid: "m2",
    priority: "later",
  });
  expect(takeBack).toMatchObject({
    type: "control_request",
    request: { subtype: "cancel_async_message", message_uuid: "m2" },
  });
  expect(takeBack!.request_id).toEqual(expect.any(String));
});

test("interrupt writes the interrupt control request, and close ends stdin", async () => {
  const dir = temporaryFolder("uraeda-claude");
  const command = script(`cat > "${join(dir, "stdin")}"\necho closed >&2`);
  const agent = new ClaudeAdapter({ command, pluginDir: "/p" }).open({
    ...open,
    cwd: dir,
    resume: false,
  });
  agent.interrupt();
  agent.interrupt();
  agent.close();
  const events = await collect(agent.events);

  expect(events).toEqual([{ type: "exit", code: 0, stderr: "closed" }]);
  const [first, second] = written(join(dir, "stdin"));
  expect(first).toEqual({
    type: "control_request",
    request_id: expect.any(String),
    request: { subtype: "interrupt" },
  });
  expect(second!.request_id).not.toBe(first!.request_id);
});

test("kill sends its signal to the process", async () => {
  const dir = temporaryFolder("uraeda-claude");
  const command = script(
    `trap 'echo interrupted >&2; exit 130' INT\necho not json\nwhile true; do sleep 0.1; done`,
  );
  const agent = new ClaudeAdapter({ command, pluginDir: "/p" }).open({
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
  expect(events.at(-1)).toEqual({ type: "exit", code: 130, stderr: "interrupted" });
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

/** Resolves once the process is gone, or rejects after 3 seconds. */
async function gone(pid: number): Promise<void> {
  for (let tries = 0; tries < 60; tries++) {
    if (!alive(pid)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  process.kill(pid, "SIGKILL");
  throw new Error(`process ${pid} outlived its session's process`);
}

/** Waits for a stand-in command to write its child's pid. */
async function childPid(file: string): Promise<number> {
  for (let tries = 0; tries < 60; tries++) {
    if (existsSync(file) && readFileSync(file, "utf8").trim() !== "") {
      return Number(readFileSync(file, "utf8").trim());
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("the stand-in command did not start");
}

test("kill signals the process's group: the processes it started end with it", async () => {
  const dir = temporaryFolder("uraeda-claude");
  const command = script(`sleep 30 &\necho $! > "${join(dir, "pid")}"\nwait`);
  const agent = new ClaudeAdapter({ command, pluginDir: "/p" }).open({
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
    `new ClaudeAdapter({ command: ${JSON.stringify(command)}, pluginDir: "/p" })`,
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
  expect(
    JSON.parse(readFileSync(join(PLUGIN_DIR, ".claude-plugin", "plugin.json"), "utf8")),
  ).toEqual({ name: "uraeda" });
  expect(existsSync(join(PLUGIN_DIR, "skills", "uraeda", "SKILL.md"))).toBe(true);
});
