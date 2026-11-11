import { execFileSync } from "node:child_process";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { fixtureRepo } from "uraeda-binding/test-utils";
import { mutate, testServer } from "../../__tests__/helpers.ts";
import { FakeAdapter, fakeModels } from "../fake.ts";
import { MODELS_REFRESH_MS, MODELS_REFRESH_TIMEOUT_MS, Runtimes } from "../runtimes.ts";
import { flush, restart, testSessions } from "./helpers.ts";

/** Waits on an agent, at step `plan`. */
/** The records of runtimes with no accounts and no open process. */
const NO_USAGE = { accounts: () => [], usage: () => [] };

const AGENT = "2026-10-12-cli-tuis";

const OFF = "pi-durable is off: turn it on to continue this session";

/** Every automatic continue on. */
const runs = () => ({ afterLimit: true, afterRestart: true, cap: 3 });

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
  const session = await sessions.featureSession(repo, AGENT, { runtime: "pi-durable" });
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

test("a runtime registered again keeps its place, and the default runtime", () => {
  const runtimes = new Runtimes();
  const undo = runtimes.register("claude", new FakeAdapter());
  runtimes.register("codex", new FakeAdapter());
  // As a built-in whose settings changed: unloaded, then registered again.
  undo();
  expect(runtimes.defaultFor(null)).toBe("codex");
  runtimes.register("claude", new FakeAdapter());
  expect(runtimes.names()).toEqual(["claude", "codex"]);
  expect(runtimes.defaultFor(null)).toBe("claude");
});

test("the default agent of the settings comes first where it is on, else the first runtime on", () => {
  const { durable, runtimes } = twoRuntimes();
  const kinds = (repo: string | null) =>
    runtimes.records(repo, NO_USAGE).map((record) => record.kind);
  expect(runtimes.defaultFor(null)).toBe("claude");

  runtimes.prefer("pi-durable");

  expect(runtimes.defaultFor(null)).toBe("pi-durable");
  expect(kinds(null)).toEqual(["pi-durable", "claude"]);
  expect(runtimes.forRepository(null)[0]).toBe(durable);
  // The names keep their registration order, whatever the default.
  expect(runtimes.names()).toEqual(["claude", "pi-durable"]);
  // A name that is not registered falls back, without failing.
  runtimes.prefer("gone");
  expect(runtimes.defaultFor(null)).toBe("claude");
  expect(kinds(null)).toEqual(["claude", "pi-durable"]);
  // Unset, the first runtime on again.
  runtimes.prefer(undefined);
  expect(runtimes.defaultFor(null)).toBe("claude");
});

test("a default agent off in a repository leaves it to the first runtime on there", () => {
  const { runtimes } = twoRuntimes({ "pi-durable": false });
  const changes: Array<string> = [];
  runtimes.onChange(() => changes.push("changed"));

  runtimes.prefer("pi-durable");
  runtimes.prefer("pi-durable");

  expect(changes).toEqual(["changed"]);
  expect(runtimes.defaultFor(null)).toBe("claude");
  expect(runtimes.records(null, NO_USAGE).map((record) => record.kind)).toEqual([
    "claude",
    "pi-durable",
  ]);
});

test("a session made without a pick runs on its step's, one picked keeps it, and a run of its step stays there (R18)", async () => {
  const { claude, durable, runtimes } = twoRuntimes();
  await runtimes.refreshModels();
  const plan = { agent: "pi-durable", effort: "high", model: "fake-big", step: "plan" };
  const { cache, repo, sessions } = await testSessions(undefined, {
    runOptions: () => ({ steps: [plan] }),
    runtimes,
  });
  // Made where the feature starts, with no pick: on the pick of its next step's run step.
  expect(await sessions.featureSession(repo, AGENT)).toMatchObject({
    agent: "pi-durable",
    effort: "high",
    model: "fake-big",
  });
  // Made on the human's pick: its first run keeps it, and a run of its step again stays there.
  const session = await sessions.newSession(repo, AGENT, { runtime: "claude" });
  const workflow = { step: "plan", trigger: "manual" } as const;
  const first = await sessions.send(repo, session.id, { text: "Write the plan", workflow });
  await sessions.settled(first.turn);
  expect(first.session).toBe(session.id);

  const again = await sessions.send(repo, session.id, { text: "Again", workflow });
  await sessions.settled(again.turn);

  expect(again.session).toBe(session.id);
  expect(cache.session(session.id)).toMatchObject({
    agent: "claude",
    effort: null,
    model: null,
    step: "plan",
  });
  expect(claude.opens).toHaveLength(1);
  expect(durable.opens).toHaveLength(0);
});

