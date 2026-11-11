// A stand-in for the `codex` command, which runs no agent: what the tests of Codex's runtime find
// first on their server's `PATH`, and what `node-events.ts` gives the Node runtime.
//
//   node stand-in.mjs <folder of its settings> <codex's arguments>
//
// As `codex app-server`, it writes what it was started with in the folder it runs in, a
// session's: `argv`, its arguments as JSON, `token`, its token for Uraeda's tools, `pid`, and
// `stdin`, each line it read. Then:
//
// - **With `exchange.jsonl` in that folder, it replays it**: a recorded exchange, as `record.ts`
//   writes them. It goes through the lines in order: it writes a `server` line, and waits at a
//   `client` line until it has read the runtime's message of that method, or that answer. An
//   answer is given the id the runtime gave its request, and `/session-dir` reads as the folder
//   it runs in. `URAEDA_STAND_IN_PACE_MS` waits that long before each line it writes.
// - **Without, it answers as Codex 0.163.0 does**, from `PAGES` and `CONFIG`, as the stand-in of
//   the Node server's tests did. A turn whose text says `ask` sends the client a question and
//   completes once answered; one that says `wait` completes when steered, failed if it says
//   `fail on steer`, the steer then refused; any other completes at once. A review runs as a turn
//   on its target's instructions.
//
// `options.json`, in the folder of its settings, changes the second: `applied`, the permissions
// its thread's answers say it applied; `catalogFails` and `catalogMs`, for `codex debug models`;
// `completesFirst`, a turn completed before `turn/start` is answered; `hang`, a method it never
// answers; `refuse`, one it refuses; `stubborn`, a process that outlives SIGTERM and the end of
// its stdin; `leaves`, a process that starts a `sleep` it leaves running, as a tool of the
// agent's would; `config`, the `config` of its `config/read` answer.
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

const [settings, ...args] = process.argv.slice(2);
const options = existsSync(join(settings, "options.json"))
  ? JSON.parse(readFileSync(join(settings, "options.json"), "utf8"))
  : {};

/** Two pages of `model/list`, as Codex 0.163.0 gives them, a hidden model among them. */
const PAGES = [
  {
    data: [
      {
        defaultReasoningEffort: "medium",
        description: "The default.",
        displayName: "GPT-6.1-Sol",
        hidden: false,
        id: "gpt-6.1-sol",
        isDefault: true,
        model: "gpt-6.1-sol",
        supportedReasoningEfforts: [
          { description: "", reasoningEffort: "low" },
          { description: "", reasoningEffort: "ultra" },
        ],
      },
      {
        defaultReasoningEffort: "medium",
        description: "",
        displayName: "GPT-Reserve",
        hidden: true,
        id: "gpt-reserve",
        isDefault: false,
        model: "gpt-reserve",
        supportedReasoningEfforts: [{ description: "", reasoningEffort: "low" }],
      },
    ],
    nextCursor: "2",
  },
  {
    data: [
      {
        defaultReasoningEffort: "low",
        description: "Fast.",
        displayName: "GPT-6-Luna",
        hidden: false,
        id: "gpt-6-luna",
        isDefault: false,
        model: "gpt-6-luna",
        supportedReasoningEfforts: [{ description: "", reasoningEffort: "xhigh" }],
      },
    ],
    nextCursor: null,
  },
];
const CONFIG = {
  config: options.config ?? { model: "gpt-6-luna", model_reasoning_effort: "high" },
};

/** The permissions Codex 0.163.0 says it applied, in its thread's answers. */
const APPLIED = {
  approvalPolicy: "on-request",
  approvalsReviewer: "auto_review",
  sandbox: {
    excludeSlashTmp: false,
    excludeTmpdirEnvVar: false,
    networkAccess: false,
    type: "workspaceWrite",
    writableRoots: [],
  },
  ...options.applied,
};

const out = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);

if (args[0] === "--version") {
  process.stdout.write("codex-cli 0.163.0\nmore\n");
} else if (args[0] === "debug") {
  appendFileSync(join(settings, "debug"), `${process.cwd()}\n`);
  setTimeout(() => {
    if (options.catalogFails === true) {
      process.stderr.write("signed out");
      process.exit(1);
    }
    const catalog = { models: [{ multi_agent_version: "v2", slug: "gpt-6-luna" }] };
    process.stdout.write(JSON.stringify(catalog));
  }, options.catalogMs ?? 0);
} else {
  appendFileSync("argv", `${JSON.stringify(args)}\n`);
  writeFileSync("token", process.env.URAEDA_MCP_TOKEN ?? "");
  writeFileSync("pid", String(process.pid));
  if (options.stubborn === true) {
    process.on("SIGTERM", () => {});
    setInterval(() => {}, 1000);
  }
  if (options.leaves === true) {
    // In the process's group, holding none of its output, and outliving it.
    spawn("sleep", ["600"], { stdio: "ignore" }).unref();
  }
  const read = existsSync("exchange.jsonl") ? replay() : answer();
  createInterface({ input: process.stdin }).on("line", (line) => {
    appendFileSync("stdin", `${line}\n`);
    read(JSON.parse(line));
  });
}

