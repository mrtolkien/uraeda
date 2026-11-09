// Implementers run as Uraeda's sessions (US3 of the run options): a workflow session's `run_agent`
// starts each task in a sub-session of the feature, in the task's worktree, on the implementers'
// pick, and answers with its last message. Sub-sessions work at once, never become their feature's
// latest session, stop with their parent, and continue before it after a restart.
import { mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, expect, test, vi } from "vite-plus/test";
import type { RunOptions } from "uraeda-binding";
import { git } from "uraeda-binding/test-utils";
import type { McpTool } from "../../mcp/endpoint.ts";
import { McpTokens } from "../../mcp/tokens.ts";
import type { SessionCache } from "../cache.ts";
import { CONTINUES_ON, type ContinueSettings } from "../continuer.ts";
import { FakeAdapter, type FakeStep } from "../fake.ts";
import { Runtimes } from "../runtimes.ts";
import { SERVER_STOPPED, type Sessions } from "../sessions.ts";
import { WATCHDOG_MS } from "../session-state.ts";
import { runAgentTool } from "../sub-sessions.ts";
import { flush, limitTurn, restart, testSessions } from "./helpers.ts";

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";

/** The server's address the test gives its sessions. */
const SERVER = "http://127.0.0.1:4000";

afterEach(() => {
  vi.useRealTimers();
});

/** Lets the session manager work until `done` holds. */
async function until(done: () => boolean) {
  await vi.waitFor(() => expect(done()).toBe(true), { interval: 5, timeout: 5000 });
}

/**
 * A step that holds the turn until the test opens its gate, kept by name, or fails it: the step
 * throws, which ends the process, as a crash.
 */
function gates() {
  const all = new Map<string, PromiseWithResolvers<void>>();
  const of = (name: string) => {
    const gate = all.get(name) ?? Promise.withResolvers<void>();
    all.set(name, gate);
    return gate;
  };
  const hold =
    (name: string): FakeStep =>
    () =>
      of(name).promise;
  return {
    fail: (name: string) => of(name).reject(new Error("crashed")),
    hold,
    open: (name: string) => of(name).resolve(),
  };
}

/** The session's latest turn. */
const latest = (cache: SessionCache, session: string) => cache.turns(session).at(-1);

/**
 * A feature's workflow session on `fake`, the build's agent, its turn held, with the implementers
 * on `other` at Low, and three task worktrees. Each implementer holds its turn until the test opens
 * its task's gate, then answers "Done: <its prompt>". `runs` turns its automatic continues on; a
 * runtime named in `off` is off.
 */
async function building({ runs }: { runs?: () => ContinueSettings } = {}) {
  const fake = new FakeAdapter();
  const other = new FakeAdapter();
  // The runtimes the test turned off.
  const off = new Set<string>();
  const runtimes = new Runtimes({ isOn: (name) => !off.has(name) });
  runtimes.register("fake", fake);
  runtimes.register("other", other);
  await runtimes.refreshModels();
  const options: RunOptions = {
    implementers: { agent: "other", effort: "low", model: "fake-big" },
    steps: [],
  };
  const mcp = { address: { url: SERVER }, tokens: new McpTokens() };
  const setup = await testSessions(undefined, {
    mcp,
    runOptions: () => options,
    runtimes,
    ...(runs === undefined ? {} : { runs }),
  });
  const { repo, sessions } = setup;
  const root = await sessions.mainRoot(repo);
  const worktrees = Object.fromEntries(
    [4, 5, 6].map((task) => {
      const path = join(root, ".worktrees", `task-${task}`);
      git(root, "worktree", "add", "--quiet", "-b", `task-${task}`, path);
      return [task, path];
    }),
  ) as Record<number, string>;
  const gate = gates();
  other.fallback = (message) => [
    gate.hold(message.text),
    { text: `Done: ${message.text}`, type: "text" },
  ];
  const parent = await sessions.featureSession(repo, AGENT, { runtime: "fake" });
  fake.script([gate.hold("parent")]);
  const workflow = { step: "plan", trigger: "manual" } as const;
  await sessions.send(repo, parent.id, { text: "Build the wave", workflow });
  const tool = runAgentTool(sessions.subSessions);
  const signal = new AbortController().signal;
  const call = (task: number, on: McpTool = tool) =>
    on.call(
      parent.id,
      { prompt: `Implement task ${task}`, task: `Task ${task}`, worktree: worktrees[task] },
      signal,
    );
  return { ...setup, call, fake, gate, off, other, parent, root, signal, tool, worktrees };
}

/** Whether every sub-session of the parent runs a turn now, `count` of them. */
function allRunning(sessions: Sessions, cache: SessionCache, parent: string, count: number) {
  const subs = sessions.subSessions.ofParent(parent);
  return subs.length === count && subs.every((sub) => latest(cache, sub.id)?.state === "running");
}

