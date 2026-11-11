// Records exchanges with the real `codex app-server`, for `crates/server/tests/codex.rs`: each is
// one short message, sent by the Node server's own runtime, `CodexAdapter`, in a temporary folder
// outside any repository, and every line both sides wrote, in the order they wrote them.
//
//   nix develop -c node fixtures/runtimes/codex/record.ts [name ...]
//
// It uses the `codex` of the machine and its owner's account: run it by hand, for the cases named,
// all of them without a name. Then run `node-events.ts`, which writes what the Node runtime makes
// of each.
//
// - **The sandbox is read-only.** The runtime asks for `workspace-write`; between it and Codex,
//   this script asks for `read-only` instead, in `thread/start` and in `turn/start`, and writes
//   the thread's answer with the sandbox the runtime asked for, without which the runtime refuses
//   the thread. Nothing else of an exchange is changed, but what is scrubbed. No message asks
//   Codex for more than its sandbox gives: an action Codex's reviewer approves runs outside it.
//   The check of the Rust runtime against the real `codex`, the ignored test of
//   `crates/server/tests/codex/real.rs`, runs through the same wrapper, `--between`.
// - **An exchange is scrubbed as it is written.** The session's folder reads `/session-dir`, the
//   home folder `/home/me`. The answers keep only the fields a runtime reads: `config/read` its
//   model and effort, `initialize` no terminal's name, `model/list` each model's names and efforts, a thread's start its id, what
//   it runs on, and its permissions. The notifications of the owner's own setup, their hooks,
//   MCP servers, apps, and account, are left out, as are the plan and the credits of a usage
//   report.
//
// A file is `<name>.jsonl`: its first line says how the process was opened and the message sent,
// then one line per message, `{"client": ..}` for the runtime's and `{"server": ..}` for Codex's.
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

type Json = Record<string, unknown>;
const isJson = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const here = dirname(fileURLToPath(import.meta.url));

/** The sandbox the runtime asks for, as Codex 0.163.0 answers it. */
const ASKED = {
  excludeSlashTmp: false,
  excludeTmpdirEnvVar: false,
  networkAccess: false,
  type: "workspaceWrite",
  writableRoots: [],
};

/**
 * Runs the real `codex` with `args`, passing each line both ways and writing it to `log`. Any
 * other use of the command, as `--version`, runs it as it is.
 */
function between(log: string, args: Array<string>) {
  // The machine's `codex`, by its path when a stand-in comes before it on the `PATH`.
  const codex = process.env.URAEDA_REAL_CODEX ?? "codex";
  const child = spawn(codex, args, { stdio: ["pipe", "pipe", "inherit"] });
  if (args[0] !== "app-server") {
    process.stdin.pipe(child.stdin);
    child.stdout.pipe(process.stdout);
    child.on("close", (code) => process.exit(code ?? 1));
    return;
  }
  const starts = new Set<unknown>();
  createInterface({ input: process.stdin })
    .on("line", (line) => {
      appendFileSync(log, `${JSON.stringify({ client: JSON.parse(line) })}\n`);
      const message = JSON.parse(line) as Json;
      const params = isJson(message.params) ? message.params : {};
      if (message.method === "thread/start" || message.method === "thread/resume") {
        starts.add(message.id);
        params.sandbox = "read-only";
      }
      if (message.method === "turn/start") {
        params.sandboxPolicy = { type: "readOnly" };
      }
      child.stdin.write(`${JSON.stringify(message)}\n`);
    })
    .on("close", () => child.stdin.end());
  createInterface({ input: child.stdout }).on("line", (line) => {
    const message = JSON.parse(line) as Json;
    if (starts.has(message.id) && isJson(message.result) && isJson(message.result.sandbox)) {
      if (message.result.sandbox.type !== "readOnly") {
        process.stderr.write(`Codex did not apply the read-only sandbox: ${line}\n`);
        child.kill("SIGKILL");
        process.exit(1);
      }
      message.result.sandbox = ASKED;
    }
    appendFileSync(log, `${JSON.stringify({ server: message })}\n`);
    process.stdout.write(`${JSON.stringify(message)}\n`);
  });
  child.on("close", (code) => process.exit(code ?? 1));
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => child.kill(signal));
  }
}

/** A case to record: how its process opens, its message, and what its folder holds first. */
type Case = {
  message: { review?: boolean; text: string };
  open: { effort?: string; model?: string };
  /** Prepares the session's folder: its message, when it depends on the folder. */
  prepare?: (dir: string) => { review?: boolean; text: string } | undefined;
};

