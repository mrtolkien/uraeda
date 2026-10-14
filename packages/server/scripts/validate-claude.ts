// oxlint-disable max-lines -- over the limit before the code quality decision: the stdin checks in a module of their own
/**
 * Checks the Claude Code integration against this machine's `claude`, signed in: its version, a
 * first run with the Uraeda skill loaded as a plugin, its session's transcript, a resumed run, an
 * interrupted run followed by a resumed one, and the allow rule of a blocked write outside the
 * project. Then the messages a session writes to one process with its stdin kept open, with
 * `--model haiku` in an empty temporary folder: two turns, partial text, a steered and a queued
 * message, their lifecycle events, taking a queued message back, an interrupt, a sub-agent, and a
 * resume after stdin closes.
 *
 * Run it by hand, with `vp run validate:claude`, after a Claude Code upgrade, or when runs break.
 * It is not part of `vp test` or `vp run ready`: it runs the real `claude`, which costs a few
 * cents, in a temporary copy of `fixtures/repo`, with `--permission-mode auto`.
 *
 * With `--stdin`, only the stdin checks run, with no copy of the fixture needed by the others.
 *
 * It prints one line per check, `PASS` or `FAIL` with what it got, and exits 1 on any failure.
 */
import { type ChildProcessByStdio, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable, Writable } from "node:stream";
import { fixtureRepo } from "uraeda-binding/test-utils";
import type { AgentProcess } from "../src/runner/adapter.ts";
import { allowRule, lines } from "../src/runner/claude-events.ts";
import { ClaudeAdapter, PLUGIN_DIR } from "../src/runner/claude.ts";
import type { AgentEvent } from "../src/runner/events.ts";

/** A run that has not exited after this long is stopped, and its check fails. */
const RUN_TIMEOUT_MS = 180_000;
/** An interrupted run must exit within this long, as the runner sends SIGTERM after it. */
const INTERRUPT_MS = 10_000;

const configDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
const adapter = new ClaudeAdapter({ configDir, pluginDir: PLUGIN_DIR });
const cwd = fixtureRepo();
/** A folder outside the project, for the sixth check. */
const outside = mkdtempSync(join(tmpdir(), "uraeda-outside-"));
/** An empty folder for the stdin checks. */
const stdinDir = mkdtempSync(join(tmpdir(), "uraeda-stdin-"));
/** With `--stdin`, only the stdin checks run. */
const stdinOnly = process.argv.includes("--stdin");
let failed = false;

function report(name: string, ok: boolean, got: unknown) {
  if (ok) {
    process.stdout.write(`PASS ${name}\n`);
  } else {
    failed = true;
    process.stdout.write(
      `FAIL ${name}: got ${typeof got === "string" ? got : JSON.stringify(got)}\n`,
    );
  }
}

/**
 * Opens a session's process, sends it one message, and reads its turn to its `result`, calling
 * `onEvent` on each event; then closes it, reads it to its exit, and returns every event.
 */
async function run(
  message: string,
  sessionId: string,
  resume: boolean,
  onEvent?: (event: AgentEvent, agent: AgentProcess) => void,
  agentAdapter: ClaudeAdapter = adapter,
): Promise<Array<AgentEvent>> {
  const agent = agentAdapter.open({ cwd, nativeId: sessionId, resume });
  const timeout = setTimeout(() => agent.kill("SIGTERM"), RUN_TIMEOUT_MS);
  const events: Array<AgentEvent> = [];
  agent.send({ id: randomUUID(), text: message, when: "queue" });
  try {
    for await (const event of agent.events) {
      events.push(event);
      onEvent?.(event, agent);
      if (event.type === "result") {
        agent.close();
      }
    }
  } finally {
    clearTimeout(timeout);
  }
  return events;
}

const find = <T extends AgentEvent["type"]>(events: Array<AgentEvent>, type: T) =>
  events.find((event): event is Extract<AgentEvent, { type: T }> => event.type === type);

/** What a run gave, when a check fails: its init, its result, and its exit. */
const summary = (events: Array<AgentEvent>) =>
  events.filter((event) => ["init", "result", "exit"].includes(event.type));

/** Whether the session's transcript shows the skill loaded from the plugin's copy. */
function skillLoaded(sessionId: string): boolean {
  const projects = join(configDir, "projects");
  const base = `Base directory for this skill: ${join(PLUGIN_DIR, "skills", "uraeda")}`;
  return readdirSync(projects).some((folder) => {
    try {
      return readFileSync(join(projects, folder, `${sessionId}.jsonl`), "utf8").includes(base);
    } catch {
      return false;
    }
  });
}

