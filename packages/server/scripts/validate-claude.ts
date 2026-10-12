/**
 * Checks the Claude Code integration against this machine's `claude`, signed in: its version, a
 * first run with the Uraeda skill loaded as a plugin, its session's transcript, a resumed run, an
 * interrupted run followed by a resumed one, and the allow rule of a blocked write outside the
 * project.
 *
 * Run it by hand, with `vp run validate:claude`, after a Claude Code upgrade, or when runs break.
 * It is not part of `vp test` or `vp run ready`: it runs the real `claude`, which costs a few
 * cents, in a temporary copy of `fixtures/repo`, with `--permission-mode auto`.
 *
 * It prints one line per check, `ok` or `FAIL` with what it got, and exits 1 on any failure.
 */
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
import { fixtureRepo } from "uraeda-binding/test-utils";
import type { AgentRun } from "../src/runner/adapter.ts";
import { ClaudeAdapter, PLUGIN_DIR } from "../src/runner/claude.ts";
import type { AgentEvent } from "../src/runner/events.ts";
import { allowRule } from "../src/runner/message.ts";

/** A run that has not exited after this long is stopped, and its check fails. */
const RUN_TIMEOUT_MS = 180_000;
/** An interrupted run must exit within this long, as the runner sends SIGTERM after it. */
const INTERRUPT_MS = 10_000;

const configDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
const adapter = new ClaudeAdapter({ configDir });
const cwd = fixtureRepo();
/** A folder outside the project, for the sixth check. */
const outside = mkdtempSync(join(tmpdir(), "uraeda-outside-"));
let failed = false;

function report(name: string, ok: boolean, got: unknown) {
  if (ok) {
    console.log(`ok   ${name}`);
  } else {
    failed = true;
    console.log(`FAIL ${name}: got ${typeof got === "string" ? got : JSON.stringify(got)}`);
  }
}

/** Runs to the end, calling `onEvent` on each event, and returns them all. */
async function run(
  message: string,
  sessionId: string,
  resume: boolean,
  onEvent?: (event: AgentEvent, agent: AgentRun) => void,
  agentAdapter: ClaudeAdapter = adapter,
): Promise<Array<AgentEvent>> {
  const agent = agentAdapter.start({ cwd, message, sessionId, resume, pluginDir: PLUGIN_DIR });
  const timeout = setTimeout(() => agent.terminate(), RUN_TIMEOUT_MS);
  const events: Array<AgentEvent> = [];
  try {
    for await (const event of agent.events) {
      events.push(event);
      onEvent?.(event, agent);
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

try {
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
    { stoppedIn, interrupted: summary(interrupted), after: summary(after) },
  );

  // 6. The allow rule of a write outside the project matches it. `auto` mode lets that write
  // through, and an ask rule wins over an allow rule, so no run can show "Allow and continue"
  // lifting a block: the rule is given as an ask rule instead, which Claude Code matches the same
  // way, and must block the write. A single leading slash would match nothing. The ask rule is
  // passed with `--settings` to this run only, through a wrapper around `claude`.
  const target = join(outside, "allowed.txt");
  const rule = allowRule({ tool: "Write", input: { file_path: target } });
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
    new ClaudeAdapter({ configDir, command: wrapper }),
  );
  const denials = find(blocked, "result")?.denials ?? [];
  report(
    `the rule ${rule} matches a write outside the project`,
    denials.some((denial) => denial.tool === "Write" && allowRule(denial) === rule) &&
      !existsSync(target),
    { rule, denials, written: existsSync(target) },
  );
} finally {
  rmSync(cwd, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
