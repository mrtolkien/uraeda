import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vite-plus/test";
import * as binding from "uraeda-binding";
import { fixtureRepo, git } from "uraeda-binding/test-utils";
import type { AgentEvent, Trigger } from "../events.ts";
import { flush, settle, testRunner } from "./helpers.ts";

/** Waits on an agent, at step `plan`. */
const FOLDER = "2026-10-12-cli-tuis";

/** A second feature waiting on an agent, made from the first on its own branch. */
const OTHER = "2026-10-14-other";

function withSecondFeature() {
  const repo = fixtureRepo();
  git(repo, "switch", "--quiet", "--create", OTHER, FOLDER);
  git(repo, "mv", `specs/${FOLDER}`, `specs/${OTHER}`);
  git(repo, "commit", "--quiet", "--no-verify", "--message", "work on the other");
  git(repo, "switch", "--quiet", "main");
  return repo;
}

const ok: AgentEvent = { type: "result", ok: true, costUsd: 0.5, errors: [], denials: [] };

afterEach(() => {
  vi.useRealTimers();
});

test("US3.1: a first run starts a new session in the feature's worktree", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  adapter.script([ok]);

  const id = await runner.start(repo, FOLDER, { trigger: "manual" });
  await settle(runner, id);

  const [start] = adapter.starts;
  expect(start.resume).toBe(false);
  expect(start.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  expect(start.cwd).toBe(join(repo, ".worktrees", FOLDER));
  expect(start.message).toContain(
    "Its next step is plan: follow skills/uraeda/references/plan.md.",
  );
  expect(start.allowed).toBeUndefined();
  expect(cache.session(repo, FOLDER)).toBe(start.sessionId);
  expect(cache.run(id)).toMatchObject({
    repo,
    folder: FOLDER,
    state: "done",
    reason: null,
    costUsd: 0.5,
    newSession: true,
    trigger: "manual",
    step: "plan",
  });
  expect(cache.events(id, 0, 100)).toEqual([]);
});

test("US3.2: a later run resumes the session", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  adapter.script([ok]);
  adapter.script([ok]);

  await settle(runner, await runner.start(repo, FOLDER, { trigger: "manual" }));
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });
  await settle(runner, id);

  const [first, second] = adapter.starts;
  expect(second.resume).toBe(true);
  expect(second.sessionId).toBe(first.sessionId);
  expect(cache.run(id)?.newSession).toBe(false);
});

test("US3.3: a session without a transcript is replaced", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  adapter.script([ok]);
  adapter.script([ok]);
  await settle(runner, await runner.start(repo, FOLDER, { trigger: "manual" }));
  adapter.sessions.clear();

  const id = await runner.start(repo, FOLDER, { trigger: "manual" });
  await settle(runner, id);

  const [first, second] = adapter.starts;
  expect(second.resume).toBe(false);
  expect(second.sessionId).not.toBe(first.sessionId);
  expect(cache.session(repo, FOLDER)).toBe(second.sessionId);
  expect(cache.run(id)?.newSession).toBe(true);
  expect(cache.events(id, 0, 1)).toEqual([
    { seq: 0, kind: "system", text: "Started a new session: the previous one is gone." },
  ]);
});

test("US3.4 and review focus 2: a second run on the same feature is refused", async () => {
  const { runner, adapter, repo } = await testRunner();

  const [first, second] = await Promise.allSettled([
    runner.start(repo, FOLDER, { trigger: "answers", file: "clarifications-01.md" }),
    runner.start(repo, FOLDER, { trigger: "answers", file: "clarifications-01.md" }),
  ]);
  await expect(runner.start(repo, FOLDER, { trigger: "manual" })).rejects.toThrow(
    "refused: An agent is already working on this feature.",
  );

  expect(first.status).toBe("fulfilled");
  expect(second).toEqual({
    status: "rejected",
    reason: new Error("refused: An agent is already working on this feature."),
  });
  expect(adapter.starts).toHaveLength(1);
  expect(runner.running(repo)).toEqual([FOLDER]);
});

test("two features run at once", async () => {
  const { runner, adapter, repo } = await testRunner(withSecondFeature());

  await runner.start(repo, FOLDER, { trigger: "manual" });
  await runner.start(repo, OTHER, { trigger: "manual" });

  expect(runner.running(repo).sort()).toEqual([FOLDER, OTHER]);
  expect(adapter.starts.map((start) => start.cwd)).toEqual([
    join(repo, ".worktrees", FOLDER),
    join(repo, ".worktrees", OTHER),
  ]);
  expect(adapter.starts[0].sessionId).not.toBe(adapter.starts[1].sessionId);
  await runner.stopAll();
});

