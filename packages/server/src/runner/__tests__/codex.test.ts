import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import type { OpenOptions } from "../adapter.ts";
import {
  CodexAdapter,
  codexInstructions,
  codexModels,
  codexThreadParams,
  codexTurnParams,
} from "../codex.ts";
import type { AgentEvent } from "../events.ts";

const open: OpenOptions = { cwd: "/w", nativeId: "id", resume: false, skills: [] };
const turn = { images: [], text: "Hi", threadId: "t", writableRoots: ["/x/extensions"] };

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
const CONFIG = { config: { model: "gpt-6-luna", model_reasoning_effort: "high" } };

test("a thread's permissions", () => {
  const params = codexThreadParams({ ...open, model: "gpt-6-astra" }, codexInstructions());
  expect(params).toMatchObject({
    approvalPolicy: "on-request",
    approvalsReviewer: "auto_review",
    cwd: "/w",
    model: "gpt-6-astra",
    sandbox: "workspace-write",
  });
  expect(params.developerInstructions).toMatch(/escalated permissions/);
  expect(params).not.toHaveProperty("config");
  expect(JSON.stringify(params)).not.toMatch(/danger|"never"/i);
  const resumed = codexThreadParams({ ...open, resume: true }, "instructions");
  expect(resumed).toMatchObject({ excludeTurns: true, threadId: "id" });
  expect(resumed).not.toHaveProperty("model");
  const turnParams = codexTurnParams({ ...turn, effort: "high" });
  expect(turnParams.sandboxPolicy).toEqual({
    excludeSlashTmp: false,
    excludeTmpdirEnvVar: false,
    networkAccess: false,
    type: "workspaceWrite",
    writableRoots: ["/x/extensions"],
  });
  expect(turnParams.effort).toBe("high");
  expect(codexTurnParams(turn)).not.toHaveProperty("effort");
});

test("a message's images are local images", () => {
  expect(codexTurnParams({ ...turn, images: [{ path: "/i/a.png" }], text: "Look" }).input).toEqual([
    { text: "Look", text_elements: [], type: "text" },
    { path: "/i/a.png", type: "localImage" },
  ]);
  expect(codexTurnParams({ ...turn, images: [{ path: "/i/a.png" }], text: "" }).input).toEqual([
    { path: "/i/a.png", type: "localImage" },
  ]);
});

test("codexModels leaves hidden models out", () => {
  const rows = PAGES.flatMap((page) => page.data);
  expect(codexModels(rows, CONFIG)).toEqual({
    defaults: { effort: "high", model: "gpt-6-luna" },
    models: [
      {
        description: "The default.",
        efforts: [
          { id: "low", name: "Low" },
          { id: "ultra", name: "Ultra" },
        ],
        id: "gpt-6.1-sol",
        name: "GPT-6.1-Sol",
      },
      {
        description: "Fast.",
        efforts: [{ id: "xhigh", name: "Extra high" }],
        id: "gpt-6-luna",
        name: "GPT-6-Luna",
      },
    ],
  });
  // Nothing configured: the row marked default, and its default effort.
  expect(codexModels(rows, { config: { model: null } }).defaults).toEqual({
    effort: "medium",
    model: "gpt-6.1-sol",
  });
  expect(codexModels(undefined, undefined)).toEqual({ defaults: {}, models: [] });
});

test("a thread exists when its rollout is found", () => {
  const codexHome = temporaryFolder("uraeda-codex");
  const day = join(codexHome, "sessions", "2026", "11", "08");
  mkdirSync(day, { recursive: true });
  writeFileSync(join(day, "rollout-2026-11-08T10-00-00-01a1bba7-37d5.jsonl"), "");
  const adapter = new CodexAdapter({ codexHome, pluginDir: "/p" });
  expect(adapter.hasSession("01a1bba7-37d5")).toBe(true);
  expect(adapter.hasSession("37d5")).toBe(true);
  expect(adapter.hasSession("01a1bba7")).toBe(false);
  expect(
    new CodexAdapter({ codexHome: join(codexHome, "none"), pluginDir: "/p" }).hasSession("37d5"),
  ).toBe(false);
});

test("version is undefined without the command", async () => {
  const adapter = new CodexAdapter({ command: "/nonexistent/codex", pluginDir: "/p" });
  expect(await adapter.version()).toBeUndefined();
});

/**
 * A stand-in for `codex app-server`, which runs no agent: it answers the requests a session makes
 * as Codex 0.163.0 does, from `PAGES` and `CONFIG`. A turn whose text says `ask` sends the client
 * a question and completes once answered; one that says `wait` completes when steered; any other
 * completes at once. It writes what it read to `<dir>/stdin`.
 */
