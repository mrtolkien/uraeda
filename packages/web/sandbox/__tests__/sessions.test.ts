// @vitest-environment node
// The sandbox's sessions: the fake agent's canned reply and turn at work, through the session
// manager, and the sample sessions seeded in a data folder, on waits the tests give.
import { execFileSync } from "node:child_process";
import { getEventListeners } from "node:events";
import { join } from "node:path";
import { mainRoot, nextStep } from "uraeda-binding";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { fakeSessions, type Sessions } from "uraeda-server/testing";
import { afterEach, beforeAll, expect, test } from "vite-plus/test";
import { buildProjects, fakeGh, SAMPLE_FOLDERS, samplePullRequests } from "../../samples/index.ts";
import { atWork, CANNED_REPLY, sandboxAgent, timerWait, workflowMessage } from "../agent.ts";
import { seedSessions } from "../sessions.ts";

type Wait = (ms: number) => Promise<void>;
type SessionCache = Sessions["cache"];

/** The runner's cache in `dataDir`, read as the server reads it; the caller closes it. */
function openCache(dataDir: string): SessionCache {
  return fakeSessions({ cache: join(dataDir, "runner.sqlite") }).sessions.cache;
}

// Building the projects commits on dozens of branches: once for the file's tests.
let sample: string;
beforeAll(() => {
  fakeGh(samplePullRequests());
  ({ sample } = buildProjects(temporaryFolder("sandbox-sessions")));
}, 120_000);

let open: Sessions | undefined;
afterEach(async () => {
  await open?.closeAll();
  open?.close();
  open = undefined;
});

/** A session manager on the sandbox's agent, in memory, checked, its waits given to `wait`. */
async function sandboxSessions(wait: Wait) {
  const { adapter, sessions } = fakeSessions({ adapter: sandboxAgent({ wait }) });
  await sessions.check();
  open = sessions;
  return { adapter, sessions };
}

/** The last text the agent wrote in a turn. */
function lastText(cache: SessionCache, turn: number): string | undefined {
  return cache
    .items(turn, 0, 10_000)
    .filter((item) => item.kind === "text")
    .at(-1)?.text;
}

/** The tool calls of a turn. */
function tools(cache: SessionCache, turn: number) {
  return cache.items(turn, 0, 10_000).filter((item) => item.kind === "tool");
}

/** A wait that never ends but by the turn's end. */
const never = () => new Promise<void>(() => {});

const sum = (values: Array<number>) => values.reduce((total, value) => total + value, 0);

/** What `git status` shows in `dir`, and its commit. */
function gitState(dir: string) {
  const git = (...args: Array<string>) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  return { head: git("rev-parse", "HEAD"), status: git("status", "--porcelain") };
}

/**
 * Each sample session's state, by its latest turn: the runner has no state of its own for the usage
 * limit, so a failed turn whose reason names it reads `failed: usage limit`, as a real one would.
 */
async function sessionStates(dataDir: string, repo: string): Promise<Set<string>> {
  const cache = openCache(dataDir);
  try {
    return new Set(
      cache.sessions(await mainRoot(repo)).map((session) => {
        const latest = cache.turns(session.id).at(-1);
        return latest?.state === "failed" && /usage limit/.test(latest.reason ?? "")
          ? "failed: usage limit"
          : (latest?.state ?? "none");
      }),
    );
  } finally {
    cache.db.close();
  }
}

test("any message gets the canned reply, streamed over 3 seconds, and changes no file", async () => {
  const waits: Array<number> = [];
  const { sessions } = await sandboxSessions(async (ms) => void waits.push(ms));
  const chat = await sessions.newChat(sample);
  const before = gitState(sample);

  const { turn } = await sessions.send(sample, chat.id, { text: "Make the title bigger" });
  await sessions.settled(turn);

  expect(sessions.cache.turn(turn)?.state).toBe("done");
  expect(lastText(sessions.cache, turn)).toBe(
    "This is the sandbox's fake agent: it answers every message with this text, and changes no file.",
  );
  expect(waits.length).toBeGreaterThan(1);
  expect(sum(waits)).toBe(3000);
  expect(gitState(sample)).toEqual(before);
});

test("the canned reply waits before each word it streams", async () => {
  const order: Array<string> = [];
  const agent = sandboxAgent({ wait: async () => void order.push("wait") });
  const process = agent.open({ cwd: sample, nativeId: "s1", resume: false });

  process.send({ id: "m1", images: [], text: "Make the title bigger", when: "queue" });
  for await (const event of process.events) {
    order.push(event.type);
    if (event.type === "result") {
      break;
    }
  }

  const streamed = order.filter((step) => step === "wait" || step === "textDelta");
  expect(streamed.length).toBeGreaterThan(2);
  expect(streamed).toEqual(
    Array.from({ length: streamed.length }, (_, index) => (index % 2 ? "textDelta" : "wait")),
  );
  process.close();
});

test("the sandbox's agent offers no take-back, which it would never complete", () => {
  expect(sandboxAgent().capabilities.takeBack).toBe(false);
});

test("the timer's waits leave no listener on the turn's signal", async () => {
  const turn = new AbortController();

  for (let index = 0; index < 20; index++) {
    await timerWait(0, turn.signal);
  }

  expect(getEventListeners(turn.signal, "abort")).toEqual([]);
});

test("the turn at work streams tool calls for 10 minutes, then ends done", async () => {
  const waits: Array<number> = [];
  const { sessions } = await sandboxSessions(async (ms) => void waits.push(ms));

  const { turn } = await atWork(sessions, sample);
  await sessions.settled(turn);

  expect(sessions.cache.turn(turn)).toMatchObject({ kind: "workflow", state: "done" });
  expect(sum(waits)).toBe(600_000);
  const calls = tools(sessions.cache, turn);
  expect(calls.length).toBeGreaterThan(10);
  expect(calls.every((call) => call.status === "completed")).toBe(true);
});