/** A line of Claude Code's stream-json output, as it printed it. */
type Line = Record<string, unknown> & { subtype?: string; type?: string };

/** A message or a response the stdin checks wait for longer than this fails its check. */
const WAIT_MS = 120_000;
/** After a turn's `result`, a reply that should not come is waited for this long. */
const QUIET_MS = 8000;
/** A tool call long enough to write messages while it runs. */
const SLEEP_5 =
  "Run the shell command `sleep 5` with the Bash tool, in the foreground, then reply with the word done.";

/**
 * One `claude` process in print mode, stream-json both ways, its stdin kept open, as a session
 * runs it: every line it prints is kept, and `next` waits for a line after a given index.
 */
class StdinSession {
  readonly lines: Array<Line> = [];
  readonly exited: Promise<number | null>;
  #waiters: Array<() => void> = [];
  #child: ChildProcessByStdio<Writable, Readable, null>;

  constructor(cwd: string, args: Array<string>) {
    const child = spawn(
      "claude",
      [
        "-p",
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--verbose",
        "--model",
        "haiku",
        "--permission-mode",
        "auto",
        ...args,
      ],
      { cwd, stdio: ["pipe", "pipe", "ignore"] },
    );
    this.#child = child;
    child.stdin.on("error", () => {});
    this.exited = new Promise((resolve) => child.on("close", resolve));
    void (async () => {
      for await (const line of lines(child.stdout)) {
        try {
          this.lines.push(JSON.parse(line) as Line);
        } catch {
          this.lines.push({ line, type: "unparsed" });
        }
        for (const wake of this.#waiters.splice(0)) {
          wake();
        }
      }
      for (const wake of this.#waiters.splice(0)) {
        wake();
      }
    })();
  }