test("run_agent runs each task in its own sub-session at once, on the role's pick", async () => {
  const { cache, call, fake, gate, other, parent, repo, root, sessions, signal, tool, worktrees } =
    await building();

  const calls = [4, 5, 6].map((task) => call(task));
  await until(() => allRunning(sessions, cache, parent.id, 3));
  // The same task again, while it works: it waits for the first one's answer, whatever worktree
  // it names.
  const again = tool.call(
    parent.id,
    { prompt: "Implement task 4", task: "Task 4", worktree: "/tmp" },
    signal,
  );

  const subs = sessions.subSessions.ofParent(parent.id);
  expect(subs.map((sub) => sub.worktree).toSorted()).toEqual(Object.values(worktrees));
  for (const sub of subs) {
    expect(sub).toMatchObject({
      agent: "other",
      effort: "low",
      folder: AGENT,
      model: "fake-big",
      parent: parent.id,
      role: "implementer",
    });
    expect(latest(cache, sub.id)).toMatchObject({ kind: "workflow", step: "plan" });
  }
  expect(subs.map((sub) => sub.title).toSorted()).toEqual(["Task 4", "Task 5", "Task 6"]);
  // A sub-session keeps its task's name: a repeated call finds it by it.
  expect(() => sessions.rename(repo, subs[0].id, "Another task")).toThrow(/task/);
  expect(cache.session(subs[0].id)?.title).toBe(subs[0].title);
  expect(other.opens.map((open) => open.cwd).toSorted()).toEqual(Object.values(worktrees));
  expect(other.opens.every((open) => open.tools === "none")).toBe(true);
  expect(fake.opens[0].tools).toEqual({ token: expect.any(String), url: `${SERVER}/mcp` });
  expect(cache.latestSession(root, AGENT)?.id).toBe(parent.id);
  expect(cache.folderSessions(root, AGENT).map((row) => row.id)).toEqual([parent.id]);

  for (const task of [4, 5, 6]) {
    gate.open(`Implement task ${task}`);
  }
  expect(await Promise.all(calls)).toEqual([
    "Done: Implement task 4",
    "Done: Implement task 5",
    "Done: Implement task 6",
  ]);
  expect(await again).toBe("Done: Implement task 4");
  // Once it answered, the same task answers again, and starts nothing.
  expect(await call(4)).toBe("Done: Implement task 4");
  expect(sessions.subSessions.ofParent(parent.id)).toHaveLength(3);
  expect(other.opens).toHaveLength(3);
  expect(cache.latestSession(root, AGENT)?.id).toBe(parent.id);
});

/** What a refused worktree is made of: the main checkout, the feature's, and the tasks'. */
type Places = { feature: string; root: string; worktrees: Record<number, string> };

test.each([
  { name: "a folder no worktree of the repository", worktree: () => "/tmp" },
  { name: "the main checkout", worktree: ({ root }: Places) => root },
  { name: "a folder that is not there", worktree: ({ root }: Places) => join(root, "gone") },
  { name: "the feature's own worktree", worktree: ({ feature }: Places) => feature },
  {
    name: "a folder in a task's worktree",
    worktree: ({ worktrees }: Places) => join(worktrees[4], "src"),
  },
  {
    name: "a task's worktree by a relative path",
    worktree: ({ worktrees }: Places) => relative(process.cwd(), worktrees[4]),
  },
])("run_agent refuses $name as the task's worktree", async ({ worktree }) => {
  const { fake, other, parent, root, sessions, signal, tool, worktrees } = await building();
  mkdirSync(join(worktrees[4], "src"));
  const feature = fake.opens[0].cwd;
  expect(feature).not.toBe(root);

  const given = worktree({ feature, root, worktrees });
  const input = { prompt: "Implement task 4", task: "Task 4", worktree: given };
  await expect(tool.call(parent.id, input, signal)).rejects.toThrow(/worktree/);
  expect(other.opens).toHaveLength(0);
  expect(sessions.subSessions.ofParent(parent.id)).toHaveLength(0);
});

test("a sub-session's continue after its limit starts while its parent works", async () => {
  const { cache, call, gate, other, parent, sessions } = await building({
    runs: () => CONTINUES_ON,
  });
  limitTurn(other, { kind: "session", resetsAt: new Date(Date.now() + 60_000).toISOString() });
  await expect(call(4)).rejects.toThrow(/failed/);
  const [sub] = sessions.subSessions.ofParent(parent.id);
  expect(latest(cache, sub.id)?.continueAt).not.toBeNull();
  expect(sessions.sessionWorking(parent.id)).toBe(true);

  vi.advanceTimersByTime(5 * 60_000);
  await until(() => latest(cache, sub.id)?.state === "running");
  // The parent asks again: the call waits for the continue's answer.
  const again = call(4);
  // The parent's watchdog waits while the call does: the sub-session's own has not run out yet.
  vi.advanceTimersByTime(WATCHDOG_MS - 60_000);
  await flush();
  expect(latest(cache, parent.id)?.state).toBe("running");
  gate.open(other.sent.at(-1)!.text);
  expect(await again).toBe(`Done: ${other.sent.at(-1)!.text}`);
  expect(latest(cache, sub.id)?.state).toBe("done");
});

