import { expect, test } from "vite-plus/test";
import type { AgentEvent } from "../runner/events.ts";
import { byId, mutate, testServer } from "./helpers.ts";

/** Waits on an agent, at step `plan`. */
const FOLDER = "2026-10-12-cli-tuis";
/** Waits on the human, on its round 01. */
const WEB_UI = "2026-10-11-web-ui";

const RUN_FIELDS = [
  "id",
  "folder",
  "trigger",
  "step",
  "state",
  "reason",
  "costUsd",
  "startedAt",
  "endedAt",
  "newSession",
  "allowed",
  "pages",
  "denials",
];

type Server = Awaited<ReturnType<typeof testServer>>;

/** Answers every question of the web UI's round, as the round page would. */
async function answerRound({ app }: Server) {
  for (const question of ["Q1", "Q2", "Q3"]) {
    const result = await mutate(
      app,
      "answer.save",
      { folder: WEB_UI, question, letters: ["A"], comment: "", previous: "" },
      ["id"],
    );
    expect(result.ok).toBe(true);
  }
}

async function start(server: Server, input: Record<string, unknown> = {}) {
  const result = await mutate(
    server.app,
    "run.start",
    { folder: FOLDER, trigger: "manual", ...input },
    RUN_FIELDS,
  );
  expect(result.error).toBeUndefined();
  return result.data as Record<string, any>;
}

/** Waits for the run of this ID to end. */
const settle = (server: Server, id: string) => server.runner.settled(Number(id));

test("US4.1: run.start starts a run and returns it", async () => {
  const server = await testServer();

  const run = await start(server);

  expect(run).toMatchObject({
    state: "running",
    step: "plan",
    folder: FOLDER,
    trigger: "manual",
    reason: null,
    costUsd: null,
    endedAt: null,
    newSession: true,
    allowed: null,
    pages: 0,
    denials: [],
  });
  expect(typeof run.id).toBe("string");
  expect(server.adapter.starts).toHaveLength(1);
  server.runner.stop(Number(run.id));
  await settle(server, run.id);
});

test("US1.2 and SC-004: submitting answers alone starts nothing", async () => {
  const server = await testServer();
  await answerRound(server);

  const result = await mutate(server.app, "answers.submit", { folder: WEB_UI }, ["id"]);

  expect(result.ok).toBe(true);
  expect(server.adapter.starts).toHaveLength(0);
});

test("US1.1: submitting then run.start sends the round's sentence", async () => {
  const server = await testServer();
  await answerRound(server);
  expect((await mutate(server.app, "answers.submit", { folder: WEB_UI }, ["id"])).ok).toBe(true);
  server.adapter.script([]);

  const result = await mutate(
    server.app,
    "run.start",
    { folder: WEB_UI, trigger: "answers", file: "clarifications-01.md" },
    ["id", "trigger", "step"],
  );

  expect(result.data).toMatchObject({ trigger: "answers", step: "spec" });
  const [{ message }] = server.adapter.starts;
  expect(message).toContain("The human answered round 01 of the questions.");
  expect(message).toContain("Its next step is spec: follow skills/uraeda/references/spec.md.");
  await settle(server, result.data.id);
});

test("run.start passes the runner's refusal", async () => {
  const server = await testServer();

  const result = await mutate(server.app, "run.start", { folder: WEB_UI, trigger: "manual" }, [
    "id",
  ]);

  expect(result.error).toEqual({
    code: "BAD_REQUEST",
    message: "refused: Nothing for the agent: the feature waits on you.",
  });
});

const REFUSED = {
  code: "BAD_REQUEST",
  message: "refused: An agent is working on this feature. Stop it first, or wait for it.",
};

test("a commit on a feature with a running run is refused", async () => {
  const server = await testServer();
  const run = await start(server);

  const result = await mutate(
    server.app,
    "text.save",
    { path: `specs/${FOLDER}/proposal.md`, text: "# Proposal\n", hash: "" },
    ["id"],
  );

  expect(result.error).toEqual(REFUSED);
  server.runner.stop(Number(run.id));
  await settle(server, run.id);
});

const FILE = { folder: FOLDER, file: "spec.md" };

test.each([
  ["answer.save", { folder: FOLDER, question: "Q1", letters: ["A"], comment: "", previous: "" }],
  ["notes.save", { folder: FOLDER, notes: "Notes", previous: "" }],
  ["answers.submit", { folder: FOLDER }],
  ["commit.retry", { folder: FOLDER, file: "clarifications-01.md" }],
  ["review.comment", { ...FILE, startLine: 10, endLine: 10, text: "Why?" }],
  ["review.edit", { ...FILE, number: 1, text: "Why?" }],
  ["review.remove", { ...FILE, number: 1 }],
  ["review.startOver", FILE],
  ["review.approve", FILE],
  ["review.requestChanges", FILE],
  ["text.commit", { path: `specs/${FOLDER}/proposal.md` }],
])("%s is refused during a run", async (name, input) => {
  const server = await testServer();
  const run = await start(server);

  const result = await mutate(server.app, name, input, ["id"]);

  expect(result.error).toEqual(REFUSED);
  server.runner.stop(Number(run.id));
  await settle(server, run.id);
});

test("a bug's path is refused during its run", async () => {
  const server = await testServer();
  const run = await start(server);

  const result = await mutate(
    server.app,
    "text.commit",
    { path: `specs/bugs/${FOLDER}/report.md` },
    ["id"],
  );

  expect(result.error).toEqual(REFUSED);
  server.runner.stop(Number(run.id));
  await settle(server, run.id);
});