function appServer(dir: string): string {
  const agent = join(dir, "agent.cjs");
  writeFileSync(
    agent,
    `const { appendFileSync } = require("node:fs");
const pages = ${JSON.stringify(PAGES)};
const config = ${JSON.stringify(CONFIG)};
const out = (message) => process.stdout.write(JSON.stringify(message) + "\\n");
let turns = 0;
let threadId = "t-1";
let waiting;
const note = (name, params) => out({ method: name, params });
const complete = (id, status) => note("turn/completed", { threadId, turn: { id, status } });
require("node:readline").createInterface({ input: process.stdin }).on("line", (line) => {
  appendFileSync(${JSON.stringify(join(dir, "stdin"))}, line + "\\n");
  const message = JSON.parse(line);
  const ok = (result) => out({ id: message.id, result });
  const { params } = message;
  switch (message.method) {
    case undefined:
      if (message.id === "ask-1") complete(waiting, "completed");
      return;
    case "model/list": return ok(pages[params.cursor === "2" ? 1 : 0]);
    case "config/read": return ok(config);
    case "thread/start": ok({ thread: { id: "t-1" } }); return note("thread/started", { thread: { id: "t-1" } });
    case "thread/resume": threadId = params.threadId; return ok({ thread: { id: threadId } });
    case "turn/start": {
      const id = "turn-" + ++turns;
      ok({ turn: { id } });
      note("turn/started", { threadId, turn: { id } });
      const text = params.input[0].text;
      waiting = id;
      if (text.includes("ask")) return out({ id: "ask-1", method: "item/tool/requestUserInput", params: {} });
      if (!text.includes("wait")) complete(id, "completed");
      return;
    }
    case "turn/steer": ok({ turnId: params.expectedTurnId }); return complete(waiting, "completed");
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
const written = (dir: string) =>
  readFileSync(join(dir, "stdin"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((text) => JSON.parse(text) as Record<string, unknown>);

/** Reads `events` until one of `type`, and gives all read. */
async function until(events: AsyncIterator<AgentEvent>, type: AgentEvent["type"]) {
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

const message = (id: string, text: string, when: "steer" | "queue" = "queue") => ({
  id,
  images: [],
  text,
  when,
});

test("a server request gets an error", async () => {
  const dir = temporaryFolder("uraeda-codex");
  const agent = new CodexAdapter({ command: appServer(dir), pluginDir: "/p" }).open({
    ...open,
    cwd: dir,
  });
  const events = agent.events[Symbol.asyncIterator]();
  agent.send(message("m1", "ask me"));
  const read = await until(events, "result");
  expect(read).toContainEqual({ sessionId: "t-1", type: "init" });
  expect(read.filter((event) => event.type === "init")).toHaveLength(1);
  expect(read.at(-1)).toMatchObject({ ok: true, type: "result" });
  expect(written(dir).find((line) => line.id === "ask-1")).toEqual({
    error: { code: -32_601, message: "Uraeda does not answer item/tool/requestUserInput" },
    id: "ask-1",
  });
  agent.close();
  expect(await until(events, "exit")).toEqual([{ code: 0, stderr: "", type: "exit" }]);
});

test("a session's process: its skills, its thread, steered and taken-back messages", async () => {
  const dir = temporaryFolder("uraeda-codex");
  const agent = new CodexAdapter({ command: appServer(dir), pluginDir: "/p" }).open({
    ...open,
    cwd: dir,
    effort: "low",
    skills: ["/x/extensions/docs/skills"],
  });
  const events = agent.events[Symbol.asyncIterator]();
  agent.send(message("m1", "wait"));
  // No turn ID yet: it waits in the runtime's queue, where it can be taken back.
  agent.send(message("m2", "taken back", "steer"));
  agent.takeBack("m2");
  expect(await until(events, "cancelled")).toEqual([{ id: "m2", type: "cancelled" }]);
  expect(await until(events, "accepted")).toEqual([
    { sessionId: "t-1", type: "init" },
    { id: "m1", type: "accepted" },
  ]);
  agent.send(message("m3", "also this", "steer"));
  expect(await until(events, "result")).toMatchObject([
    { id: "m3", type: "accepted" },
    { ok: true, type: "result" },
  ]);
  agent.close();
  await until(events, "exit");

  const requests = written(dir).filter((line) => line.method !== undefined);
  expect(requests.map((line) => line.method)).toEqual([
    "initialize",
    "initialized",
    "skills/extraRoots/set",
    "model/list",
    "config/read",
    "model/list",
    "thread/start",
    "turn/start",
    "turn/steer",
  ]);
  expect(requests[2]!.params).toEqual({ extraRoots: ["/p/skills", "/x/extensions/docs/skills"] });
  expect(requests[7]!.params).toMatchObject({ effort: "low", threadId: "t-1" });
  expect(requests[8]!.params).toEqual({
    expectedTurnId: "turn-1",
    input: [{ text: "also this", text_elements: [], type: "text" }],
    threadId: "t-1",
  });
});

test("a resumed thread reports its ID, and a stopped turn ends interrupted", async () => {
  const dir = temporaryFolder("uraeda-codex");
  const agent = new CodexAdapter({ command: appServer(dir), pluginDir: "/p" }).open({
    ...open,
    cwd: dir,
    nativeId: "t-old",
    resume: true,
  });
  const events = agent.events[Symbol.asyncIterator]();
  agent.send(message("m1", "wait"));
  agent.interrupt();
  const read = await until(events, "result");
  expect(read[0]).toEqual({ sessionId: "t-old", type: "init" });
  expect(read.at(-1)).toMatchObject({ interrupted: true, ok: false, type: "result" });
  agent.close();
  await until(events, "exit");
  const resume = written(dir).find((line) => line.method === "thread/resume");
  expect(resume!.params).toMatchObject({ excludeTurns: true, threadId: "t-old" });
});

test("models() lists every page through a short process, which it closes", async () => {
  const dir = temporaryFolder("uraeda-codex");
  const adapter = new CodexAdapter({ command: appServer(dir), pluginDir: "/p" });
  expect(await adapter.models()).toEqual(
    codexModels(
      PAGES.flatMap((page) => page.data),
      CONFIG,
    ),
  );
  const missing = new CodexAdapter({ command: join(dir, "nothing"), pluginDir: "/p" });
  await expect(missing.models()).rejects.toThrow();
});