test("a new session runs on the pick, and records what its agent reported", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  adapter.script([{ effort: "High", model: "Fake Big", type: "runsOn" }]);
  const chat = await sessions.newChat(repo, { effort: "high", model: "fake-big", runtime: "fake" });

  await sessions.settled((await sessions.send(repo, chat.id, { text: "Hello" })).turn);

  expect(adapter.opens.at(-1)).toMatchObject({ effort: "high", model: "fake-big" });
  expect(cache.session(chat.id)).toMatchObject({
    effort: "high",
    model: "fake-big",
    ranEffort: "High",
    ranModel: "Fake Big",
  });
});

test("a session on the agent's defaults opens without a model or an effort", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  adapter.fallback = () => [];
  const chat = await sessions.newChat(repo);

  await sessions.settled((await sessions.send(repo, chat.id, { text: "Hello" })).turn);

  expect(cache.session(chat.id)).toMatchObject({ effort: null, model: null });
  expect(adapter.opens[0]).not.toHaveProperty("model");
  expect(adapter.opens[0]).not.toHaveProperty("effort");
});

test.each([true, false])(
  "an effort changed mid-turn applies to the next turn only (setEffort: %s)",
  async (hasSetEffort) => {
    const { adapter, cache, repo, sessions } = await testSessions();
    adapter.hasSetEffort = hasSetEffort;
    adapter.fallback = () => [];
    let release!: () => void;
    adapter.script([() => new Promise<void>((resolve) => (release = resolve))]);
    const chat = await sessions.newChat(repo);
    const { turn } = await sessions.send(repo, chat.id, { text: "Hello" });
    await vi.waitFor(() => expect(cache.turn(turn)?.state).toBe("running"));

    expect(() => sessions.setEffort(repo, chat.id, "ultra")).toThrow(
      "Fake Big takes no Ultra effort: pick another",
    );
    sessions.setEffort(repo, chat.id, "max");
    expect(cache.session(chat.id)?.effort).toBe("max");
    // The running turn keeps its effort: its process is not touched.
    expect(adapter.efforts).toEqual([]);
    expect(adapter.closes).toBe(0);
    release();
    await sessions.settled(turn);

    for (const text of ["Again", "Once more"]) {
      await sessions.settled((await sessions.send(repo, chat.id, { text })).turn);
    }

    if (hasSetEffort) {
      expect(adapter.efforts).toEqual(["max"]);
      expect(adapter.opens).toHaveLength(1);
      expect(adapter.closes).toBe(0);
    } else {
      // Reopened once, resuming the agent session, and not again once its effort is the stored one.
      expect(adapter.opens).toHaveLength(2);
      expect(adapter.opens[1]).toMatchObject({ effort: "max", resume: true });
    }
    sessions.close();
  },
);

test.each([true, false])(
  "an effort set back to the process's own before the next turn changes nothing (setEffort: %s)",
  async (hasSetEffort) => {
    const { adapter, repo, sessions } = await testSessions();
    adapter.hasSetEffort = hasSetEffort;
    adapter.fallback = () => [];
    const chat = await sessions.newChat(repo, { effort: "high", runtime: "fake" });
    await sessions.settled((await sessions.send(repo, chat.id, { text: "Hello" })).turn);

    sessions.setEffort(repo, chat.id, "max");
    sessions.setEffort(repo, chat.id, "high");
    await sessions.settled((await sessions.send(repo, chat.id, { text: "Again" })).turn);

    expect(adapter.opens).toHaveLength(1);
    expect(adapter.efforts).toEqual([]);
    expect(adapter.closes).toBe(0);
    sessions.close();
  },
);