test("a feature waiting on the human is refused", async () => {
  const { runner, adapter, repo } = await testRunner();

  await expect(runner.start(repo, "2026-10-11-web-ui", { trigger: "manual" })).rejects.toThrow(
    "refused: Nothing for the agent: the feature waits on you.",
  );
  expect(adapter.starts).toHaveLength(0);
  expect(runner.running(repo)).toEqual([]);
  // The refusal frees the feature.
  await expect(runner.start(repo, "2026-10-11-web-ui", { trigger: "manual" })).rejects.toThrow(
    "refused: Nothing for the agent",
  );
});

test("an unavailable claude is refused", async () => {
  const { runner, adapter, repo, changes } = await testRunner();
  expect(runner.status()).toEqual({ available: true, version: "0.0.0 (fake agent)" });
  adapter.installed = false;

  await runner.check();

  expect(runner.status()).toEqual({ available: false, version: null });
  expect(changes).toEqual([{ runner: true }, { runner: true }]);
  await expect(runner.start(repo, FOLDER, { trigger: "manual" })).rejects.toThrow(
    "refused: Claude Code is not available on this machine.",
  );
  expect(adapter.starts).toHaveLength(0);
});

test("a check that finds no change publishes nothing", async () => {
  const { runner, changes } = await testRunner();

  await runner.check();

  expect(changes).toEqual([{ runner: true }]);
});

test("US2.3: Stop interrupts, and the run is stopped once it exits", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });

  runner.stop(id);
  await settle(runner, id);

  expect(adapter.interrupts).toBe(1);
  expect(adapter.terminates).toBe(0);
  expect(cache.run(id)).toMatchObject({ state: "stopped", reason: null });
  expect(runner.running(repo)).toEqual([]);
});

test("US2.4: SIGTERM follows 10 seconds after an ignored interrupt", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  vi.useFakeTimers();
  adapter.ignoreInterrupt = true;
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });

  runner.stop(id);
  await vi.advanceTimersByTimeAsync(9_999);
  expect(adapter.terminates).toBe(0);
  await vi.advanceTimersByTimeAsync(1);
  expect(adapter.terminates).toBe(1);
  await settle(runner, id);

  expect(adapter.interrupts).toBe(1);
  expect(cache.run(id)?.state).toBe("stopped");
});

test("SC-003: the run after a stop resumes the same session", async () => {
  const { runner, adapter, repo } = await testRunner();
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });
  runner.stop(id);
  await settle(runner, id);
  adapter.script([ok]);

  await settle(runner, await runner.start(repo, FOLDER, { trigger: "manual" }));

  expect(adapter.starts[1]).toMatchObject({ resume: true, sessionId: adapter.starts[0].sessionId });
});

test("review focus 4: Stop on an ended run changes nothing", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  adapter.script([ok]);
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });
  await settle(runner, id);

  runner.stop(id);
  runner.stop(id + 100);

  expect(adapter.interrupts).toBe(0);
  expect(cache.run(id)?.state).toBe("done");
});

test("the watchdog stops a silent run after 30 minutes", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  vi.useFakeTimers();
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });

  await vi.advanceTimersByTimeAsync(20 * 60_000);
  adapter.emit({ type: "text", text: "Still here" });
  await vi.advanceTimersByTimeAsync(29 * 60_000);
  expect(adapter.interrupts).toBe(0);
  await vi.advanceTimersByTimeAsync(60_000);
  await settle(runner, id);

  expect(adapter.interrupts).toBe(1);
  expect(cache.run(id)).toMatchObject({ state: "failed", reason: "No activity for 30 minutes." });
});

test("a plugin that does not load fails the run", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });

  adapter.emit({ type: "init", sessionId: "s", plugins: [], pluginErrors: ["missing path"] });
  await settle(runner, id);

  expect(adapter.interrupts).toBe(1);
  expect(cache.run(id)).toMatchObject({
    state: "failed",
    reason: "The Uraeda skill did not load: missing path",
  });
});

test("a loaded plugin lets the run go on", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  adapter.script([
    { type: "init", sessionId: "s", plugins: ["uraeda"], pluginErrors: [] },
    { type: "result", ok: true, errors: [], denials: [] },
  ]);
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });
  await settle(runner, id);

  expect(adapter.interrupts).toBe(0);
  expect(cache.run(id)).toMatchObject({ state: "done", costUsd: null });
});

