/**
 * Checks the Claude Code integration against this machine's `claude`, signed in: its version, a
 * first run with the Uraeda skill loaded as a plugin, its session's transcript, a resumed run, an
 * interrupted run followed by a resumed one, and the allow rule of a blocked write outside the
 * project, and the image checks. Then the messages a session writes to one process with its stdin
 * kept open, with `--model haiku` in an empty temporary folder: two turns, partial text, a steered
 * and a queued message, their lifecycle events, taking a queued message back, an interrupt, a
 * sub-agent, and a resume after stdin closes.
 *
 * Run it by hand, with `vp run validate:claude`, after a Claude Code upgrade, or when runs break.
 * It is not part of `vp test` or `vp run ready`: it runs the real `claude`, which costs a few
 * cents, in a temporary copy of `fixtures/repo`, with `--permission-mode auto`.
 *
 * With `--stdin`, only the stdin checks run, with no copy of the fixture needed by the others. Every
 * run ends with the check of Uraeda's tool, a session on Haiku given a stand-in of it, which also
 * checks that `settings.json` is left as it was; with `--tools`, only that check runs. Then the check
 * of a reviewer: `/code-review` on a commit that adds a bug, on Haiku; with `--review`, only it runs.
 *
 * It prints one line per check, `PASS` or `FAIL` with what it got, and exits 1 on any failure.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fixtureRepo } from "uraeda-binding/test-utils";
import type { AgentProcess } from "../src/runner/adapter.ts";
import { allowRule } from "../src/runner/claude-events.ts";
import { layout } from "../src/paths.ts";
import { ClaudeAdapter } from "../src/runner/claude.ts";
import type { AgentEvent } from "../src/runner/events.ts";
import { imageChecks, imagesFolder, wrappedAdapter } from "./validate-claude-images.ts";
import { INTERRUPT_MS, stdinChecks } from "./validate-claude-stdin.ts";
import { lastChecks, lastOnly } from "./validate-reviews.ts";

/** A run that has not exited after this long is stopped, and its check fails. */
const RUN_TIMEOUT_MS = 180_000;

const configDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
/** A folder outside the project, for the sixth and seventh checks, their wrappers, and images. */
const outside = mkdtempSync(join(tmpdir(), "uraeda-outside-"));
const adapter = new ClaudeAdapter({
  configDir,
  imagesDir: imagesFolder(outside),
  pluginDir: layout().plugin,
});
const cwd = fixtureRepo();
/** An empty folder for the stdin checks. */
const stdinDir = mkdtempSync(join(tmpdir(), "uraeda-stdin-"));
/** With `--stdin`, only the stdin checks run. */
const stdinOnly = process.argv.includes("--stdin");
const toolsOnly = lastOnly(process.argv);
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
  images: Array<{ path: string }> = [],
): Promise<Array<AgentEvent>> {
  const agent = agentAdapter.open({ cwd, nativeId: sessionId, resume, skills: [] });
  const timeout = setTimeout(() => agent.kill("SIGTERM"), RUN_TIMEOUT_MS);
  const events: Array<AgentEvent> = [];
  agent.send({ id: randomUUID(), images, text: message, when: "queue" });
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
  const base = `Base directory for this skill: ${join(layout().plugin, "skills", "uraeda")}`;
  return readdirSync(projects).some((folder) => {
    try {
      return readFileSync(join(projects, folder, `${sessionId}.jsonl`), "utf8").includes(base);
    } catch {
      return false;
    }
  });
}

try {
  if (!stdinOnly && !toolsOnly) {
    // 1. The version.
    const version = await adapter.version();
    report(`version() returns a version (${version})`, version !== undefined, version);

    // 2. A first run, with the skill.
    const sessionId = randomUUID();
    const first = await run(
      "/uraeda Reply with the single word ready, and do nothing else.",
      sessionId,
      false,
    );
    const init = find(first, "init");
    const result = find(first, "result");
    report(
      "a first run loads the uraeda plugin, runs /uraeda, and ends with an ok result",
      init?.sessionId === sessionId &&
        init.problem === undefined &&
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
    const blocked = await run(
      `Use the Write tool to create the file ${target} containing the word hi. Do nothing else, and do not use Bash.`,
      randomUUID(),
      false,
      undefined,
      wrappedAdapter({ configDir, outside }, "claude-with-settings", { settings }),
    );
    const denials = find(blocked, "result")?.denials ?? [];
    report(
      `the rule ${rule} matches a write outside the project`,
      denials.some((denial) => denial.tool === "Write" && allowRule(denial) === rule) &&
        !existsSync(target),
      { denials, rule, written: existsSync(target) },
    );
    await imageChecks({ configDir, cwd, outside, report, run });
  }
  if (!toolsOnly) {
    await stdinChecks(adapter, stdinDir, report);
  }
  const settings = join(configDir, "settings.json");
  await lastChecks(
    adapter,
    process.argv,
    { cwd: stdinDir, pick: { model: "haiku" }, report, settings },
    { effort: "low", pick: { model: "haiku" }, report },
  );
} finally {
  rmSync(cwd, { force: true, recursive: true });
  rmSync(outside, { force: true, recursive: true });
  rmSync(stdinDir, { force: true, recursive: true });
}

process.exit(failed ? 1 : 0);
