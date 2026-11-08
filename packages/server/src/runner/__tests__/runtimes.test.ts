import { afterEach, expect, test, vi } from "vite-plus/test";
import { fixtureRepo } from "uraeda-binding/test-utils";
import { mutate, testServer } from "../../__tests__/helpers.ts";
import { FakeAdapter } from "../fake.ts";
import { Runtimes } from "../runtimes.ts";
import { flush, restart, testSessions } from "./helpers.ts";

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";

const OFF = "pi-durable is off: turn it on to continue this session";

/** Every automatic continue on. */
const runs = () => ({ afterLimit: true, afterRestart: true, beforeGate: true, cap: 3 });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/**
 * Two fake runtimes, `claude` first, then `pi-durable`, each on while `on` says so, both by
 * default, whose turns end at once, done.
 */
function twoRuntimes(on: Record<string, boolean> = {}) {
  const claude = new FakeAdapter();
  const durable = new FakeAdapter();
  claude.fallback = () => [];
  durable.fallback = () => [];
  const runtimes = new Runtimes({ isOn: (name) => on[name] ?? true });
  runtimes.register("claude", claude);
  const unregister = runtimes.register("pi-durable", durable);
  return { claude, durable, on, runtimes, unregister };
}

test.each<[string, boolean | undefined, string]>([
  ["on", true, "sends"],
  ["off", false, OFF],
  ["removed", undefined, OFF],
])("a session runs on the runtime it was started with (%s)", async (_, state, expected) => {
  const { claude, durable, on, runtimes, unregister } = twoRuntimes();
  const { cache, repo, sessions } = await testSessions(undefined, { runtimes });
  const session = await sessions.featureSession(repo, AGENT, "pi-durable");
  expect(cache.session(session.id)?.agent).toBe("pi-durable");
  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });
  await sessions.settled(turn);
  expect(durable.opens).toHaveLength(1);

  if (state === undefined) {
    unregister();
  } else {
    on["pi-durable"] = state;
  }
  const next = await restart(sessions);
  expect(next.runtimeOf(session.id)).toBe(state === undefined ? undefined : durable);
  const send = next.send(repo, session.id, { text: "Go on" });
  if (expected === "sends") {
    await next.settled((await send).turn);
    await flush();
    expect(durable.opens).toHaveLength(2);
    expect(durable.opens[1]).toMatchObject({ nativeId: session.nativeId, resume: true });
  } else {
    await expect(send).rejects.toThrow(expected);
  }
  // Never moved onto the first runtime, and still stored with its own.
  expect(claude.opens).toHaveLength(0);
  expect(cache.session(session.id)?.agent).toBe("pi-durable");
  next.close();
});

test("starting a session with no runtime on is refused", async () => {
  const { claude, durable, runtimes } = twoRuntimes({ claude: false, "pi-durable": false });
  const { cache, repo, sessions } = await testSessions(undefined, { runtimes });

  await expect(sessions.featureSession(repo, AGENT)).rejects.toThrow(
    "No agent runtime is on here: turn one on in Settings, Extensions",
  );
  await expect(sessions.newChat(repo)).rejects.toThrow("No agent runtime is on here");
  expect(cache.folderSessions(await sessions.mainRoot(repo), AGENT)).toHaveLength(0);
  expect([...claude.opens, ...durable.opens]).toHaveLength(0);
});

test("a new session runs on the first runtime on in its repository", async () => {
  const { runtimes } = twoRuntimes({ claude: false });
  const { repo, sessions } = await testSessions(undefined, { runtimes });

  const session = await sessions.featureSession(repo, AGENT);

  expect(session.agent).toBe("pi-durable");
});

test("a fresh run keeps the runtime of the session it was sent to, not the first one on (R20)", async () => {
  const { claude, durable, runtimes } = twoRuntimes();
  const { cache, repo, sessions } = await testSessions(undefined, { runtimes });
  const session = await sessions.featureSession(repo, AGENT, "pi-durable");
  await sessions.settled((await sessions.send(repo, session.id, { text: "Plan it" })).turn);

  const workflow = { fresh: true, step: "plan", trigger: "manual" } as const;
  const { turn } = await sessions.send(repo, session.id, { text: "Again", workflow });
  await sessions.settled(turn);

  const fresh = cache.session(cache.turn(turn)!.sessionId)!;
  expect(fresh.id).not.toBe(session.id);
  expect(fresh.agent).toBe("pi-durable");
  expect(durable.opens).toHaveLength(2);
  expect(claude.opens).toHaveLength(0);
});