test("a failed result keeps its errors", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  adapter.script([
    { type: "result", ok: false, costUsd: 0.4, errors: ["Rate limit reached"], denials: [] },
    { type: "exit", code: 1, stderr: "" },
  ]);
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });
  await settle(runner, id);

  expect(cache.run(id)).toMatchObject({
    state: "failed",
    reason: "Rate limit reached",
    costUsd: 0.4,
  });
});

test("review focus 5: a missing binary fails the run", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  adapter.script([{ type: "exit", code: null, stderr: "", missing: true }]);
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });
  await settle(runner, id);

  expect(cache.run(id)).toMatchObject({
    state: "failed",
    reason: "Claude Code is not available on this machine.",
  });
});

test("an exit without a result keeps the last 20 lines of stderr", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  const lines = Array.from({ length: 25 }, (_, n) => `line ${n + 1}`);
  adapter.script([{ type: "exit", code: 1, stderr: `${lines.join("\n")}\n` }]);
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });
  await settle(runner, id);

  expect(cache.run(id)).toMatchObject({ state: "failed", reason: lines.slice(5).join("\n") });
});

test("an exit without a result or stderr names its code", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  adapter.script([{ type: "exit", code: 2, stderr: "" }]);
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });
  await settle(runner, id);

  expect(cache.run(id)).toMatchObject({
    state: "failed",
    reason: "Claude Code exited with code 2.",
  });
});

test("events become the log", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  vi.useFakeTimers();
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });

  adapter.emit({ type: "text", text: "Reading the answers" });
  adapter.emit({
    type: "toolStart",
    id: "toolu_1",
    name: "Bash",
    input: { command: "vp run ready" },
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(cache.events(id, 0, 100)).toEqual([
    { seq: 0, kind: "text", text: "Reading the answers" },
    {
      seq: 1,
      kind: "tool",
      id: "toolu_1",
      name: "Bash",
      target: "vp run ready",
      status: "running",
    },
  ]);
  await vi.advanceTimersByTimeAsync(2_500);
  adapter.emit({ type: "toolEnd", id: "toolu_1", isError: false, output: "ok" });
  adapter.emit({ type: "toolStart", id: "toolu_2", name: "Read", input: { file_path: "/w/a" } });
  adapter.emit({ type: "toolEnd", id: "toolu_2", isError: true, output: "no such file" });
  adapter.emit(ok);
  adapter.finish();
  await vi.advanceTimersByTimeAsync(0);
  await settle(runner, id);

  expect(cache.events(id, 0, 100)).toEqual([
    { seq: 0, kind: "text", text: "Reading the answers" },
    {
      seq: 1,
      kind: "tool",
      id: "toolu_1",
      name: "Bash",
      target: "vp run ready",
      status: "complete",
      durationMs: 2500,
      output: "ok",
    },
    {
      seq: 2,
      kind: "tool",
      id: "toolu_2",
      name: "Read",
      target: "/w/a",
      status: "error",
      durationMs: 0,
      output: "no such file",
    },
  ]);
});

test("tool output is cut to 4,000 characters", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  adapter.script([
    { type: "toolStart", id: "toolu_1", name: "Bash", input: { command: "cat big" } },
    { type: "toolEnd", id: "toolu_1", isError: false, output: "é".repeat(4_001) },
    ok,
  ]);
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });
  await settle(runner, id);

  const [tool] = cache.events(id, 0, 1);
  expect(tool.kind === "tool" && tool.output).toBe("é".repeat(4_000));
});

test("skipped lines are counted in one system line", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  adapter.script([
    { type: "skipped" },
    { type: "text", text: "Hello" },
    { type: "skipped" },
    { type: "skipped" },
    ok,
  ]);
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });
  await settle(runner, id);

  expect(cache.events(id, 0, 100)).toEqual([
    {
      seq: 0,
      kind: "system",
      text: "Skipped 3 lines Claude Code printed that the runner does not read.",
    },
    { seq: 1, kind: "text", text: "Hello" },
  ]);
});

test("an API retry is a system line", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  adapter.script([{ type: "retry", attempt: 1, delayMs: 30_000, error: "rate_limit" }, ok]);
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });
  await settle(runner, id);

  expect(cache.events(id, 0, 100)).toEqual([
    { seq: 0, kind: "system", text: "Rate limited, retrying in 30 s." },
  ]);
});