/** Replays `exchange.jsonl`: what reads each message of the runtime's. */
function replay() {
  const cwd = JSON.stringify(process.cwd()).slice(1, -1);
  const lines = readFileSync("exchange.jsonl", "utf8")
    .replaceAll("/session-dir", cwd)
    .split("\n")
    .filter(Boolean)
    .slice(1)
    .map((line) => JSON.parse(line));
  const pace = Number(process.env.URAEDA_STAND_IN_PACE_MS ?? 0);
  /** The runtime's messages no recorded line was matched with yet. */
  const unread = [];
  /** The id the runtime gave each request, by the id it has in the exchange. */
  const ids = new Map();
  let at = 0;
  let busy = false;
  const same = (recorded) => (got) =>
    recorded.method === undefined
      ? got.method === undefined && got.id === recorded.id
      : got.method === recorded.method;
  const play = async () => {
    if (busy) {
      return;
    }
    busy = true;
    for (; at < lines.length; at++) {
      const { client, server } = lines[at];
      if (server !== undefined) {
        if (pace > 0) {
          await new Promise((resolve) => setTimeout(resolve, pace));
        }
        const answers = server.method === undefined && ids.has(server.id);
        out(answers ? { ...server, id: ids.get(server.id) } : server);
        continue;
      }
      const index = unread.findIndex(same(client));
      if (index === -1) {
        break;
      }
      const [got] = unread.splice(index, 1);
      if (client.method !== undefined && client.id !== undefined) {
        ids.set(client.id, got.id);
      }
    }
    busy = false;
  };
  void play();
  return (message) => {
    unread.push(message);
    void play();
  };
}

/** Answers as Codex does: what reads each message of the runtime's. */
function answer() {
  let turns = 0;
  let threadId = "t-1";
  let waiting;
  let waitingText;
  const note = (name, params) => out({ method: name, params });
  const complete = (id, status) => note("turn/completed", { threadId, turn: { id, status } });
  return (message) => {
    const ok = (result) => out({ id: message.id, result });
    const { params } = message;
    if (message.method === (options.hang ?? null)) {
      return;
    }
    if (message.method === (options.refuse ?? null)) {
      out({ error: { code: -1, message: "Refused" }, id: message.id });
      return;
    }
    switch (message.method) {
      case undefined:
        if (message.id === "ask-1") {
          complete(waiting, "completed");
        }
        return;
      case "model/list":
        ok(PAGES[params.cursor === "2" ? 1 : 0]);
        return;
      case "config/read":
        ok(CONFIG);
        return;
      case "thread/start":
        ok({ ...APPLIED, thread: { id: "t-1" } });
        note("thread/started", { thread: { id: "t-1" } });
        return;
      case "thread/resume":
        threadId = params.threadId;
        ok({ ...APPLIED, model: "gpt-6-luna", reasoningEffort: "xhigh", thread: { id: threadId } });
        return;
      case "review/start":
      case "turn/start": {
        const id = `turn-${++turns}`;
        if (options.completesFirst === true) {
          note("turn/started", { threadId, turn: { id } });
          complete(id, "completed");
          ok({ turn: { id } });
          return;
        }
        ok({ turn: { id } });
        note("turn/started", { threadId, turn: { id } });
        const text = params.input ? (params.input[0]?.text ?? "") : params.target.instructions;
        waiting = id;
        waitingText = text;
        if (text.includes("ask")) {
          out({ id: "ask-1", method: "item/tool/requestUserInput", params: {} });
        } else if (!text.includes("wait")) {
          complete(id, "completed");
        }
        return;
      }
      case "turn/steer":
        if (waitingText.includes("fail on steer")) {
          complete(waiting, "failed");
          out({ error: { code: -1, message: "No turn runs" }, id: message.id });
          return;
        }
        ok({ turnId: params.expectedTurnId });
        complete(waiting, "completed");
        return;
      case "turn/interrupt":
        ok({});
        complete(waiting, "interrupted");
        return;
      default:
        ok({});
    }
  };
}