const MODEL = "gpt-6-luna";

/** `git` in `dir`, with an identity of its own. */
function git(dir: string, ...args: Array<string>): string {
  const identity = ["-c", "user.name=Uraeda", "-c", "user.email=uraeda@example.com"];
  const quiet = ["-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main"];
  return execFileSync("git", [...identity, ...quiet, ...args], { cwd: dir, encoding: "utf8" });
}

const CASES: Record<string, Case> = {
  // A model the account does not have: the turn fails.
  error: { message: { text: "Say hi." }, open: { model: "gpt-bogus-9" } },
  // A command, and its output.
  command: {
    message: { text: "Run `cat note.txt` and reply with what it printed, nothing else." },
    open: { effort: "low", model: MODEL },
    prepare: (dir) => {
      writeFileSync(join(dir, "note.txt"), "The tide comes in at nine.\n");
      return undefined;
    },
  },
  // A thought before the answer.
  reasoning: {
    message: {
      text:
        "Think it through before answering, without running any command: a train leaves at " +
        "9:40 and arrives at 11:05 after a 12-minute stop. How long does it move? Answer in " +
        "one sentence.",
    },
    open: { effort: "high", model: MODEL },
  },
  // A reply in several pieces.
  reply: {
    message: {
      text: "Without running any command, describe the sea at dawn in three short sentences.",
    },
    open: { effort: "low", model: MODEL },
  },
  // Codex's own review, of one small commit.
  review: {
    message: { text: "" },
    open: { effort: "low", model: MODEL },
    prepare: (dir) => {
      git(dir, "init", "--quiet");
      writeFileSync(join(dir, "sum.js"), "export const sum = (a, b) => a + b;\n");
      git(dir, "add", "sum.js");
      git(dir, "commit", "--quiet", "-m", "add sum");
      writeFileSync(join(dir, "sum.js"), "export const sum = (a, b) => a - b;\n");
      git(dir, "commit", "--quiet", "-am", "tidy sum");
      const [head, base] = git(dir, "log", "--format=%h", "-2").trim().split("\n");
      const range = `${base}..${head}`;
      const text =
        `Review the code changes of the commits ${range}: run \`git diff ${range}\` to see them, ` +
        `and \`git log ${range}\` for their messages. Provide prioritized, actionable findings.` +
        "\n\nBe brief.";
      return { review: true, text };
    },
  },
};

/** Records each case of `names`, every case for none. */
async function recordAll(names: Array<string>) {
  const { CodexAdapter } = await import("../../../packages/server/src/runner/codex.ts");
  for (const name of names.length > 0 ? names : Object.keys(CASES)) {
    const recorded = CASES[name];
    if (recorded === undefined) {
      throw new Error(`no case named ${name}: ${Object.keys(CASES).join(", ")}`);
    }
    const dir = mkdtempSync(join(tmpdir(), "uraeda-codex-record-"));
    const session = join(dir, "session");
    const plugin = join(dir, "plugin");
    execFileSync("mkdir", ["-p", session, join(plugin, "skills")]);
    const message = recorded.prepare?.(session) ?? recorded.message;
    const log = join(dir, "log.jsonl");
    writeFileSync(log, "");
    const command = join(dir, "codex");
    const self = fileURLToPath(import.meta.url);
    writeFileSync(
      command,
      `#!/bin/sh\nexec "${process.execPath}" "${self}" --between "${log}" "$@"\n`,
    );
    chmodSync(command, 0o755);
    const agent = new CodexAdapter({ command, pluginDir: plugin }).open({
      cwd: session,
      nativeId: "",
      resume: false,
      skills: [],
      ...recorded.open,
    });
    agent.send({ id: "m1", images: [], when: "queue", ...message });
    const seen: Array<string> = [];
    for await (const event of agent.events) {
      seen.push(event.type);
      if (event.type === "result" || (event.type === "init" && event.problem !== undefined)) {
        agent.close();
      }
    }
    const header = { message: scrub(message, session, plugin), open: recorded.open };
    const lines = readFileSync(log, "utf8").split("\n").filter(Boolean);
    const kept = written(
      lines.map((line) => JSON.parse(line) as Json),
      session,
      plugin,
    );
    const text = [header, ...kept].map((line) => `${JSON.stringify(line)}\n`).join("");
    writeFileSync(join(here, `${name}.jsonl`), text);
    process.stdout.write(`${name}: ${kept.length} of ${lines.length} lines, ${seen.join(" ")}\n`);
  }
}