test("US6.1 and US6.4: denials are logged, and allow runs once with their rule", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  adapter.script([
    {
      type: "result",
      ok: true,
      costUsd: 0.4,
      errors: [],
      denials: [{ tool: "Bash", input: { command: "gh pr create --draft" } }],
    },
  ]);
  adapter.script([ok]);
  adapter.script([ok]);
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });
  await settle(runner, id);

  const [denial] = cache.events(id, 0, 100);
  expect(denial).toEqual({
    seq: 0,
    kind: "denial",
    tool: "Bash",
    target: "gh pr create --draft",
    rule: "Bash(gh pr create --draft)",
  });

  const allowed = await runner.allow(repo, id, denial.seq);
  await settle(runner, allowed);
  await settle(runner, await runner.start(repo, FOLDER, { trigger: "manual" }));

  expect(adapter.starts[1].allowed).toBe("Bash(gh pr create --draft)");
  expect(adapter.starts[1].message).toContain(
    "The human allowed `Bash(gh pr create --draft)`: run it again, then continue.",
  );
  expect(adapter.starts[1].resume).toBe(true);
  expect(cache.run(allowed)).toMatchObject({
    trigger: "allow",
    allowed: "Bash(gh pr create --draft)",
  });
  expect(adapter.starts[2].allowed).toBeUndefined();
});

test("allow on an event that is not a denial is refused", async () => {
  const { runner, adapter, repo } = await testRunner();
  adapter.script([{ type: "text", text: "Hello" }, ok]);
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });
  await settle(runner, id);

  await expect(runner.allow(repo, id, 0)).rejects.toThrow(
    `refused: no blocked action 0 in run ${id}`,
  );
  expect(adapter.starts).toHaveLength(1);
});

test("US1.4: a run that commits up to a gate ends done", async () => {
  const { runner, adapter, cache, repo } = await testRunner();
  adapter.script([
    (cwd) => {
      writeFileSync(
        join(cwd, "specs", FOLDER, "plan.md"),
        "---\nstatus: awaiting-human\nspec-revision: 1\n---\n\n# Plan: CLI TUIs\n",
      );
      git(cwd, "add", "--all");
      git(cwd, "commit", "--quiet", "--no-verify", "--message", "plan(cli-tuis): plan");
    },
    ok,
  ]);
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });
  await settle(runner, id);

  expect(cache.run(id)?.state).toBe("done");
  expect((await binding.nextStep(repo, FOLDER)).step.waitsOn).toBe("human");
  expect(git(repo, "branch", "--show-current").trim()).toBe("main");
});

test("stopAll stops every run with the server's reason", async () => {
  const { runner, adapter, cache, repo } = await testRunner(withSecondFeature());
  const first = await runner.start(repo, FOLDER, { trigger: "manual" });
  const second = await runner.start(repo, OTHER, { trigger: "manual" });

  await runner.stopAll();

  expect(adapter.interrupts).toBe(2);
  for (const id of [first, second]) {
    expect(cache.run(id)).toMatchObject({
      state: "stopped",
      reason: "Stopped: the server stopped.",
    });
  }
  expect(runner.running(repo)).toEqual([]);
});

test("close clears the runner's timers", async () => {
  const { runner, repo } = await testRunner();
  vi.useFakeTimers();
  await runner.start(repo, FOLDER, { trigger: "manual" });

  runner.close();

  expect(vi.getTimerCount()).toBe(0);
});

test("the runner publishes each change", async () => {
  const { runner, adapter, repo, changes } = await testRunner();
  adapter.script([{ type: "text", text: "Hello" }, ok]);

  const id = await runner.start(repo, FOLDER, { trigger: "manual" });
  await settle(runner, id);
  await flush();

  expect(changes).toEqual([
    { runner: true },
    { repo, folder: FOLDER, run: id, state: "running" },
    { repo, folder: FOLDER, run: id, state: "running" },
    { repo, folder: FOLDER, run: id, state: "running" },
    { repo, folder: FOLDER, run: id, state: "done" },
  ]);
});

test.each<[Trigger, string | undefined]>([
  ["answers", "clarifications-01.md"],
  ["approval", "spec.md"],
  ["changes", "spec.md"],
  ["proposal", "proposal.md"],
  ["start", undefined],
  ["manual", undefined],
])("SC-006: a run on trigger %s passes the plugin", async (trigger, file) => {
  const { runner, adapter, repo } = await testRunner();
  adapter.script([ok]);

  await settle(runner, await runner.start(repo, FOLDER, { trigger, file }));

  expect(adapter.starts[0].pluginDir).toBe("/plugin");
});
