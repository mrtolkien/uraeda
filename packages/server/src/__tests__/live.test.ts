import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vite-plus/test";
import * as binding from "uraeda-binding";
import { createFate, type LiveBus, live } from "../fate.ts";
import { publish, SESSION_UPDATE_MS, sessionPublisher } from "../live.ts";
import type { Host } from "../repositories.ts";
import { SessionCache } from "../runner/cache.ts";
import { byId, fixtureRepo, git, mutate, port, testApp, testHosts, testServer } from "./helpers.ts";

type App = Awaited<ReturnType<typeof testApp>>["app"];

/**
 * A live connection, its stream read as it comes. `arrival` gives the time a text first came in,
 * taken when its chunk was read: the time a test spends after it, cleaning up, is not counted.
 */
async function connect(app: App, name: string, connectionId: string) {
  const response = await app.request(
    `http://127.0.0.1:${port}/r/${name}/fate/live?connectionId=${connectionId}`,
    { headers: { accept: "text/event-stream" } },
  );
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let received = "";
  /** The length of the stream after each chunk, and when that chunk was read. */
  const chunks: Array<{ at: number; length: number }> = [];
  const waiting = new Set<() => void>();
  void (async () => {
    for (;;) {
      const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
      if (done) {
        return;
      }
      received += decoder.decode(value, { stream: true });
      chunks.push({ at: performance.now(), length: received.length });
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
    close: () => reader.cancel(),
    /** How much of the stream came so far: what a later `arrival` can start after. */
    mark: () => received.length,
  };
}

/** Subscribes a connection to an entity's live updates, on a repository's endpoint. */
async function subscribe(
  app: App,
  name: string,
  connectionId: string,
  entity: { entityId: string; select: Array<string>; type: string },
) {
  const response = await app.request(`http://127.0.0.1:${port}/r/${name}/fate/live`, {
    body: JSON.stringify({
      connectionId,
      operations: [{ id: "s1", kind: "subscribe", ...entity }],
      version: 1,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  expect(((await response.json()) as { results: Array<{ ok: boolean }> }).results[0].ok).toBe(true);
}

/**
 * US6.5: a commit on a feature's branch reaches a subscribed page within 2 seconds. The watcher
 * waits 200 ms of quiet, then reads the workspace: the rest of the budget is the margin for a
 * machine running the other test projects at the same time.
 */
test("a commit on a branch is sent to a live subscription within 2 seconds", async () => {
  const { app, hosts, name, repo } = await testApp();
  const stream = await connect(app, name, "c1");
  expect(await stream.arrival("connected", 5000)).toBeDefined();
  await subscribe(app, name, "c1", {
    entityId: "2026-10-12-cli-tuis",
    select: ["id", "files"],
    type: "Feature",
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
  hosts.close();
  await stream.close();

  expect(arrived, "no live update within 10 seconds").toBeDefined();
  expect(arrived! - committed).toBeLessThan(2000);
}, 20_000);

/**
 * A view reads its data, then subscribes: a change made between the two is sent at once, as the
 * subscription sends the data as it is when it starts, with no change made since.
 */
test("a subscription is sent its entity's data once it starts", async () => {
  const { app, name } = await testApp();
  const stream = await connect(app, name, "c3");
  expect(await stream.arrival("connected", 5000)).toBeDefined();
  await subscribe(app, name, "c3", {
    entityId: "2026-10-12-cli-tuis",
    select: ["id", "files"],
    type: "Feature",
  });

  const arrived = await stream.arrival("proposal.md", 5000);
  await stream.close();

  expect(arrived, "no data within 5 seconds of subscribing").toBeDefined();
});

/**
 * Each listed repository is watched once, however often the list is read again, so no change is
 * sent twice, and until it leaves the list.
 */
test("a repository is watched once, until it leaves the list", async () => {
  const repo = fixtureRepo();
  let watches = 0;
  const counting = {
    ...binding,
    watch: (...args: Parameters<typeof binding.watch>) => {
      watches++;
      return binding.watch(...args);
    },
  };
  const { dataDir, hosts, names } = await testHosts([repo], { binding: counting });

  await hosts.reload();
  expect(watches).toBe(1);

  await binding.removeRepository(dataDir, names[0]);
  await hosts.reload();
  await binding.addRepository(dataDir, repo);
  await hosts.reload();
  expect(watches).toBe(2);
});

/**
 * A feature's step changed through git, as a commit of its answers: its session's status reads
 * the step, so the sidebar's list and the session are sent with the feature.
 */
test("a feature's change through git is published to its session and the list", async () => {
  const repo = fixtureRepo();
  let watcher: ((changes: binding.Changes) => void) | undefined;
  const capturing = {
    ...binding,
    watch: (path: string, callback: (changes: binding.Changes) => void) => {
      watcher = callback;
      return binding.watch(path, () => {});
    },
  };
  const { hosts, names, sessions } = await testHosts([repo], { binding: capturing });
  const session = await sessions.featureSession(repo, "2026-10-12-cli-tuis");
  const sent = published(hosts.get(names[0])!.live);

  watcher!({
    features: ["2026-10-12-cli-tuis", "2026-10-11-web-ui"],
    files: [],
    priorities: false,
    workspace: false,
  });
  await vi.waitFor(() => expect(sent()).toContain(`Session ${session.id}`));

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
    agent: "fake",
    folder: "2026-10-12-cli-tuis",
    nativeId: "n",
    repo: "/repo",
    title: null,
  });
  const turn = cache.addTurn({
    allowed: null,
    kind: "chat",
    sessionId: session.id,
    state: "running",
    step: null,
    trigger: null,
  });
  for (let n = 0; n < items; n++) {
    cache.appendItem(turn, { kind: "text", streaming: false, text: `Line ${n}` });
  }
  return { cache, session: session.id, turn };
}

/** The live updates sent on a bus, as `<type> <id>`. */
function published(bus: LiveBus) {
  const update = vi.spyOn(bus, "update");
  return () => update.mock.calls.map(([type, id]) => `${type} ${String(id)}`);
}

/** A host of the repository at `path`, with its own bus, outside any list. */
function hostAt(path: string, name = "repo"): Host {
  const { fateServer, live } = createFate();
  return { fate: fateServer, live, missing: false, name, path };
}

/** Hosts holding `listed`, as the session publisher reads them. */
const hostsOf =
  (...listed: Array<Host>) =>
  () => ({
    all: () => listed,
    byPath: (path: string) => listed.find((host) => host.path === path),
  });

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test("a session's status change is published at once, with the list, its feature, and the workspace", () => {
  const { cache, session, turn } = sessionWithItems(150);
  const host = hostAt("/repo");
  const sent = published(host.live);
  const publish = sessionPublisher(cache, hostsOf(host));

  publish({ folder: "2026-10-12-cli-tuis", repo: "/repo", session, state: "done", turn });

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
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const host = hostAt("/repo");
  const update = vi.spyOn(host.live, "update");
  const changes = { features: [], files: [], priorities: false, workspace: true };

  publish(changes, host);
  publish(changes, host);

  const ids = update.mock.calls.map(([, , options]) => options?.eventId);
  expect(ids).toHaveLength(2);
  expect(ids[0]).not.toBe(ids[1]);
});

test("a chat's change is published without a feature, and the agent's on its own", () => {
  const { cache, session } = sessionWithItems(0);
  const host = hostAt("/repo");
  const sent = published(host.live);
  const publish = sessionPublisher(cache, hostsOf(host));

  publish({ folder: null, repo: "/repo", session });
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
  const host = hostAt("/repo");
  const sent = published(host.live);
  const publish = sessionPublisher(cache, hostsOf(host));
  const item = { folder: "2026-10-12-cli-tuis", repo: "/repo", session, turn };
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
  const host = hostAt("/repo");
  const sent = published(host.live);
  const publish = sessionPublisher(cache, hostsOf(host));
  const item = { folder: null, repo: "/repo", session, turn };

  publish(item);
  const seq = cache.appendItem(turn, {
    id: "task-1",
    kind: "tool",
    name: "Task",
    status: "in_progress",
    subagent: { description: "Map the runner code" },
    toolKind: "other",
  });
  vi.advanceTimersByTime(SESSION_UPDATE_MS);
  publish(item);
  expect(sent().filter((each) => each === "SessionList all")).toHaveLength(1);

  cache.updateItem(turn, seq, {
    id: "task-1",
    kind: "tool",
    name: "Task",
    status: "completed",
    subagent: { description: "Map the runner code" },
    toolKind: "other",
  });
  vi.advanceTimersByTime(SESSION_UPDATE_MS);
  publish(item);
  expect(sent().filter((each) => each === "SessionList all")).toHaveLength(2);
});

/** Review focus 3: the same session open in two tabs. */
test("a take-back is published to every reader", async () => {
  const { adapter, app, hosts, name, repo, sessions } = await testServer();
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
  const updates = published(hosts.get(name)!.live);

  const taken = await mutate(app, "session.takeBack", { message, session: id }, ["id"]);
  adapter.emit({ id: message, type: "cancelled" });
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
  const { adapter, app, name, sessions } = await testServer();
  const stream = await connect(app, name, "c2");
  expect(await stream.arrival("connected", 5000)).toBeDefined();
  await subscribe(app, name, "c2", {
    entityId: "all",
    select: ["id", "rows"],
    type: "SessionList",
  });
  const sent = await mutate(
    app,
    "session.send",
    { folder: "2026-10-12-cli-tuis", text: "Plan it" },
    ["id", "turns"],
  );
  const { turns } = sent.data as { turns: Array<string> };
  const before = stream.mark();

  const emitted = performance.now();
  adapter.emit({ denials: [], errors: [], interrupted: false, ok: true, type: "result" });
  const arrived = await stream.arrival('"New reply"', 10_000, before);
  await stream.close();
  await sessions.settled(Number(turns[0]));

  expect(arrived, "no live update within 10 seconds").toBeDefined();
  expect(arrived! - emitted).toBeLessThan(1000);
}, 20_000);

/** US6.2, SC-002: two repositories' views never mix. */
test("a change in one repository sends no update to another", async () => {
  const { hosts, names } = await testHosts([fixtureRepo(), fixtureRepo()], { installed: false });
  const [first, second] = names.map((name) => hosts.get(name)!);
  const heard = published(first.live);
  const changed = published(second.live);

  writeFileSync(join(second.path, "specs/PRIORITIES.md"), "# Priorities\n");
  await vi.waitFor(() => expect(changed()).toContain("Workspace workspace"), { timeout: 5000 });
  // Past the watcher's 200 ms quiet time, a change of the first would have come too.
  await new Promise((resolve) => setTimeout(resolve, 500));

  expect(heard()).toEqual([]);
});

test("a session's change goes to its repository's bus", () => {
  const { cache, session } = sessionWithItems(0);
  const [mine, other] = [hostAt("/repo"), hostAt("/other", "other")];
  const [sent, elsewhere, global] = [published(mine.live), published(other.live), published(live)];
  const publish = sessionPublisher(cache, hostsOf(mine, other));

  publish({ folder: null, repo: "/repo", session });

  expect(sent()).toContain(`Session ${session}`);
  expect([elsewhere(), global()]).toEqual([[], []]);
});

/** Review focus 3 */
test("a session's change in a removed repository is dropped", () => {
  vi.useFakeTimers();
  const { cache, session, turn } = sessionWithItems(1);
  const other = hostAt("/other", "other");
  const [elsewhere, global] = [published(other.live), published(live)];
  const publish = sessionPublisher(cache, hostsOf(other));
  const item = { folder: "2026-10-12-cli-tuis", repo: "/repo", session, turn };

  publish(item);
  publish(item);
  vi.advanceTimersByTime(SESSION_UPDATE_MS);
  publish({ ...item, state: "done" });

  expect([elsewhere(), global()]).toEqual([[], []]);
});