test.each([
  {
    end: ({ parent, repo, sessions }: Awaited<ReturnType<typeof building>>) =>
      sessions.stop(repo, parent.id),
    name: "Stop on a parent",
  },
  {
    end: ({ gate }: Awaited<ReturnType<typeof building>>) => gate.fail("parent"),
    name: "A parent's turn that fails",
  },
])("$name stops its sub-sessions", async ({ end }) => {
  const setup = await building();
  const { cache, call, gate, other, parent, sessions } = setup;
  const calls = [4, 5].map((task) => call(task));
  await until(() => allRunning(sessions, cache, parent.id, 2));

  end(setup);

  for (const answer of calls) {
    await expect(answer).rejects.toThrow(/stopped/);
  }
  for (const sub of sessions.subSessions.ofParent(parent.id)) {
    expect(latest(cache, sub.id)?.state).toBe("stopped");
    expect(sessions.sessionWorking(sub.id)).toBe(false);
  }

  // Asked again, a stopped task runs again, a new turn of its sub-session.
  const sub = sessions.subSessions.ofParent(parent.id).find((one) => one.title === "Task 4")!;
  gate.open("Implement task 4");
  expect(await call(4)).toBe("Done: Implement task 4");
  expect(cache.turns(sub.id).map((turn) => turn.state)).toEqual(["stopped", "done"]);
  expect(other.sent.at(-1)?.text).toBe("Implement task 4");
  expect(sessions.subSessions.ofParent(parent.id)).toHaveLength(2);
});

test("after a restart, a parent continues once its sub-sessions end", async () => {
  const { cache, call, fake, gate, other, parent, sessions, signal } = await building();
  const first = call(4);
  first.catch(() => {});
  await until(() => allRunning(sessions, cache, parent.id, 1));
  const [sub] = sessions.subSessions.ofParent(parent.id);

  const next = await restart(sessions, { runs: () => CONTINUES_ON });
  expect(latest(cache, parent.id)).toMatchObject({ reason: SERVER_STOPPED, state: "stopped" });
  expect(latest(cache, sub.id)).toMatchObject({ reason: SERVER_STOPPED, state: "stopped" });
  fake.fallback = () => [];
  const sent = { fake: fake.sent.length, other: other.sent.length };

  await next.startContinues();
  vi.advanceTimersByTime(1);
  // The sub-session continues first, and holds its turn: its parent waits.
  await until(
    () => other.sent.length === sent.other + 1 && latest(cache, sub.id)?.state === "running",
  );
  const restarted = other.sent.at(-1)!.text;
  vi.advanceTimersByTime(60_000);
  await flush();
  expect(fake.sent).toHaveLength(sent.fake);
  expect(cache.turns(parent.id)).toHaveLength(1);

  gate.open(restarted);
  await until(() => fake.sent.length === sent.fake + 1);
  expect(latest(cache, sub.id)?.state).toBe("done");
  expect(cache.turns(parent.id)).toHaveLength(2);
  // The parent asks again for its task: the sub-session's answer, and no new session.
  const tool = runAgentTool(next.subSessions);
  const input = { prompt: "Implement task 4", task: "Task 4", worktree: sub.worktree };
  expect(await tool.call(parent.id, input, signal)).toBe(`Done: ${restarted}`);
  expect(next.subSessions.ofParent(parent.id)).toHaveLength(1);
});

test.each([
  {
    leave: (next: Sessions, settings: ContinueSettings) => {
      settings.afterLimit = false;
      next.runsChanged();
    },
    name: "dropped, its kind turned off",
  },
  {
    leave: (_: Sessions, __: ContinueSettings, off: Set<string>) => {
      off.add("other");
      vi.advanceTimersByTime(2 * 60 * 60_000);
    },
    name: "refused, its agent off",
  },
])("a parent's continue goes once its sub-session's continue is $name", async ({ leave }) => {
  const settings = { ...CONTINUES_ON };
  const { cache, call, fake, off, other, parent, sessions } = await building({
    runs: () => settings,
  });
  limitTurn(other, { kind: "session", resetsAt: new Date(Date.now() + 60 * 60_000).toISOString() });
  await expect(call(4)).rejects.toThrow(/failed/);
  const [sub] = sessions.subSessions.ofParent(parent.id);

  // The parent's restart continue waits for the sub-session's, which waits for its limit.
  const next = await restart(sessions, { runs: () => settings });
  fake.fallback = () => [];
  const sent = fake.sent.length;
  await next.startContinues();
  vi.advanceTimersByTime(1);
  await flush();
  expect(latest(cache, sub.id)?.continueAt).not.toBeNull();
  expect(cache.turns(parent.id)).toHaveLength(1);

  leave(next, settings, off);
  await until(() => fake.sent.length === sent + 1);
  expect(cache.turns(parent.id)).toHaveLength(2);
});