test("each runtime's usage is its own, for windows of the same ID", async () => {
  const { claude, durable, runtimes } = twoRuntimes();
  const { repo, sessions } = await testSessions(undefined, { runtimes });
  const resetsAt = new Date(Date.now() + 3_600_000).toISOString();
  const window = (used: number) => ({ id: "five_hour", label: "5h", resetsAt, used });
  claude.script([{ type: "usage", windows: [window(0.2)] }]);
  durable.script([{ type: "usage", windows: [window(0.7)] }]);

  for (const runtime of ["claude", "pi-durable"]) {
    const chat = await sessions.newChat(repo, runtime);
    await sessions.settled((await sessions.send(repo, chat.id, { text: "Hello" })).turn);
  }

  expect(sessions.usage("claude")).toEqual([window(0.2)]);
  expect(sessions.usage("pi-durable")).toEqual([window(0.7)]);
});

test("a queued turn of a runtime turned off fails, never opening it again", async () => {
  const { durable, on, runtimes } = twoRuntimes();
  const { cache, repo, sessions } = await testSessions(undefined, { runtimes });
  const session = await sessions.featureSession(repo, AGENT, "pi-durable");
  durable.capabilities.steer = false;
  let crash!: () => void;
  durable.script([
    () => new Promise<void>((_, reject) => (crash = () => reject(new Error("gone")))),
  ]);
  await sessions.send(repo, session.id, { text: "Plan it" });
  await vi.waitFor(() => expect(cache.turns(session.id).at(-1)?.state).toBe("running"));
  const { turn: queued } = await sessions.send(repo, session.id, { text: "Then the tasks" });

  on["pi-durable"] = false;
  crash();
  await sessions.settled(queued);

  expect(durable.opens).toHaveLength(1);
  expect(cache.turn(queued)).toMatchObject({ reason: OFF, state: "failed" });
  sessions.close();
});

test("turning a runtime on within the restart window continues the runs a restart cut on it", async () => {
  const { durable, on, runtimes } = twoRuntimes();
  const { cache, repo, sessions } = await testSessions(fixtureRepo(), { runs, runtimes });
  let now = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => now);
  const later = async (ms: number) => {
    now += ms;
    vi.advanceTimersByTime(ms);
    await flush();
  };
  const session = await sessions.featureSession(repo, AGENT, "pi-durable");
  durable.script([() => new Promise<void>(() => {})]);
  const workflow = { fresh: false, step: "plan", trigger: "manual" } as const;
  await sessions.send(repo, session.id, { text: "Write the plan", workflow });
  await vi.waitFor(() => expect(cache.turns(session.id).at(-1)?.state).toBe("running"));
  on["pi-durable"] = false;
  const next = await restart(sessions, { runs });
  await next.startContinues();
  await later(10_000);
  const sent = durable.sent.length;

  on["pi-durable"] = true;
  runtimes.changed();
  await later(10_000);

  await vi.waitFor(() => expect(durable.sent).toHaveLength(sent + 1));
  expect(durable.sent.at(-1)?.text).toBe(
    "The server restarted while you worked. Continue where you left off.",
  );
  next.close();
});

test.each<[string, string, Record<string, unknown>]>([
  ["session.send", "a feature's first message", { folder: AGENT, text: "Plan it" }],
  ["session.send", "a new session of a feature", { folder: AGENT, newSession: true, text: "Hi" }],
  ["session.new", "a new session", { folder: AGENT }],
  ["session.newChat", "a new chat", {}],
])("%s makes %s on the runtime picked (R20)", async (name, _, input) => {
  const server = await testServer();
  const durable = new FakeAdapter();
  durable.fallback = () => [];
  server.sessions.runtimes.register("pi-durable", durable);
  await server.sessions.check();

  const made = await mutate(server.app, name, { ...input, runtime: "pi-durable" }, ["id", "agent"]);

  expect(made.error).toBeUndefined();
  expect(made.data).toMatchObject({ agent: "pi-durable" });
  expect(server.adapter.opens).toEqual([]);
});

test("a runtime picked that is off is refused, making no session", async () => {
  const server = await testServer();

  const made = await mutate(server.app, "session.newChat", { runtime: "pi-durable" }, ["id"]);

  expect(made.error).toBeDefined();
  expect(JSON.stringify(made.error)).toContain(OFF);
});

test("change.start sends the change's first run on the runtime picked (R20)", async () => {
  const server = await testServer();
  const durable = new FakeAdapter();
  durable.fallback = () => [];
  server.sessions.runtimes.register("pi-durable", durable);
  await server.sessions.check();

  const started = await mutate(
    server.app,
    "change.start",
    { runtime: "pi-durable", slug: "home-icon", text: "Another home icon" },
    ["folder", "session"],
  );

  expect(started.error).toBeUndefined();
  const session = (started.data as { session: string }).session;
  expect(server.sessions.cache.session(session)?.agent).toBe("pi-durable");
  expect(server.adapter.opens).toEqual([]);
});