  write(message: unknown) {
    this.#child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  /** Writes a user message, with a `uuid`, and returns that uuid. */
  say(content: string, priority?: "next" | "later"): string {
    const uuid = randomUUID();
    this.write({
      type: "user",
      uuid,
      ...(priority === undefined ? {} : { priority }),
      message: { content, role: "user" },
    });
    return uuid;
  }

  /** The index of the first line from `from` on that matches, waited for up to `ms`. */
  async next(from: number, match: (line: Line) => boolean, ms = WAIT_MS): Promise<number> {
    const deadline = Date.now() + ms;
    for (;;) {
      const index = this.lines.findIndex((line, i) => i >= from && match(line));
      if (index >= 0) {
        return index;
      }
      const left = deadline - Date.now();
      if (left <= 0 || this.#child.exitCode !== null) {
        return -1;
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, left);
        this.#waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }

  /** The lines from `from` to `to`, excluded, or to the end. */
  slice(from: number, to = this.lines.length): Array<Line> {
    return this.lines.slice(from, to < 0 ? this.lines.length : to);
  }

  close() {
    this.#child.stdin.end();
  }

  kill() {
    this.#child.kill("SIGTERM");
  }
}

const isResult = (line: Line) => line.type === "result";
const isToolUse = (line: Line) => toolUses(line).length > 0;
const lifecycle = (uuid: string, state: string) => (line: Line) =>
  line.type === "command_lifecycle" && line.command_uuid === uuid && line.state === state;

/** The `tool_use` blocks of an assistant line. */
function toolUses(line: Line): Array<{ id: string; name: string }> {
  if (line.type !== "assistant") {
    return [];
  }
  const content = (line.message as { content?: unknown } | undefined)?.content;
  return Array.isArray(content)
    ? content.filter(
        (block): block is { id: string; name: string; type: "tool_use" } =>
          block?.type === "tool_use" && typeof block.id === "string",
      )
    : [];
}

/** The text an assistant wrote in some lines, lower-cased. */
function said(lines: Array<Line>): string {
  return lines
    .flatMap((line) => {
      if (line.type !== "assistant" || line.parent_tool_use_id) {
        return [];
      }
      const content = (line.message as { content?: unknown } | undefined)?.content;
      return Array.isArray(content)
        ? content.filter((block) => block?.type === "text").map((block) => String(block.text))
        : [];
    })
    .join("\n")
    .toLowerCase();
}

/** The types of some lines, with their subtype or state, each once, for the rulings. */
function names(lines: Array<Line>): Array<string> {
  return [
    ...new Set(
      lines.map((line) => {
        const kind = line.subtype ?? line.state ?? (line.event as Line | undefined)?.type;
        return typeof kind === "string" ? `${line.type}/${kind}` : String(line.type);
      }),
    ),
  ].sort();
}

/** The take-back requests to try, in order, for the `take back` check. */
const TAKE_BACKS: Array<[string, (uuid: string) => Record<string, unknown>]> = [
  ["cancel_queued_message", (uuid) => ({ subtype: "cancel_queued_message", uuid })],
  ["cancel_async_message", (uuid) => ({ message_uuid: uuid, subtype: "cancel_async_message" })],
  ["interrupt with cancel_queued", () => ({ cancel_queued: true, subtype: "interrupt" })],
];

/**
 * The nine checks of the messages a session writes to one process, its stdin kept open. They run
 * one after another in one process, then resume its session in a second one.
 */
// oxlint-disable-next-line max-lines-per-function -- over the limit before the code quality decision: each numbered check in a function of its own
async function stdinChecks() {
  const session = new StdinSession(stdinDir, ["--include-partial-messages"]);
  try {
    // 1. Two turns, a few seconds apart. 2. Their partial text. 5. Their lifecycle events.
    const first = session.say("Remember the word pineapple. Reply with the word ok.");
    const firstEnd = await session.next(0, isResult);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const from = session.lines.length;
    const second = session.say("Reply with the word two.");
    const secondEnd = await session.next(from, isResult);
    const sessionIds = [firstEnd, secondEnd].map((i) => session.lines[i]?.session_id);
    report(
      "two turns",
      firstEnd >= 0 &&
        secondEnd >= 0 &&
        sessionIds[0] !== undefined &&
        sessionIds[0] === sessionIds[1],
      { firstEnd, secondEnd, sessionIds },
    );
    const deltas = session
      .slice(0, secondEnd)
      .filter(
        (line) =>
          line.type === "stream_event" &&
          (line.event as Line | undefined)?.type === "content_block_delta" &&
          ((line.event as Line).delta as Line | undefined)?.type === "text_delta",
      );
    report("partial text", deltas.length > 0, names(session.slice(0, secondEnd)));
    const order = (uuid: string) => [
      session.lines.findIndex(lifecycle(uuid, "queued")),
      session.lines.findIndex(lifecycle(uuid, "started")),
    ];
    const lifecycles = [order(first), order(second)];
    report(
      "lifecycle",
      lifecycles.every(([queued, started]) => queued >= 0 && started > queued),
      lifecycles,
    );

    // 3. A steer, read once the running `sleep 5` ends, in the same turn.
    let start = session.lines.length;
    session.say(SLEEP_5);
    const steerTool = await session.next(start, isToolUse);
    session.say("Also reply with the word steered.", "next");
    const steerEnd = await session.next(start, isResult);
    const steerExtra = await session.next(steerEnd + 1, isResult, QUIET_MS);
    report(
      "steer",
      steerTool >= 0 &&
        steerEnd >= 0 &&
        steerExtra < 0 &&
        said(session.slice(start, steerEnd)).includes("steered"),
      { said: said(session.slice(start)), steerEnd, steerExtra, steerTool },
    );

    // 4. A queued message, answered in a turn of its own.
    start = session.lines.length;
    session.say(SLEEP_5);
    await session.next(start, isToolUse);
    session.say("Reply with the word queued.", "later");
    const queueFirst = await session.next(start, isResult);
    const queueSecond = await session.next(queueFirst + 1, isResult);
    report(
      "queue",
      queueFirst >= 0 &&
        queueSecond > queueFirst &&
        !said(session.slice(start, queueFirst)).includes("queued") &&
        said(session.slice(queueFirst, queueSecond)).includes("queued"),
      { queueFirst, queueSecond, said: said(session.slice(start)) },
    );

    // 6. Taking a queued message back, with each request in turn, until one works.
    const tried: Array<unknown> = [];
    let worked: string | undefined;
    for (const [name, request] of TAKE_BACKS) {
      start = session.lines.length;
      session.say(SLEEP_5);
      await session.next(start, isToolUse);
      const uuid = session.say("Reply with the word cancelme.", "later");
      await session.next(start, lifecycle(uuid, "queued"));
      session.write({ request: request(uuid), request_id: randomUUID(), type: "control_request" });
      const cancelled = await session.next(start, lifecycle(uuid, "cancelled"), 10_000);
      const end = await session.next(start, isResult);
      const extra = await session.next(end + 1, isResult, QUIET_MS);
      const response = session.slice(start).find((line) => line.type === "control_response");
      const turnKept = said(session.slice(start, end)).includes("done");
      tried.push({ cancelled, extra, name, response: response?.response, turnKept });
      if (cancelled >= 0 && extra < 0 && !said(session.slice(start)).includes("cancelme")) {
        worked = name;
        break;
      }
    }
    takeBack = worked;
    report(`take back (${worked ?? "none"})`, worked !== undefined, tried);

    // 7. An interrupt ends the turn with a result, and the process takes the next message.
    // Claude Code refuses a bare `sleep 30`, so the command waits 30 seconds in node.
    start = session.lines.length;
    session.say(
      'Run the shell command `node -e "setTimeout(() => {}, 30000)"` with the Bash tool, in the foreground, then reply with the word done.',
    );
    await session.next(start, isToolUse);
    const interruptedAt = Date.now();
    session.write({
      request: { subtype: "interrupt" },
      request_id: randomUUID(),
      type: "control_request",
    });
    const interruptEnd = await session.next(start, isResult, INTERRUPT_MS);
    const stoppedIn = Date.now() - interruptedAt;
    const afterStart = session.lines.length;
    session.say("Reply with the word after.");
    const afterEnd = await session.next(afterStart, isResult);
    interruptResult = session.lines[interruptEnd];
    report(
      `interrupt (${stoppedIn} ms)`,
      interruptEnd >= 0 &&
        afterEnd >= 0 &&
        said(session.slice(afterStart, afterEnd)).includes("after"),
      { afterEnd, interruptEnd, result: interruptResult },
    );

    // 8. A sub-agent's messages carry the id of the tool call that started it.
    start = session.lines.length;
    session.say(
      "Use the Agent tool (also called Task) to start one sub-agent whose whole job is to reply with the word hi. Then reply with the word done.",
    );
    const agentCall = await session.next(start, (line) =>
      toolUses(line).some((use) => use.name === "Agent" || use.name === "Task"),
    );
    const agentId =
      agentCall < 0
        ? undefined
        : toolUses(session.lines[agentCall]!).find((use) => ["Agent", "Task"].includes(use.name))
            ?.id;
    const agentEnd = await session.next(start, isResult);
    const children = session
      .slice(start, agentEnd)
      .filter(
        (line) => typeof line.parent_tool_use_id === "string" && line.parent_tool_use_id !== "",
      );
    subAgentLines = names(children);
    report(
      "sub-agent",
      agentId !== undefined &&
        children.length > 0 &&
        children.every((line) => line.parent_tool_use_id === agentId),
      { agentId, parents: [...new Set(children.map((line) => line.parent_tool_use_id))] },
    );

    seen = names(session.lines);
  } finally {
    session.close();
    const closed = await Promise.race([
      session.exited,
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 30_000)),
    ]);
    if (closed === "timeout") {
      session.kill();
    }
  }

  // 9. With stdin closed, a resumed process answers with the earlier context.
  const id = session.lines.find((line) => typeof line.session_id === "string")?.session_id;
  const resumed = new StdinSession(stdinDir, ["--resume", String(id)]);
  try {
    resumed.say("Which word did I ask you to remember? Reply with that word only.");
    const end = await resumed.next(0, isResult);
    report(
      "resume",
      end >= 0 &&
        resumed.lines[end]?.session_id === id &&
        said(resumed.slice(0, end)).includes("pineapple"),
      { end, id, said: said(resumed.lines) },
    );
  } finally {
    resumed.close();
    await resumed.exited;
  }

  const version = (await adapter.version()) ?? "unknown";
  process.stdout.write(`\nClaude Code ${version}\n`);
  process.stdout.write(`take back: ${takeBack ?? "none"}\n`);
  const { errors, is_error, result, subtype, terminal_reason, user_message_uuids } =
    interruptResult ?? {};
  process.stdout.write(
    `interrupt result: ${JSON.stringify({ errors, is_error, result, subtype, terminal_reason, user_message_uuids })}\n`,
  );
  process.stdout.write(`sub-agent lines: ${subAgentLines.join(", ")}\n`);
  process.stdout.write(`lines seen: ${seen.join(", ")}\n`);
}

/** What the stdin checks saw, printed after them for the rulings. */
let takeBack: string | undefined;
let interruptResult: Line | undefined;
let subAgentLines: Array<string> = [];
let seen: Array<string> = [];

try {
  if (!stdinOnly) {
    // 1. The version.
    const version = await adapter.version();
    report(`version() returns a version (${version})`, version !== undefined, version);

    // 2. A first run, with the skill.
    const sessionId = randomUUID();
    const first = await run(
      "/uraeda:uraeda Reply with the single word ready, and do nothing else.",
      sessionId,
      false,
    );
    const init = find(first, "init");
    const result = find(first, "result");
    report(
      "a first run loads the uraeda plugin, runs /uraeda:uraeda, and ends with an ok result",
      init?.sessionId === sessionId &&
        init.plugins.includes("uraeda") &&
        init.pluginErrors.length === 0 &&
        result?.ok === true &&
        skillLoaded(sessionId),
      { events: summary(first), skillLoaded: skillLoaded(sessionId) },
    );

    // 3. Its transcript.
    report(
      "hasSession() finds the first run's session",
      adapter.hasSession(sessionId),
      `no transcript for ${sessionId} in ${join(configDir, "projects")}`,
    );

    // 4. A resumed run.
    const again = await run("Reply with the word again", sessionId, true);
    report(
      "a resumed run keeps the session ID",
      find(again, "init")?.sessionId === sessionId && find(again, "result")?.ok === true,
      summary(again),
    );

    // 5. An interrupted run, then a resumed one. Claude Code refuses a bare `sleep 30`, so the
    // command waits 30 seconds in node.
    let interruptedAt: number | undefined;
    const interrupted = await run(
      'Run the shell command `node -e "setTimeout(() => {}, 30000)"` with the Bash tool, in the foreground, then reply with the word done.',
      sessionId,
      true,
      (event, agent) => {
        if (event.type === "toolStart" && interruptedAt === undefined) {
          interruptedAt = Date.now();
          agent.interrupt();
        }
      },
    );
    const stoppedIn = interruptedAt === undefined ? undefined : Date.now() - interruptedAt;
    const after = await run("Reply with the word back", sessionId, true);
    report(
      `an interrupted run exits within 10 s (${stoppedIn} ms), and a resumed run after it is ok`,
      stoppedIn !== undefined &&
        stoppedIn <= INTERRUPT_MS &&
        find(after, "init")?.sessionId === sessionId &&
        find(after, "result")?.ok === true,
      { after: summary(after), interrupted: summary(interrupted), stoppedIn },
    );

    // 6. The allow rule of a write outside the project matches it. `auto` mode lets that write
    // through, and an ask rule wins over an allow rule, so no run can show "Allow and continue"
    // lifting a block: the rule is given as an ask rule instead, which Claude Code matches the same
    // way, and must block the write. A single leading slash would match nothing. The ask rule is
    // passed with `--settings` to this run only, through a wrapper around `claude`.
    const target = join(outside, "allowed.txt");
    const rule = allowRule({ input: { file_path: target }, tool: "Write" });
    const settings = join(outside, "settings.json");
    writeFileSync(settings, JSON.stringify({ permissions: { ask: [rule] } }));
    const wrapper = join(outside, "claude-with-settings");
    writeFileSync(wrapper, `#!/bin/sh\nexec claude --settings '${settings}' "$@"\n`);
    chmodSync(wrapper, 0o755);
    const blocked = await run(
      `Use the Write tool to create the file ${target} containing the word hi. Do nothing else, and do not use Bash.`,
      randomUUID(),
      false,
      undefined,
      new ClaudeAdapter({ command: wrapper, configDir, pluginDir: PLUGIN_DIR }),
    );
    const denials = find(blocked, "result")?.denials ?? [];
    report(
      `the rule ${rule} matches a write outside the project`,
      denials.some((denial) => denial.tool === "Write" && allowRule(denial) === rule) &&
        !existsSync(target),
      { denials, rule, written: existsSync(target) },
    );
  }
  await stdinChecks();
} finally {
  rmSync(cwd, { force: true, recursive: true });
  rmSync(outside, { force: true, recursive: true });
  rmSync(stdinDir, { force: true, recursive: true });
}

process.exit(failed ? 1 : 0);
