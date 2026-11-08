import { mkdirSync, writeFileSync } from "node:fs";
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
import { APPLIED, appServer, CONFIG, message, PAGES, until, written } from "./codex-stand-in.ts";

const open: OpenOptions = { cwd: "/w", nativeId: "id", resume: false, skills: [] };
const turn = { images: [], text: "Hi", threadId: "t" };

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
  // The one override: the project's trust, which Codex would otherwise write (R24).
  expect(codexThreadParams(open, "instructions", "untrusted").config).toEqual({
    projects: { "/w": { trust_level: "untrusted" } },
  });
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
    writableRoots: [],
  });
  expect(turnParams.effort).toBe("high");
  expect(codexTurnParams(turn)).not.toHaveProperty("effort");
  // Uraeda runs what the extensions folder holds: writing there is reviewed first (R22).
  const sandbox = codexInstructions({ docs: "/x/docs", folder: "/x/extensions" }).split(
    "# Sandbox",
  )[1];
  expect(sandbox).toMatch(/in `\/x\/extensions`.*escalated permissions/s);
  expect(sandbox).not.toMatch(/you write in the working directory and in/);
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
  // Codex sends no settings update on resume: its answer says what the thread runs on.
  expect(read).toContainEqual({ effort: "Extra high", model: "GPT-6-Luna", type: "runsOn" });
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

test.each<[string, Record<string, unknown>, boolean, string]>([
  ["a wider sandbox", { sandbox: { type: "dangerFullAccess" } }, false, "danger-full-access"],
  [
    "the network on",
    { sandbox: { ...APPLIED.sandbox, networkAccess: true } },
    false,
    "the network on",
  ],
  ["approvals never asked, on resume", { approvalPolicy: "never" }, true, "approval policy never"],
  ["the human as reviewer", { approvalsReviewer: "user" }, false, "the reviewer user"],
])(
  "a thread Codex applied other permissions to does not run: %s",
  async (_, applied, resume, named) => {
    const dir = temporaryFolder("uraeda-codex");
    const agent = new CodexAdapter({ command: appServer(dir, { applied }), pluginDir: "/p" }).open({
      ...open,
      cwd: dir,
      resume,
    });
    const events = agent.events[Symbol.asyncIterator]();
    agent.send(message("m1", "Hi"));
    const [init] = await until(events, "init");
    expect(init).toMatchObject({ sessionId: "", type: "init" });
    expect(init).toHaveProperty("problem", expect.stringContaining(named));
    expect(init).toHaveProperty("problem", expect.stringContaining("Uraeda does not run it"));
    agent.close();
    await until(events, "exit");
    expect(written(dir).some((line) => line.method === "turn/start")).toBe(false);
  },
);
