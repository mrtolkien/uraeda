import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vite-plus/test";
import * as binding from "uraeda-binding";
import { live } from "../fate.ts";
import { publish, SESSION_UPDATE_MS, sessionPublisher, startLive, stopLive } from "../live.ts";
import { SessionCache } from "../runner/cache.ts";
import { byId, fixtureRepo, git, mutate, port, testApp, testServer } from "./helpers.ts";

type App = ReturnType<typeof testApp>;

/**
 * A live connection, its stream read as it comes. `arrival` gives the time a text first came in,
 * taken when its chunk was read: the time a test spends after it, cleaning up, is not counted.
 */
async function connect(app: App, connectionId: string) {
  const response = await app.request(
    `http://127.0.0.1:${port}/fate/live?connectionId=${connectionId}`,
    { headers: { accept: "text/event-stream" } },
  );
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let received = "";
  /** The length of the stream after each chunk, and when that chunk was read. */
  const chunks: Array<{ length: number; at: number }> = [];
  const waiting = new Set<() => void>();
  void (async () => {
    for (;;) {
      const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
      if (done) {
        return;
      }
      received += decoder.decode(value, { stream: true });
      chunks.push({ length: received.length, at: performance.now() });
      for (const wake of waiting) {
        wake();
      }
    }
  })();
  const arrivedAt = (text: string, from: number) =>
    chunks.find((chunk) => received.slice(from, chunk.length).includes(text))?.at;
  return {
    /**
     * When `text` came in the stream, after the `from` first characters, or undefined when it has
     * not within `timeout` ms.
     */
    arrival(text: string, timeout: number, from = 0): Promise<number | undefined> {
      return new Promise((resolve) => {
        const wake = () => {
          const at = arrivedAt(text, from);
          if (at !== undefined) {
            waiting.delete(wake);
            clearTimeout(timer);
            resolve(at);
          }
        };
        const timer = setTimeout(() => {
          waiting.delete(wake);
          resolve(undefined);
        }, timeout);
        waiting.add(wake);
        wake();
      });
    },
    /** How much of the stream came so far: what a later `arrival` can start after. */
    mark: () => received.length,
    close: () => reader.cancel(),
  };
}

/** Subscribes a connection to an entity's live updates. */
async function subscribe(
  app: App,
  connectionId: string,
  entity: { type: string; entityId: string; select: Array<string> },
) {
  const response = await app.request(`http://127.0.0.1:${port}/fate/live`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      version: 1,
      connectionId,
      operations: [{ id: "s1", kind: "subscribe", ...entity }],
    }),
  });
  expect(((await response.json()) as { results: Array<{ ok: boolean }> }).results[0].ok).toBe(true);
}

/**
 * US6.5: a commit on a feature's branch reaches a subscribed page within 2 seconds. The watcher
 * waits 200 ms of quiet, then reads the workspace: the rest of the budget is the margin for a
 * machine running the other test projects at the same time.
 */
test("a commit on a branch is sent to a live subscription within 2 seconds", async () => {
  const repo = fixtureRepo();
  const app = testApp(repo);
  startLive(binding, repo);
  const stream = await connect(app, "c1");
  expect(await stream.arrival("connected", 5000)).toBeDefined();
  await subscribe(app, "c1", {
    type: "Feature",
    entityId: "2026-10-12-cli-tuis",
    select: ["id", "files"],
  });
  // The subscription is sent the feature as it is first: the commit's update comes after it.
  expect(await stream.arrival('"kind":"next"', 5000)).toBeDefined();
  const before = stream.mark();

  git(repo, "switch", "--quiet", "2026-10-12-cli-tuis");
  writeFileSync(
    join(repo, "specs/2026-10-12-cli-tuis/plan.md"),
    "---\nstatus: auto-approved\nspec-revision: 1\n---\n\n# Plan: CLI TUIs\n",
  );
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "plan(cli-tuis): plan");
  const committed = performance.now();
  // The plan the commit adds, with its status: before it, the feature lists it as not written.
  const arrived = await stream.arrival("auto-approved", 10_000, before);
  stopLive(repo);
  await stream.close();

  expect(arrived, "no live update within 10 seconds").toBeDefined();
  expect(arrived! - committed).toBeLessThan(2000);
}, 20_000);

/**
 * A view reads its data, then subscribes: a change made between the two is sent at once, as the
 * subscription sends the data as it is when it starts, with no change made since.
 */
test("a subscription is sent its entity's data once it starts", async () => {
  const repo = fixtureRepo();
  const app = testApp(repo);
  const stream = await connect(app, "c3");
  expect(await stream.arrival("connected", 5000)).toBeDefined();
  await subscribe(app, "c3", {
    type: "Feature",
    entityId: "2026-10-12-cli-tuis",
    select: ["id", "files"],
  });

  const arrived = await stream.arrival("proposal.md", 5000);
  await stream.close();

  expect(arrived, "no data within 5 seconds of subscribing").toBeDefined();
});