test("a model list is asked for at most once a minute, and one that fails keeps the last one", async () => {
  let now = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => now);
  const fake = new FakeAdapter();
  const runtimes = new Runtimes();
  const unregister = runtimes.register("fake", fake);
  await runtimes.refreshModels();
  let changes = 0;
  runtimes.onChange(() => changes++);
  expect(runtimes.models("fake")).toEqual(fakeModels());
  expect(runtimes.records(null, NO_USAGE)[0]?.models).toEqual(fakeModels());

  const small = { defaults: {}, models: [fakeModels().models[1]!] };
  fake.modelList = small;
  await runtimes.refreshModels();
  expect(runtimes.models("fake")).toEqual(fakeModels());

  fake.modelsFail = true;
  now += MODELS_REFRESH_MS;
  await runtimes.refreshModels();
  expect(runtimes.models("fake")).toEqual(fakeModels());
  expect(changes).toBe(0);

  fake.modelsFail = false;
  now += MODELS_REFRESH_MS;
  await runtimes.refreshModels();
  expect(runtimes.models("fake")).toEqual(small);
  expect(changes).toBe(1);

  unregister();
  expect(runtimes.models("fake")).toBeUndefined();
});

test("each model list counts as it comes, and one that hangs times out, keeping the last one", async () => {
  vi.useFakeTimers();
  const fast = new FakeAdapter();
  const slow = new FakeAdapter();
  const hung: Array<(list: ReturnType<typeof fakeModels>) => void> = [];
  slow.models = () => new Promise((resolve) => hung.push(resolve));
  const runtimes = new Runtimes();
  runtimes.register("fast", fast);
  runtimes.register("slow", slow);
  let changes = 0;
  runtimes.onChange(() => changes++);
  let settled = false;

  const refresh = runtimes.refreshModels().then(() => (settled = true));
  await vi.advanceTimersByTimeAsync(0);
  // The fast list is in, and said, while the slow one is still asked for.
  expect(runtimes.models("fast")).toEqual(fakeModels());
  expect(changes).toBe(1);
  expect(settled).toBe(false);

  await vi.advanceTimersByTimeAsync(MODELS_REFRESH_TIMEOUT_MS);
  await refresh;
  expect(runtimes.models("slow")).toBeUndefined();
  expect(changes).toBe(1);

  // Asked again, the slow one answers: the first ask's late answer does not replace it.
  const small = { defaults: {}, models: [fakeModels().models[1]!] };
  vi.advanceTimersByTime(MODELS_REFRESH_MS);
  const second = runtimes.refreshModels(["slow"]);
  await vi.advanceTimersByTimeAsync(0);
  hung[1]!(small);
  await second;
  hung[0]!(fakeModels());
  await vi.advanceTimersByTimeAsync(0);
  expect(runtimes.models("slow")).toEqual(small);
  expect(changes).toBe(2);
});

test("a runtime without a model list has none", async () => {
  const fake = new FakeAdapter();
  Object.defineProperty(fake, "models", { value: undefined });
  const runtimes = new Runtimes();
  runtimes.register("fake", fake);
  await runtimes.refreshModels();

  expect(runtimes.records(null, NO_USAGE)[0]?.models).toBeNull();
});

test("each runtime's usage is its own, for windows of the same ID", async () => {
  const { claude, durable, runtimes } = twoRuntimes();
  const { repo, sessions } = await testSessions(undefined, { runtimes });
  const resetsAt = new Date(Date.now() + 3_600_000).toISOString();
  const window = (used: number) => ({ id: "five_hour", label: "5h", resetsAt, used });
  claude.script([{ type: "usage", windows: [window(0.2)] }]);
  durable.script([{ type: "usage", windows: [window(0.7)] }]);

  for (const runtime of ["claude", "pi-durable"]) {
    const chat = await sessions.newChat(repo, { runtime });
    await sessions.settled((await sessions.send(repo, chat.id, { text: "Hello" })).turn);
  }

  expect(sessions.usage("claude")).toEqual([window(0.2)]);
  expect(sessions.usage("pi-durable")).toEqual([window(0.7)]);
});

