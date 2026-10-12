import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { fixture } from "uraeda-binding/test-utils";
import { ClaudeAdapter, claudeArgs, lines, parseLine, PLUGIN_DIR } from "../claude.ts";
import type { AgentEvent } from "../events.ts";

const SESSION = "06e0f968-6806-4810-b91e-df3ca38e0f25";
const start = { cwd: "/w", message: "m", sessionId: "3f2c", pluginDir: "/p" };

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
  expect(claudeArgs({ ...start, resume: false })).toEqual([
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "auto",
    "--plugin-dir",
    "/p",
    "--session-id",
    "3f2c",
  ]);
});

test("a resumed session with an allow rule", () => {
  expect(
    claudeArgs({ ...start, resume: true, allowed: "Bash(gh pr create --draft)" }).slice(10),
  ).toEqual(["--resume", "3f2c", "--allowedTools", "Bash(gh pr create --draft)"]);
});

test("no argument skips permissions or sets a model", () => {
  for (const args of [
    claudeArgs({ ...start, resume: false }),
    claudeArgs({ ...start, resume: true, allowed: "Bash(gh pr create --draft)" }),
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
        input: { command: "echo ok", description: "Print ok" },
      },
      { type: "toolEnd", id: "toolu_01SVEKzLxnSQyRcc45azZnG9", isError: false, output: "ok" },
    ],
  ],
  ["retry.jsonl", [{ type: "retry", attempt: 1, delayMs: 30000, error: "rate_limit" }]],
  [
    "result-success.jsonl",
    [{ type: "result", ok: true, costUsd: 0.188748, errors: [], denials: [] }],
  ],
  [
    "result-denied.jsonl",
    [
      {
        type: "result",
        ok: true,
        costUsd: 0.1160696,
        errors: [],
        denials: [
          {
            tool: "Bash",
            input: { command: "gh pr create --draft", description: "Create a draft pull request" },
          },
        ],
      },
    ],
  ],
  [
    "result-error.jsonl",
    [
      {
        type: "result",
        ok: false,
        costUsd: 0.0907116,
        errors: ["Reached maximum number of turns (1)"],
        denials: [],
      },
    ],
  ],
  // Hooks, rate limit status, thinking tokens, the denial notice, a push: nothing to show.
  ["ignored.jsonl", []],
  ["unknown.jsonl", [{ type: "skipped" }]],
])("the lines of %s", (file, events) => {
  expect(recorded(file).flatMap(parseLine)).toEqual(events);
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
    total_cost_usd: 0,
    permission_denials: [],
  });
  expect(parseLine(line)).toEqual([
    { type: "result", ok: false, costUsd: 0, errors: ["API Error: 500"], denials: [] },
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
  const configDir = mkdtempSync(join(tmpdir(), "uraeda-claude-"));
  mkdirSync(join(configDir, "projects", "-w"), { recursive: true });
  writeFileSync(join(configDir, "projects", "-w", "3f2c.jsonl"), "");
  const adapter = new ClaudeAdapter({ configDir });
  expect(adapter.hasSession("3f2c")).toBe(true);
  expect(adapter.hasSession("9a9a")).toBe(false);
  expect(new ClaudeAdapter({ configDir: join(configDir, "none") }).hasSession("3f2c")).toBe(false);
});

test("review focus 5: a missing command exits as missing", async () => {
  const run = new ClaudeAdapter({ command: "/nonexistent/claude" }).start({
    ...start,
    cwd: tmpdir(),
    resume: false,
  });
  const events = await collect(run.events);
  expect(events.at(-1)).toMatchObject({ type: "exit", missing: true });
});

test("version() is undefined without the command", async () => {
  expect(await new ClaudeAdapter({ command: "/nonexistent/claude" }).version()).toBeUndefined();
});

/** A command standing in for `claude`: a shell script, which runs no agent. */
function script(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "uraeda-claude-"));
  const path = join(dir, "claude");
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
  return path;
}

test("version() is the command's first line", async () => {
  const command = script('echo "2.1.296 (Claude Code)"; echo more');
  expect(await new ClaudeAdapter({ command }).version()).toBe("2.1.296 (Claude Code)");
});

test("a run writes its message on stdin, streams its events, and exits with its stderr", async () => {
  const dir = mkdtempSync(join(tmpdir(), "uraeda-claude-"));
  const command = script(
    [
      `cat > "${join(dir, "stdin")}"`,
      `echo "$@" > "${join(dir, "args")}"`,
      `cat "${fixture("claude/tool.jsonl")}"`,
      "echo not json",
      'for i in $(seq 1 25); do echo "line $i" >&2; done',
      "exit 3",
    ].join("\n"),
  );
  const run = new ClaudeAdapter({ command }).start({ ...start, cwd: dir, resume: false });
  const events = await collect(run.events);

  expect(JSON.parse(readFileSync(join(dir, "stdin"), "utf8"))).toEqual({
    type: "user",
    message: { role: "user", content: "m" },
  });
  expect(readFileSync(join(dir, "args"), "utf8").trim()).toBe(
    claudeArgs({ ...start, resume: false }).join(" "),
  );
  expect(events.map((event) => event.type)).toEqual(["toolStart", "toolEnd", "skipped", "exit"]);
  const exit = events.at(-1) as Extract<AgentEvent, { type: "exit" }>;
  expect(exit.code).toBe(3);
  expect(exit.missing).toBeUndefined();
  expect(exit.stderr.split("\n")).toEqual(Array.from({ length: 20 }, (_, i) => `line ${i + 6}`));
});

test("interrupt() sends SIGINT to the process", async () => {
  const dir = mkdtempSync(join(tmpdir(), "uraeda-claude-"));
  const command = script(
    `trap 'echo interrupted >&2; exit 130' INT\necho not json\nwhile true; do sleep 0.1; done`,
  );
  const run = new ClaudeAdapter({ command }).start({ ...start, cwd: dir, resume: false });
  const events: Array<AgentEvent> = [];
  for await (const event of run.events) {
    events.push(event);
    if (event.type !== "exit") {
      run.interrupt();
    }
  }
  expect(events.at(-1)).toEqual({ type: "exit", code: 130, stderr: "interrupted" });
});

test("the plugin folder holds the skill", () => {
  expect(
    JSON.parse(readFileSync(join(PLUGIN_DIR, ".claude-plugin", "plugin.json"), "utf8")),
  ).toEqual({ name: "uraeda" });
  expect(existsSync(join(PLUGIN_DIR, "skills", "uraeda", "SKILL.md"))).toBe(true);
});