/**
 * The dev server makes an app for each port a repository is served on, and each
 * starts its live updates. The repository is watched once, so no change is sent twice, and until
 * it is stopped.
 */
test("a repository is watched once, until stopped", () => {
  const repo = fixtureRepo();
  let watches = 0;
  const counting = {
    ...binding,
    watch: (...args: Parameters<typeof binding.watch>) => {
      watches++;
      return binding.watch(...args);
    },
  };

  startLive(counting, repo);
  startLive(counting, repo);
  expect(watches).toBe(1);

  stopLive(repo);
  startLive(counting, repo);
  expect(watches).toBe(2);
  stopLive(repo);
});

/**
 * A feature's step changed through git, as a commit of its answers: its session's status reads
 * the step, so the sidebar's list and the session are sent with the feature.
 */
test("a feature's change through git is published to its session and the list", async () => {
  const { sessions, repo } = await testServer();
  const session = await sessions.featureSession(repo, "2026-10-12-cli-tuis");
  let watcher: ((changes: binding.Changes) => void) | undefined;
  const capturing = {
    ...binding,
    watch: (path: string, callback: (changes: binding.Changes) => void) => {
      watcher = callback;
      return binding.watch(path, () => {});
    },
  };
  startLive(capturing, repo, sessions);
  const sent = published();

  watcher!({
    features: ["2026-10-12-cli-tuis", "2026-10-11-web-ui"],
    files: [],
    priorities: false,
    workspace: false,
  });
  await vi.waitFor(() => expect(sent()).toContain(`Session ${session.id}`));
  stopLive(repo);

  expect(sent()).toEqual(
    expect.arrayContaining([
      "Feature 2026-10-12-cli-tuis",
      "Feature 2026-10-11-web-ui",
      "SessionList all",
      `Session ${session.id}`,
    ]),
  );
  expect(sent().filter((each) => each.startsWith("Session "))).toHaveLength(1);
});

/** A session with a running turn holding `items` text items, in a cache in memory. */
function sessionWithItems(items: number) {
  const cache = SessionCache.open(":memory:");
  const session = cache.createSession({
    repo: "/repo",
    folder: "2026-10-12-cli-tuis",
    agent: "fake",
    nativeId: "n",
    title: null,
  });
  const turn = cache.addTurn({
    sessionId: session.id,
    kind: "chat",
    trigger: null,
    step: null,
    allowed: null,
    state: "running",
  });
  for (let n = 0; n < items; n++) {
    cache.appendItem(turn, { kind: "text", text: `Line ${n}`, streaming: false });
  }
  return { cache, session: session.id, turn };
}