test("a queued turn of a runtime turned off fails, never opening it again", async () => {
  const { durable, on, runtimes } = twoRuntimes();
  const { cache, repo, sessions } = await testSessions(undefined, { runtimes });
  const session = await sessions.featureSession(repo, AGENT, { runtime: "pi-durable" });
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
  const { cache, repo, sessions } = await testSessions(fixtureRepo(), {
    runOptions: () => ({ steps: [{ agent: "pi-durable", step: "plan" }] }),
    runs,
    runtimes,
  });
  let now = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => now);
  const later = async (ms: number) => {
    now += ms;
    vi.advanceTimersByTime(ms);
    await flush();
  };
  const session = await sessions.featureSession(repo, AGENT, { runtime: "pi-durable" });
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

test("change.start sends the change's first run on its options' build step, kept as its own (R20)", async () => {
  const server = await testServer();
  const durable = new FakeAdapter();
  durable.fallback = () => [];
  server.sessions.runtimes.register("pi-durable", durable);
  await server.sessions.check();
  await server.sessions.runtimes.refreshModels();
  const build = { agent: "pi-durable", effort: "high", model: "fake-big", step: "build" };

  const started = await mutate(
    server.app,
    "change.start",
    { options: { steps: [build] }, slug: "home-icon", text: "Another home icon" },
    ["folder", "session"],
  );

  expect(started.error).toBeUndefined();
  const { folder, session } = started.data as { folder: string; session: string };
  expect(server.sessions.cache.session(session)).toMatchObject({
    agent: "pi-durable",
    effort: "high",
    model: "fake-big",
  });
  expect(server.featureOptions.own(await server.sessions.mainRoot(server.repo), folder)).toEqual({
    steps: [build],
  });
  expect(server.adapter.opens).toEqual([]);
});

test("change.start sends the first run on its build step's pick when its options could not be kept", async () => {
  const server = await testServer();
  const durable = new FakeAdapter();
  durable.fallback = () => [];
  server.sessions.runtimes.register("pi-durable", durable);
  await server.sessions.check();
  await server.sessions.runtimes.refreshModels();
  vi.spyOn(server.featureOptions, "set").mockImplementation(() => {
    throw new Error("disk full");
  });
  const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const build = { agent: "pi-durable", model: "fake-big", step: "build" };

  const started = await mutate(
    server.app,
    "change.start",
    { options: { steps: [build] }, slug: "home-icon", text: "Another home icon" },
    ["folder", "session"],
  );

  expect(started.error).toBeUndefined();
  const { session } = started.data as { session: string | null };
  expect(session).not.toBeNull();
  expect(server.sessions.cache.session(session ?? "")).toMatchObject({
    agent: "pi-durable",
    model: "fake-big",
  });
  expect(String(stderr.mock.calls[0]?.[0])).toContain("disk full");
});

test.each<[string, Record<string, unknown>, string]>([
  ["a model its agent does not list", { model: "fake-huge" }, "has no model fake-huge"],
  ["an effort its model does not take", { effort: "high", model: "fake-small" }, "takes no High"],
])("change.start refuses %s before the change is committed", async (_, pick, refusal) => {
  const server = await testServer();
  await server.sessions.runtimes.refreshModels();
  const head = () =>
    execFileSync("git", ["-C", server.repo, "rev-parse", "HEAD"], { encoding: "utf8" });
  const before = head();

  const started = await mutate(
    server.app,
    "change.start",
    {
      options: { steps: [{ ...pick, step: "build" }] },
      slug: "home-icon",
      text: "Another home icon",
    },
    ["folder", "session"],
  );

  expect(JSON.stringify(started.error)).toContain(refusal);
  expect(head()).toBe(before);
  expect(server.adapter.opens).toEqual([]);
});

test("session.setEffort refuses an effort that is not a name, nor null", async () => {
  const server = await testServer();
  await server.sessions.runtimes.refreshModels();
  const chat = await mutate(server.app, "session.newChat", {}, ["id"]);
  const id = (chat.data as { id: string }).id;

  const set = await mutate(server.app, "session.setEffort", { effort: 5, id }, ["id"]);

  expect(JSON.stringify(set.error)).toContain("The effort is not a name: pick another");
  expect(server.sessions.cache.session(id)?.effort).toBeNull();
});