test("a message sent during the turn at work waits for it, and does not cut it short", async () => {
  const waits: Array<number> = [];
  let reached!: () => void;
  const atFirstWait = new Promise<void>((resolve) => (reached = resolve));
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  // The turn at work holds at its first wait, until the message is sent.
  const { sessions } = await sandboxSessions(async (ms) => {
    waits.push(ms);
    if (waits.length === 1) {
      reached();
      await held;
    }
  });
  const { turn: working } = await atWork(sessions, sample);
  await atFirstWait;
  const session = await sessions.featureSession(sample, SAMPLE_FOLDERS.features.implementation);

  const { turn: message } = await sessions.send(sample, session.id, {
    text: "Make the title bigger",
  });

  expect(message).not.toBe(working);
  expect(sessions.cache.turn(message)?.state).toBe("queued");
  release();
  await sessions.settled(working);
  await sessions.settled(message);
  expect(sessions.cache.turn(working)?.state).toBe("done");
  expect(sum(waits)).toBe(600_000 + 3000);
  expect(tools(sessions.cache, working).every((call) => call.status === "completed")).toBe(true);
  expect(sessions.cache.turn(message)?.state).toBe("done");
  expect(lastText(sessions.cache, message)).toBe(CANNED_REPLY);
});

test("a message reaching the agent as the turn at work starts gets the canned reply", async () => {
  const { sessions } = await sandboxSessions(async () => {});
  const chat = await sessions.newChat(sample);
  const send = sessions.send.bind(sessions);
  let message: number | undefined;
  // Another session's message reaches the agent between the turn at work's start and its message.
  sessions.send = async (repo, id, input) => {
    if (input.workflow !== undefined && message === undefined) {
      ({ turn: message } = await send(sample, chat.id, { text: "Make the title bigger" }));
    }
    return send(repo, id, input);
  };

  const { turn: working } = await atWork(sessions, sample);
  await sessions.settled(message!);
  await sessions.settled(working);

  expect(lastText(sessions.cache, message!)).toBe(CANNED_REPLY);
  expect(tools(sessions.cache, message!)).toEqual([]);
  expect(tools(sessions.cache, working).length).toBeGreaterThan(10);
});

test("the turn at work plays again from its start after a restart stopped it", async () => {
  const dataDir = temporaryFolder("sandbox-restart");
  const cache = join(dataDir, "runner.sqlite");
  let reached!: () => void;
  const atFirstWait = new Promise<void>((resolve) => (reached = resolve));
  // The first sandbox's turn at work holds at its first wait, a tool call started, until it stops.
  const first = fakeSessions({
    adapter: sandboxAgent({
      wait: () => {
        reached();
        return never();
      },
    }),
    cache,
  });
  let stopped: number;
  try {
    await first.sessions.check();
    ({ turn: stopped } = await atWork(first.sessions, sample));
    await atFirstWait;
  } finally {
    await first.sessions.closeAll();
    first.sessions.close();
    first.sessions.cache.db.close();
  }

  const waits: Array<number> = [];
  const { adapter, sessions } = fakeSessions({
    adapter: sandboxAgent({ wait: async (ms) => void waits.push(ms) }),
    cache,
  });
  open = sessions;
  await sessions.check();
  const { turn } = await atWork(sessions, sample);
  await sessions.settled(turn);

  expect(sessions.cache.turn(stopped)?.state).toBe("stopped");
  expect(tools(sessions.cache, stopped).length).toBeGreaterThan(0);
  expect(sessions.cache.turn(turn)?.state).toBe("done");
  expect(sum(waits)).toBe(600_000);
  expect(adapter.opens).toHaveLength(1);
});

test("seeded sessions are done, failed, stopped, and failed, its reason naming the usage limit", async () => {
  const dataDir = temporaryFolder("sandbox-seed");

  await seedSessions(dataDir, sample);

  expect(await sessionStates(dataDir, sample)).toEqual(
    new Set(["done", "failed", "stopped", "failed: usage limit"]),
  );
  const cache = openCache(dataDir);
  try {
    const chat = cache
      .sessions(await mainRoot(sample))
      .find((session) => cache.turns(session.id).at(-1)?.state === "done");
    const [turn] = cache.turns(chat?.id ?? "");
    const kinds = cache.items(turn?.id ?? 0, 0, 100).map((item) => item.kind);
    expect(kinds).toEqual(expect.arrayContaining(["message", "tool", "text"]));
  } finally {
    cache.db.close();
  }
});

test("Continue gets the canned reply, and the feature's step stays", async () => {
  const { sessions } = await sandboxSessions(async () => {});
  const folder = SAMPLE_FOLDERS.features.plan;
  const { branch = "", step } = await nextStep(sample, folder);
  expect(step.waitsOn).toBe("agent");
  const session = await sessions.featureSession(sample, folder);
  const commit = () =>
    execFileSync("git", ["rev-parse", branch], { cwd: sample, encoding: "utf8" });
  const before = commit();

  const { turn } = await sessions.send(sample, session.id, {
    text: await workflowMessage(sample, folder),
    workflow: { trigger: "manual" },
  });
  await sessions.settled(turn);

  expect(sessions.cache.turn(turn)).toMatchObject({ kind: "workflow", state: "done" });
  expect(lastText(sessions.cache, turn)).toBe(CANNED_REPLY);
  expect((await nextStep(sample, folder)).step).toEqual(step);
  expect(commit()).toBe(before);
  expect(gitState(join(sample, ".worktrees", folder)).status).toBe("");
});