/** The live updates sent, as `<type> <id>`. */
function published() {
  const update = vi.spyOn(live, "update");
  return () => update.mock.calls.map(([type, id]) => `${type} ${String(id)}`);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test("a session's status change is published at once, with the list, its feature, and the workspace", () => {
  const { cache, session, turn } = sessionWithItems(150);
  const sent = published();
  const publish = sessionPublisher(cache);

  publish({ repo: "/repo", session, folder: "2026-10-12-cli-tuis", turn, state: "done" });

  expect(sent()).toEqual([
    `Session ${session}`,
    `Turn ${turn}`,
    `TurnLog ${turn}:0`,
    `TurnLog ${turn}:1`,
    "SessionList all",
    "Feature 2026-10-12-cli-tuis",
    "Workspace workspace",
  ]);
});

test("two changes published in one millisecond have different event IDs", () => {
  vi.spyOn(Date, "now").mockReturnValue(1_000);
  const update = vi.spyOn(live, "update");
  const changes = { features: [], files: [], priorities: false, workspace: true };

  publish(changes);
  publish(changes);

  const ids = update.mock.calls.map(([, , options]) => options?.eventId);
  expect(ids).toHaveLength(2);
  expect(ids[0]).not.toBe(ids[1]);
});

test("a chat's change is published without a feature, and the agent's on its own", () => {
  const { cache, session } = sessionWithItems(0);
  const sent = published();
  const publish = sessionPublisher(cache);

  publish({ repo: "/repo", session, folder: null });
  publish({ agent: true });

  expect(sent()).toEqual([
    `Session ${session}`,
    "SessionList all",
    "Workspace workspace",
    "Agent agent",
  ]);
});

test("SC-002: items are published at most every 250 ms", () => {
  vi.useFakeTimers();
  const { cache, session, turn } = sessionWithItems(10);
  const sent = published();
  const publish = sessionPublisher(cache);
  const item = { repo: "/repo", session, folder: "2026-10-12-cli-tuis", turn };
  const once = [`Session ${session}`, `Turn ${turn}`, `TurnLog ${turn}:0`];

  publish(item);
  expect(sent()).toEqual(once);
  for (let n = 0; n < 20; n++) {
    publish(item);
  }
  expect(sent()).toEqual(once);
  vi.advanceTimersByTime(SESSION_UPDATE_MS - 1);
  expect(sent()).toEqual(once);
  vi.advanceTimersByTime(1);
  expect(sent()).toEqual([...once, ...once]);
  vi.advanceTimersByTime(10 * SESSION_UPDATE_MS);
  expect(sent()).toEqual([...once, ...once]);

  // A state change goes at once, and drops the update waiting.
  publish(item);
  publish(item);
  publish({ ...item, state: "done" });
  vi.advanceTimersByTime(10 * SESSION_UPDATE_MS);
  expect(sent().slice(6)).toEqual([
    ...once,
    ...once,
    "SessionList all",
    "Feature 2026-10-12-cli-tuis",
    "Workspace workspace",
  ]);
});

test("US3.4: a sub-agent that starts or ends is published to the list", () => {
  vi.useFakeTimers();
  const { cache, session, turn } = sessionWithItems(0);
  const sent = published();
  const publish = sessionPublisher(cache);
  const item = { repo: "/repo", session, folder: null, turn };

  publish(item);
  const seq = cache.appendItem(turn, {
    kind: "tool",
    id: "task-1",
    name: "Task",
    toolKind: "other",
    status: "in_progress",
    subagent: { description: "Map the runner code" },
  });
  vi.advanceTimersByTime(SESSION_UPDATE_MS);
  publish(item);
  expect(sent().filter((each) => each === "SessionList all")).toHaveLength(1);

  cache.updateItem(turn, seq, {
    kind: "tool",
    id: "task-1",
    name: "Task",
    toolKind: "other",
    status: "completed",
    subagent: { description: "Map the runner code" },
  });
  vi.advanceTimersByTime(SESSION_UPDATE_MS);
  publish(item);
  expect(sent().filter((each) => each === "SessionList all")).toHaveLength(2);
});

/** Review focus 3: the same session open in two tabs. */
test("a take-back is published to every reader", async () => {
  const { app, adapter, sessions, repo } = await testServer();
  const sent = await mutate(
    app,
    "session.send",
    { folder: "2026-10-12-cli-tuis", text: "Plan it" },
    ["id", "turns"],
  );
  const { id, turns } = sent.data as { id: string; turns: Array<string> };
  await mutate(app, "session.send", { session: id, text: "Never mind" }, ["id"]);
  const message = adapter.sent[1]!.id;
  await new Promise((resolve) => setTimeout(resolve, SESSION_UPDATE_MS));
  const updates = published();

  const taken = await mutate(app, "session.takeBack", { session: id, message }, ["id"]);
  adapter.emit({ type: "cancelled", id: message });
  await new Promise((resolve) => setImmediate(resolve));

  expect(taken.ok).toBe(true);
  expect(updates()).toEqual(expect.arrayContaining([`Session ${id}`, `TurnLog ${turns[0]}:0`]));
  const [page] = await byId(app, "TurnLog", [`${turns[0]}:0`], ["id", "items"]);
  expect(page.items.map((item: { text?: string }) => item.text)).toEqual(["Plan it"]);
  await sessions.mainRoot(repo);
  sessions.stop(repo, id);
  await sessions.settled(Number(turns[0]));
});

/**
 * SC-002: a status change shows in an open page within a second. It is published at once: the
 * rest of the second is the margin for a loaded machine.
 */
test("SC-002: a session's status change reaches a subscribed SessionList within a second", async () => {
  const { app, adapter, sessions } = await testServer();
  const stream = await connect(app, "c2");
  expect(await stream.arrival("connected", 5000)).toBeDefined();
  await subscribe(app, "c2", { type: "SessionList", entityId: "all", select: ["id", "rows"] });
  const sent = await mutate(
    app,
    "session.send",
    { folder: "2026-10-12-cli-tuis", text: "Plan it" },
    ["id", "turns"],
  );
  const { turns } = sent.data as { turns: Array<string> };
  const before = stream.mark();

  const emitted = performance.now();
  adapter.emit({ type: "result", ok: true, errors: [], denials: [], interrupted: false });
  const arrived = await stream.arrival('"New reply"', 10_000, before);
  await stream.close();
  await sessions.settled(Number(turns[0]));

  expect(arrived, "no live update within 10 seconds").toBeDefined();
  expect(arrived! - emitted).toBeLessThan(1000);
}, 20_000);
