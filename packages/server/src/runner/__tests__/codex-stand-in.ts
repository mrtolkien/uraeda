/** A stand-in for `codex app-server` and the helpers of the tests that run it. */
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vite-plus/test";
import type { AgentEvent } from "../events.ts";

/** Two pages of `model/list`, as Codex 0.163.0 gives them, a hidden model among them. */
export const PAGES = [
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
export const CONFIG = { config: { model: "gpt-6-luna", model_reasoning_effort: "high" } };

/** The permissions Codex 0.163.0 says it applied, in its `thread/start` and `thread/resume` answers. */
export const APPLIED = {
  approvalPolicy: "on-request",
  approvalsReviewer: "auto_review",
  sandbox: {
    excludeSlashTmp: false,
    excludeTmpdirEnvVar: false,
    networkAccess: false,
    type: "workspaceWrite",
    writableRoots: [],
  },
};

/**
 * How a stand-in differs from Codex: the permissions its thread's answers say it applied, whether
 * `debug models` fails, how long it takes, whether a turn completes before `turn/start` is
 * answered, a method it never answers, one it refuses, and whether it outlives SIGTERM and the end
 * of its stdin, writing its pid to `<dir>/pid`.
 */
export type StandIn = {
  applied?: Record<string, unknown>;
  catalogFails?: boolean;
  catalogMs?: number;
  completesFirst?: boolean;
  hang?: string;
  refuse?: string;
  stubborn?: boolean;
};

/**
 * A stand-in for `codex app-server`, which runs no agent: it answers the requests a session makes
 * as Codex 0.163.0 does, from `PAGES` and `CONFIG`. A turn whose text says `ask` sends the client
 * a question and completes once answered; one that says `wait` completes when steered, failed if
 * it says `fail on steer`, the steer then refused; any other completes at once. It writes what it
 * read to `<dir>/stdin`, and its arguments to `<dir>/argv`. Its thread's answers say it applied
 * the permissions Uraeda asks for, or what `options.applied` says. As `codex debug models`, it
 * writes its working directory to `<dir>/debug` and prints a one-model catalog.
 */
export function appServer(dir: string, options: StandIn = {}): string {
  const agent = join(dir, "agent.cjs");
  writeFileSync(
    agent,
    `const { appendFileSync } = require("node:fs");
const pages = ${JSON.stringify(PAGES)};
const config = ${JSON.stringify(CONFIG)};
const applied = ${JSON.stringify({ ...APPLIED, ...options.applied })};
if (process.argv[2] === "debug") {
  appendFileSync(${JSON.stringify(join(dir, "debug"))}, process.cwd() + "\\n");
  setTimeout(() => {
    if (${options.catalogFails === true}) {
      process.stderr.write("signed out");
      process.exit(1);
    }
    process.stdout.write(JSON.stringify({ models: [{ multi_agent_version: "v2", slug: "gpt-6-luna" }] }));
  }, ${options.catalogMs ?? 0});
  return;
}
appendFileSync(${JSON.stringify(join(dir, "argv"))}, JSON.stringify(process.argv.slice(2)) + "\\n");
if (${options.stubborn === true}) {
  require("node:fs").writeFileSync(${JSON.stringify(join(dir, "pid"))}, String(process.pid));
  process.on("SIGTERM", () => {});
  setInterval(() => {}, 1000);
}
const out = (message) => process.stdout.write(JSON.stringify(message) + "\\n");
let turns = 0;
let threadId = "t-1";
let waiting;
let waitingText;
const note = (name, params) => out({ method: name, params });
const complete = (id, status) => note("turn/completed", { threadId, turn: { id, status } });
require("node:readline").createInterface({ input: process.stdin }).on("line", (line) => {
  appendFileSync(${JSON.stringify(join(dir, "stdin"))}, line + "\\n");
  const message = JSON.parse(line);
  const ok = (result) => out({ id: message.id, result });
  const { params } = message;
  if (message.method === ${JSON.stringify(options.hang ?? null)}) return;
  if (message.method === ${JSON.stringify(options.refuse ?? null)}) return out({ error: { code: -1, message: "Refused" }, id: message.id });
  switch (message.method) {
    case undefined:
      if (message.id === "ask-1") complete(waiting, "completed");
      return;
    case "model/list": return ok(pages[params.cursor === "2" ? 1 : 0]);
    case "config/read": return ok(config);
    case "thread/start": ok({ ...applied, thread: { id: "t-1" } }); return note("thread/started", { thread: { id: "t-1" } });
    case "thread/resume":
      threadId = params.threadId;
      return ok({ ...applied, model: "gpt-6-luna", reasoningEffort: "xhigh", thread: { id: threadId } });
    case "turn/start": {
      const id = "turn-" + ++turns;
      if (${options.completesFirst === true}) {
        note("turn/started", { threadId, turn: { id } });
        complete(id, "completed");
        return ok({ turn: { id } });
      }
      ok({ turn: { id } });
      note("turn/started", { threadId, turn: { id } });
      const text = params.input[0].text;
      waiting = id;
      waitingText = text;
      if (text.includes("ask")) return out({ id: "ask-1", method: "item/tool/requestUserInput", params: {} });
      if (!text.includes("wait")) complete(id, "completed");
      return;
    }
    case "turn/steer":
      if (waitingText.includes("fail on steer")) {
        complete(waiting, "failed");
        return out({ error: { code: -1, message: "No turn runs" }, id: message.id });
      }
      ok({ turnId: params.expectedTurnId }); return complete(waiting, "completed");
    case "turn/interrupt": ok({}); return complete(waiting, "interrupted");
    default: return ok({});
  }
});
`,
  );
  const path = join(dir, "codex");
  writeFileSync(path, `#!/bin/sh\nexec "${process.execPath}" "${agent}" "$@"\n`);
  chmodSync(path, 0o755);
  return path;
}

/** The JSON lines the stand-in read on its stdin. */
export const written = (dir: string) =>
  readFileSync(join(dir, "stdin"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((text) => JSON.parse(text) as Record<string, unknown>);

/** Reads `events` until one of `type`, and gives all read. */
export async function until(events: AsyncIterator<AgentEvent>, type: AgentEvent["type"]) {
  const read: Array<AgentEvent> = [];
  for (;;) {
    const { done, value } = await events.next();
    if (done) {
      throw new Error(`no ${type} in ${JSON.stringify(read)}`);
    }
    read.push(value);
    if (value.type === type) {
      return read;
    }
  }
}

export const message = (id: string, text: string, when: "steer" | "queue" = "queue") => ({
  id,
  images: [],
  text,
  when,
});

/** Whether the process `pid` runs. */
export function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Resolves once the process is gone, or rejects after 10 seconds, killing it. */
export async function gone(pid: number): Promise<void> {
  try {
    await vi.waitFor(
      () => {
        if (alive(pid)) {
          throw new Error(`process ${pid} outlived its adapter's end`);
        }
      },
      { interval: 50, timeout: 10_000 },
    );
  } catch (error) {
    process.kill(pid, "SIGKILL");
    throw error;
  }
}

/** The pid a stubborn stand-in wrote to `<dir>/pid`, once it did. */
export function standInPid(dir: string): Promise<number> {
  const file = join(dir, "pid");
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
