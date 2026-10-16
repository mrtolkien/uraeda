import { mkdirSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Changes } from "uraeda-binding";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { createFate, type LiveBus, live } from "../fate.ts";
import { publish, SESSION_UPDATE_MS, sessionPublisher } from "../live.ts";
import type { Host } from "../repositories.ts";
import { chatImages } from "../attach.ts";
import { SessionCache } from "../runner/cache.ts";
import { FakeAdapter } from "../runner/fake.ts";
import { ChatImages, UNSENT_KEPT_MS } from "../runner/images.ts";
import { startSessions } from "../server.ts";
import {
  byId,
  fixtureRepo,
  git,
  mutate,
  testApp,
  testDataDir,
  testHosts,
  testServer,
} from "./helpers.ts";
import { commitArrival, connect, statusArrival, subscribe } from "./live-stream.ts";

/** The core's binding, as one object: the server takes it whole. */
const binding = await import("uraeda-binding");

/**
 * US6.5: a commit on a feature's branch reaches a subscribed page. Its 2 seconds are measured by
 * `live.bench.ts`.
 */
test("a commit on a branch is sent to a live subscription", async () => {
  const { arrived } = await commitArrival();

  expect(arrived, "no live update within 10 seconds").toBeDefined();
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
 * the step, so the sidebar's list and the session are sent with the feature, and a commit may
 * change its branch's files.
 */
test("a feature's change through git is published to its session, its branch's changes, and the list", async () => {
  const repo = fixtureRepo();
  let watcher: ((changes: Changes) => void) | undefined;
  const capturing = {
    ...binding,
    watch: (path: string, callback: (changes: Changes) => void) => {
      watcher = callback;
      return binding.watch(path, () => {});
    },
  };
  const { hosts, names, sessions } = await testHosts([repo], { binding: capturing });
  const session = await sessions.featureSession(repo, "2026-10-12-cli-tuis");
  const sent = published(hosts.get(names[0])!.live);

  watcher!({
    decisions: false,
    features: ["2026-10-12-cli-tuis", "2026-10-11-web-ui"],
    files: [],
    inbox: false,
    priorities: false,
    workspace: false,
  });
  await vi.waitFor(() => expect(sent()).toContain(`Session ${session.id}`));

  expect(sent()).toEqual(
    expect.arrayContaining([
      "Feature 2026-10-12-cli-tuis",
      "BranchChanges 2026-10-12-cli-tuis",
      "Feature 2026-10-11-web-ui",
      "BranchChanges 2026-10-11-web-ui",
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
  const changes = {
    decisions: false,
    features: [],
    files: [],
    inbox: false,
    priorities: false,
    workspace: true,
  };

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
  // The clock runs, and jumps past the session's last update below.
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date", "setTimeout", "clearTimeout"] });
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
  // The sends' updates are out, and the take-back's goes at once.
  await vi.advanceTimersByTimeAsync(SESSION_UPDATE_MS);
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
 * SC-002: a session's status change reaches an open page, published at once. Its second is
 * measured by `live.bench.ts`.
 */
test("SC-002: a session's status change reaches a subscribed SessionList", async () => {
  const { arrived } = await statusArrival();

  expect(arrived, "no live update within 10 seconds").toBeDefined();
}, 20_000);

/** US6.2, SC-002: two repositories' views never mix. */
test("a change in one repository sends no update to another", async () => {
  const { hosts, names } = await testHosts([fixtureRepo(), fixtureRepo()], { installed: false });
  const [first, second] = names.map((name) => hosts.get(name)!);
  const heard = published(first.live);
  const changed = published(second.live);

  writeFileSync(join(second.path, "specs/PRIORITIES.md"), "# Priorities\n");
  await vi.waitFor(() => expect(changed()).toContain("Workspace workspace"), { timeout: 5000 });
  // A change of the first, after the second's: once it is heard, the second's would have been.
  git(first.path, "switch", "--quiet", "2026-10-12-cli-tuis");
  await vi.waitFor(() => expect(heard()).toContain("SessionList all"), { timeout: 5000 });

  // The switch's updates only: none of the second's priorities, and its one workspace update.
  expect(heard().filter((update) => update.startsWith("Priorities"))).toEqual([]);
  expect(heard().filter((update) => update === "Workspace workspace")).toHaveLength(1);
});

/** The inbox, written on the default branch, reaches its page, with the triage and the commit bar. */
test("a change of INBOX.md publishes the inbox, the priorities, and the triage", async () => {
  const { hosts, names } = await testHosts([fixtureRepo()], { installed: false });
  const host = hosts.get(names[0])!;
  const sent = published(host.live);

  writeFileSync(join(host.path, "specs/INBOX.md"), "# Inbox\n\n- A note\n");
  await vi.waitFor(() => expect(sent()).toContain("Inbox inbox"), { timeout: 5000 });

  expect(sent()).toEqual(
    expect.arrayContaining(["Priorities priorities", "WorkflowFile inbox-triage"]),
  );
});

/** US8: a decision edited on the default branch reaches the decisions page. */
test("a change of a decision publishes the ledger", async () => {
  const { hosts, names } = await testHosts([fixtureRepo()], { installed: false });
  const host = hosts.get(names[0])!;
  const sent = published(host.live);

  mkdirSync(join(host.path, "specs/decisions"), { recursive: true });
  writeFileSync(join(host.path, "specs/decisions/git.md"), "# Git\n\nA choice.\n");
  await vi.waitFor(() => expect(sent()).toContain("Ledger ledger"), { timeout: 5000 });
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

test("review focus 10: the server's start cleans chat images no session uses, older than a day", async () => {
  const dataDir = testDataDir();
  const images = chatImages(dataDir);
  const image = () =>
    images.save({ bytes: Buffer.from("RIFF....WEBP"), extension: "webp", height: 1, width: 2 });
  const [held, old, recent] = [await image(), await image(), await image()];
  const now = Date.now();
  const age = (id: string, ms: number) =>
    utimesSync(join(images.dir, id), (now - ms) / 1000, (now - ms) / 1000);
  age(held.id, UNSENT_KEPT_MS + 60_000);
  age(old.id, UNSENT_KEPT_MS + 60_000);
  age(recent.id, 60 * 60_000);
  // Another repository's message, which another server may run, holds an image.
  const cache = SessionCache.open(join(dataDir, "runner.sqlite"));
  const other = cache.createSession({
    agent: "fake",
    folder: null,
    nativeId: "n1",
    repo: "/another/repo",
    title: "Look",
  });
  const turn = cache.addTurn({
    allowed: null,
    kind: "chat",
    sessionId: other.id,
    state: "running",
    step: null,
    trigger: null,
  });
  cache.endTurn(turn, { state: "done" });
  cache.appendItem(turn, {
    id: "m1",
    images: [held],
    kind: "message",
    origin: "human",
    state: "read",
    text: "Look",
  });

  const { stop } = await startSessions({
    adapter: new FakeAdapter(),
    binding,
    dataDir,
    hosts: () => undefined,
  });
  await stop();

  expect(readdirSync(images.dir).sort()).toEqual([held.id, recent.id].sort());
});

test("review focus 10: a cleanup that fails is logged, and the server starts all the same", async () => {
  const dataDir = testDataDir();
  const clean = vi.spyOn(ChatImages.prototype, "clean").mockRejectedValueOnce(new Error("EACCES"));
  const logged = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

  try {
    const { stop } = await startSessions({
      adapter: new FakeAdapter(),
      binding,
      dataDir,
      hosts: () => undefined,
    });
    await stop();

    expect(clean).toHaveBeenCalledOnce();
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("EACCES"));
  } finally {
    clean.mockRestore();
    logged.mockRestore();
  }
});