test("drafts, priorities, and other features stay writable during a run", async () => {
  const server = await testServer();
  const run = await start(server);
  const [priorities] = await byId(server.app, "Priorities", ["priorities"], ["id", "hash"]);
  const [draft] = await byId(server.app, "Draft", ["specs/drafts/git-listener.md"], ["hash"]);

  const added = await mutate(
    server.app,
    "priorities.add",
    { section: "next", text: "Show the agent's last commit", hash: priorities.hash },
    ["id"],
  );
  const saved = await mutate(
    server.app,
    "text.save",
    { path: "specs/drafts/git-listener.md", text: "# Git listener\n", hash: draft.hash },
    ["id"],
  );
  const answered = await mutate(
    server.app,
    "answer.save",
    { folder: WEB_UI, question: "Q1", letters: ["A"], comment: "", previous: "" },
    ["id"],
  );

  expect([added.ok, saved.ok, answered.ok]).toEqual([true, true, true]);
  server.runner.stop(Number(run.id));
  await settle(server, run.id);
});

test("US2.6 and review focus 3: runs are read back with their log pages", async () => {
  const server = await testServer();
  const texts: Array<AgentEvent> = Array.from({ length: 250 }, (_, n) => ({
    type: "text",
    text: `Line ${n}`,
  }));
  server.adapter.script([...texts, { type: "result", ok: true, errors: [], denials: [] }]);
  const run = await start(server);
  await settle(server, run.id);

  const [read] = await byId(server.app, "Run", [run.id], RUN_FIELDS);
  const pages = await byId(
    server.app,
    "RunLog",
    [`${run.id}:0`, `${run.id}:1`, `${run.id}:2`],
    ["id", "run", "page", "events"],
  );

  expect(read).toMatchObject({ state: "done", pages: 3 });
  expect(read.endedAt).toEqual(expect.any(String));
  expect(pages.map((page) => [page.id, page.run, page.page, page.events.length])).toEqual([
    [`${run.id}:0`, run.id, 0, 100],
    [`${run.id}:1`, run.id, 1, 100],
    [`${run.id}:2`, run.id, 2, 50],
  ]);
  const last = pages[2].events as Array<{ seq: number; kind: string; text: string }>;
  expect(last.map((event) => event.seq)).toEqual(Array.from({ length: 50 }, (_, n) => 200 + n));
  expect(last[49]).toEqual({ seq: 249, kind: "text", text: "Line 249" });
});

test("run.stop stops the run", async () => {
  const server = await testServer();
  const run = await start(server);

  const result = await mutate(server.app, "run.stop", { run: run.id }, ["id", "state"]);
  await settle(server, run.id);

  expect(result.data.id).toBe(run.id);
  expect(server.adapter.interrupts).toBe(1);
  const [read] = await byId(server.app, "Run", [run.id], ["id", "state", "reason"]);
  expect(read).toEqual({ id: run.id, state: "stopped", reason: null });
});

test("run.stop on an unknown run is refused", async () => {
  const server = await testServer();

  const result = await mutate(server.app, "run.stop", { run: "42" }, ["id"]);

  expect(result.error).toEqual({ code: "BAD_REQUEST", message: "refused: no run 42" });
});

test("US6.1: run.allow starts a run with the denial's rule", async () => {
  const server = await testServer();
  server.adapter.script([
    {
      type: "result",
      ok: true,
      costUsd: 1.25,
      errors: [],
      denials: [{ tool: "Bash", input: { command: "gh pr create --draft" } }],
    },
  ]);
  const first = await start(server);
  await settle(server, first.id);
  const [read] = await byId(server.app, "Run", [first.id], ["id", "denials", "costUsd"]);
  expect(read.costUsd).toBe(1.25);
  expect(read.denials).toEqual([
    { seq: 0, tool: "Bash", target: "gh pr create --draft", rule: "Bash(gh pr create --draft)" },
  ]);

  const result = await mutate(server.app, "run.allow", { run: first.id, seq: 0 }, RUN_FIELDS);

  expect(result.data).toMatchObject({
    trigger: "allow",
    allowed: "Bash(gh pr create --draft)",
    state: "running",
    newSession: false,
  });
  expect(server.adapter.starts[1].allowed).toBe("Bash(gh pr create --draft)");
  server.runner.stop(Number(result.data.id));
  await settle(server, result.data.id);
});

test("the workspace lists running folders, and the feature its runs", async () => {
  const server = await testServer();
  server.adapter.script([]);
  const first = await start(server);
  await settle(server, first.id);
  const second = await start(server);

  const [workspace] = await byId(server.app, "Workspace", ["workspace"], ["id", "running"]);
  const [feature] = await byId(server.app, "Feature", [FOLDER], ["id", "runs"]);
  const [other] = await byId(server.app, "Feature", [WEB_UI], ["id", "runs"]);

  expect(workspace.running).toEqual([FOLDER]);
  expect(feature.runs).toEqual([second.id, first.id]);
  expect(other.runs).toEqual([]);
  server.runner.stop(Number(second.id));
  await settle(server, second.id);
  const [after] = await byId(server.app, "Workspace", ["workspace"], ["id", "running"]);
  expect(after.running).toEqual([]);
});

test("Runner reads available with claude, and its version", async () => {
  const server = await testServer();

  const [runner] = await byId(server.app, "Runner", ["runner"], ["id", "available", "version"]);

  expect(runner).toEqual({ id: "runner", available: true, version: "2.1.296 (Claude Code)" });
});

test("Runner reads unavailable without claude", async () => {
  const server = await testServer(undefined, { installed: false });

  const [runner] = await byId(server.app, "Runner", ["runner"], ["id", "available", "version"]);
  const result = await mutate(server.app, "run.start", { folder: FOLDER, trigger: "manual" }, [
    "id",
  ]);

  expect(runner).toEqual({ id: "runner", available: false, version: null });
  expect(result.error?.message).toBe("refused: Claude Code is not available on this machine.");
});