/** The notifications kept: what a thread and its turns say, and the account's usage. */
const KEPT = [
  /^thread\/(started|settings\/updated|tokenUsage\/updated|status\/changed)$/,
  /^turn\/(started|completed)$/,
  /^item\//,
  /^account\/rateLimits\/updated$/,
  /^model\/rerouted$/,
  /^guardianWarning$/,
  /^error$/,
];

/** The fields of `value` named. */
function pick(value: unknown, ...keys: Array<string>): Json {
  const from = isJson(value) ? value : {};
  return Object.fromEntries(keys.filter((key) => key in from).map((key) => [key, from[key]]));
}

/** An answer with only what a runtime reads of it, by the method it answers. */
function answer(method: string | undefined, result: unknown): unknown {
  switch (method) {
    case "config/read":
      return {
        config: pick(isJson(result) ? result.config : {}, "model", "model_reasoning_effort"),
      };
    case "initialize":
      return { ...pick(result, "codexHome", "platformFamily", "platformOs"), userAgent: "uraeda/0.163.0" };
    case "model/list": {
      const rows = isJson(result) && Array.isArray(result.data) ? result.data : [];
      const fields = [
        "defaultReasoningEffort",
        "description",
        "displayName",
        "hidden",
        "id",
        "isDefault",
        "model",
      ];
      const data = rows.map((row) => ({
        ...pick(row, ...fields),
        supportedReasoningEfforts: (isJson(row) && Array.isArray(row.supportedReasoningEfforts)
          ? row.supportedReasoningEfforts
          : []
        ).map((effort) => pick(effort, "reasoningEffort")),
      }));
      return { data, ...pick(result, "nextCursor") };
    }
    case "thread/start":
    case "thread/resume": {
      const fields = ["approvalPolicy", "approvalsReviewer", "cwd", "model", "reasoningEffort"];
      const thread = pick(isJson(result) ? result.thread : {}, "id");
      return { ...pick(result, ...fields, "sandbox"), thread };
    }
    default:
      return result;
  }
}

/** A notification with the owner's own left out: a usage report's plan and credits. */
function notification(message: Json): Json {
  const params = isJson(message.params) ? message.params : {};
  if (message.method === "account/rateLimits/updated" && isJson(params.rateLimits)) {
    return { ...message, params: { rateLimits: { ...params.rateLimits, credits: null, planType: null } } };
  }
  if (message.method === "thread/started" && isJson(params.thread)) {
    const fields = ["id", "parentThreadId", "forkedFromId", "model", "reasoningEffort", "cwd"];
    return { ...message, params: { thread: pick(params.thread, ...fields) } };
  }
  return message;
}

/** The lines of an exchange as they are kept: scrubbed, the owner's own left out. */
function written(lines: Array<Json>, session: string, plugin: string): Array<Json> {
  const methods = new Map<unknown, string>();
  return lines.flatMap((line): Array<Json> => {
    if (isJson(line.client)) {
      const { id, method } = line.client;
      if (typeof method === "string" && id !== undefined) {
        methods.set(id, method);
      }
      return [scrub(line, session, plugin)];
    }
    const message = isJson(line.server) ? line.server : {};
    if (typeof message.method === "string") {
      // A request of Codex's is always kept: the runtime answers it.
      const kept = "id" in message || KEPT.some((method) => method.test(String(message.method)));
      return kept ? [scrub({ server: notification(message) }, session, plugin)] : [];
    }
    const result = "result" in message ? { result: answer(methods.get(message.id), message.result) } : {};
    return [scrub({ server: { ...message, ...result } }, session, plugin)];
  });
}

/** `value` with the session's folder, the plugin's, and the home folder under their fixture names. */
function scrub<T>(value: T, session: string, plugin: string): T {
  const text = JSON.stringify(value)
    .replaceAll(session, "/session-dir")
    .replaceAll(plugin, "/plugin")
    .replaceAll(dirname(session), "/record-dir")
    .replaceAll(homedir(), "/home/me");
  return JSON.parse(text) as T;
}

// As the wrapper between the runtime and Codex: `record.ts --between <log> <codex's arguments>`.
if (process.argv[2] === "--between") {
  between(process.argv[3]!, process.argv.slice(4));
} else {
  await recordAll(process.argv.slice(2));
}
