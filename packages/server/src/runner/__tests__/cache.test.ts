import { spawn } from "node:child_process";
import { once } from "node:events";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, onTestFinished, test, vi } from "vite-plus/test";
import { migrations, SessionCache } from "../cache.ts";
import { temporaryFolder } from "uraeda-binding/test-utils";

const REPO = "/repo/a";
const FOLDER = "2026-10-12-cli-tuis";

const feature = {
  repo: REPO,
  folder: FOLDER,
  agent: "claude",
  nativeId: "3f2c",
  title: null,
};

const chat = { ...feature, folder: null, title: "New chat" };

const workflowTurn = {
  kind: "workflow" as const,
  trigger: "manual" as const,
  step: "plan",
  allowed: null,
  state: "running" as const,
};

/** A pid no process has: above Linux's and macOS's highest. */
const DEAD_PID = 2 ** 31 - 1;

const tempPath = () => join(temporaryFolder("uraeda-cache"), "runner.sqlite");

test("a session keeps its fields, and their updates", () => {
  const cache = SessionCache.open(":memory:");

  const created = cache.createSession(feature);

  expect(created).toMatchObject({
    repo: REPO,
    folder: FOLDER,
    agent: "claude",
    nativeId: "3f2c",
    title: null,
    seenAt: null,
    archivedAt: null,
    pid: null,
  });
  expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(created.updatedAt).toBe(created.createdAt);
  expect(cache.session(created.id)).toEqual(created);
  expect(cache.featureSession(REPO, FOLDER)).toEqual(created);
  expect(cache.featureSession("/repo/b", FOLDER)).toBeUndefined();
  expect(cache.session("nope")).toBeUndefined();

  cache.updateSession(created.id, { nativeId: "9a9a", seenAt: "2026-10-13T10:00:00.000Z" });

  expect(cache.session(created.id)).toMatchObject({
    nativeId: "9a9a",
    title: null,
    seenAt: "2026-10-13T10:00:00.000Z",
  });
});

test("a feature has one session", () => {
  const cache = SessionCache.open(":memory:");
  cache.createSession(feature);

  expect(() => cache.createSession({ ...feature, nativeId: "9a9a" })).toThrow();
  expect(cache.createSession({ ...feature, repo: "/repo/b" })).toMatchObject({ repo: "/repo/b" });
});

test("a chat has no folder, and many are allowed", () => {
  const cache = SessionCache.open(":memory:");

  const first = cache.createSession(chat);
  const second = cache.createSession({ ...chat, nativeId: "9a9a" });

  expect(first.id).not.toBe(second.id);
  expect(cache.session(second.id)).toMatchObject({ folder: null, title: "New chat" });
});

test("a session's turns come back oldest first, with their start and end", () => {
  const cache = SessionCache.open(":memory:");
  const session = cache.createSession(feature);
  const first = cache.addTurn({ sessionId: session.id, ...workflowTurn });
  cache.endTurn(first, { state: "done" });
  const second = cache.addTurn({
    sessionId: session.id,
    kind: "chat",
    trigger: null,
    step: null,
    allowed: null,
    state: "queued",
  });

  expect(cache.turns(session.id).map((turn) => turn.id)).toEqual([first, second]);
  expect(cache.turn(first)).toMatchObject({
    sessionId: session.id,
    kind: "workflow",
    trigger: "manual",
    step: "plan",
    state: "done",
    reason: null,
    startedAt: expect.any(String),
    endedAt: expect.any(String),
  });
  expect(cache.turn(second)).toMatchObject({ state: "queued", startedAt: null, endedAt: null });

  cache.startTurn(second);
  cache.endTurn(second, { state: "failed", reason: "Rate limit reached" });

  expect(cache.turn(second)).toMatchObject({
    state: "failed",
    reason: "Rate limit reached",
    startedAt: expect.any(String),
  });
  expect(cache.turn(second + 1)).toBeUndefined();
});

test("a turn's start and end bump its session's updatedAt", () => {
  const cache = SessionCache.open(":memory:");
  const session = cache.createSession(feature);

  const id = cache.addTurn({ sessionId: session.id, ...workflowTurn, state: "queued" });
  const added = cache.session(session.id)!.updatedAt;
  cache.startTurn(id);
  expect(cache.session(session.id)!.updatedAt).toBe(cache.turn(id)!.startedAt);
  expect(added >= session.updatedAt).toBe(true);

  cache.endTurn(id, { state: "done" });

  expect(cache.session(session.id)!.updatedAt).toBe(cache.turn(id)!.endedAt);
});

test("a turn's items come back in order, a tool updated in place", () => {
  const cache = SessionCache.open(":memory:");
  const id = cache.addTurn({ sessionId: cache.createSession(feature).id, ...workflowTurn });

  expect(
    cache.appendItem(id, { kind: "text", text: "Reading the answers", streaming: false }),
  ).toBe(0);
  const tool = {
    kind: "tool" as const,
    id: "toolu_1",
    name: "Bash",
    toolKind: "execute" as const,
    target: "vp run ready",
  };
  const seq = cache.appendItem(id, { ...tool, status: "in_progress" });
  expect(seq).toBe(1);
  cache.updateItem(id, seq, { ...tool, status: "completed", durationMs: 2500, output: "ok" });

  expect(cache.items(id, 0, 100)).toEqual([
    { seq: 0, kind: "text", text: "Reading the answers", streaming: false },
    { seq: 1, ...tool, status: "completed", durationMs: 2500, output: "ok" },
  ]);
  expect(cache.items(id, 1, 100).map((item) => item.seq)).toEqual([1]);
  expect(cache.itemCount(id)).toBe(2);
});

test("a turn's items of one kind come back alone, with their seq", () => {
  const cache = SessionCache.open(":memory:");
  const id = cache.addTurn({ sessionId: cache.createSession(feature).id, ...workflowTurn });
  cache.appendItem(id, { kind: "text", text: "Opening the pull request", streaming: false });
  cache.appendItem(id, {
    kind: "denial",
    tool: "Bash",
    target: "gh pr create",
    rule: "Bash(gh pr create)",
    allowed: false,
  });

  expect(cache.itemsOf(id, "denial")).toEqual([
    {
      seq: 1,
      kind: "denial",
      tool: "Bash",
      target: "gh pr create",
      rule: "Bash(gh pr create)",
      allowed: false,
    },
  ]);
  expect(cache.itemsOf(id, "tool")).toEqual([]);
});

/** A chat whose one turn holds the item. */
function chatWith(
  cache: SessionCache,
  item: Parameters<SessionCache["appendItem"]>[1],
  repo = REPO,
) {
  const session = cache.createSession({ ...chat, repo });
  const turn = cache.addTurn({
    sessionId: session.id,
    kind: "chat",
    trigger: null,
    step: null,
    allowed: null,
    state: "running",
  });
  cache.appendItem(turn, item);
  return session.id;
}

const text = (text: string) => ({ kind: "text" as const, text, streaming: false });

test("search matches titles, folders, and message and text items, case-insensitively", () => {
  const cache = SessionCache.open(":memory:");
  const wal = chatWith(cache, text("the cache uses WAL mode"));
  const message = chatWith(cache, {
    kind: "message",
    id: "m1",
    text: "Why Wal?",
    origin: "human",
    state: "read",
  });
  const titled = cache.createSession({ ...chat, title: "Walking the tree" }).id;
  const folder = cache.createSession({ ...feature, folder: "2026-10-13-wal-mode" }).id;
  chatWith(cache, { kind: "system", text: "WAL" });
  chatWith(cache, {
    kind: "tool",
    id: "t",
    name: "Bash",
    toolKind: "execute",
    target: "wal",
    status: "completed",
  });
  chatWith(cache, text("nothing here"));

  const found = cache.sessions(REPO, { query: "wal" }).map((session) => session.id);

  expect(found.toSorted()).toEqual([wal, message, titled, folder].toSorted());
});

test("search matches its text literally", () => {
  const cache = SessionCache.open(":memory:");
  const percent = chatWith(cache, text("100% done"));
  chatWith(cache, text("1000 done"));
  const underscore = chatWith(cache, text("a_b"));
  chatWith(cache, text("axb"));
  const backslash = chatWith(cache, text("C:\\temp"));
  chatWith(cache, text("C:temp"));

  expect(cache.sessions(REPO, { query: "100%" }).map((session) => session.id)).toEqual([percent]);
  expect(cache.sessions(REPO, { query: "a_b" }).map((session) => session.id)).toEqual([underscore]);
  expect(cache.sessions(REPO, { query: "C:\\" }).map((session) => session.id)).toEqual([backslash]);
});

test("search stays in its repository", () => {
  const cache = SessionCache.open(":memory:");
  const ours = chatWith(cache, text("the cache uses WAL mode"));
  chatWith(cache, text("the cache uses WAL mode"), "/repo/b");
  cache.createSession({ ...feature, repo: "/repo/b" });

  expect(cache.sessions(REPO, { query: "wal" }).map((session) => session.id)).toEqual([ours]);
  expect(cache.sessions(REPO).map((session) => session.id)).toEqual([ours]);
});

test("sessions are newest first, at most 50", () => {
  vi.useFakeTimers({ now: new Date("2026-10-13T10:00:00.000Z") });
  onTestFinished(() => void vi.useRealTimers());
  const cache = SessionCache.open(":memory:");
  const ids = Array.from({ length: 52 }, () => {
    vi.advanceTimersByTime(1000);
    return cache.createSession(chat).id;
  });
  const bumped = ids[0];
  vi.advanceTimersByTime(1000);
  cache.addTurn({
    sessionId: bumped,
    kind: "chat",
    trigger: null,
    step: null,
    allowed: null,
    state: "running",
  });

  const listed = cache.sessions(REPO).map((session) => session.id);

  expect(listed).toHaveLength(50);
  expect(listed[0]).toBe(bumped);
  expect(listed.slice(1)).toEqual(ids.slice(3).toReversed());
  expect(cache.sessions(REPO, { limit: 2 })).toHaveLength(2);
});

test("a session is claimed by one live server", async () => {
  const path = tempPath();
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
  const holder = SessionCache.open(path, { pid: child.pid });
  const ours = SessionCache.open(path, { pid: process.pid });
  const id = holder.createSession(feature).id;

  expect(holder.claimSession(id)).toBe(true);
  expect(holder.claimSession(id)).toBe(true);
  expect(ours.claimSession(id)).toBe(false);
  expect(ours.session(id)?.pid).toBe(child.pid);

  child.kill();
  await once(child, "exit");

  expect(ours.claimSession(id)).toBe(true);
  expect(holder.claimSession(id)).toBe(false);
  ours.releaseSession(id);
  expect(ours.session(id)?.pid).toBeNull();
});

test("a session is released only by its holder", () => {
  const path = tempPath();
  const theirs = SessionCache.open(path, { pid: process.ppid });
  const id = theirs.createSession(feature).id;
  theirs.claimSession(id);

  SessionCache.open(path).releaseSession(id);

  expect(theirs.session(id)?.pid).toBe(process.ppid);
});

test("interrupted stops the running turns of gone servers", () => {
  const path = tempPath();
  // Another server: the process that started this test's runner is alive.
  const live = SessionCache.open(path, { pid: process.ppid });
  const theirs = live.createSession(feature);
  live.claimSession(theirs.id);
  const theirTurn = live.addTurn({ sessionId: theirs.id, ...workflowTurn });
  const gone = SessionCache.open(path, { pid: DEAD_PID });
  const dead = gone.createSession({ ...feature, folder: "2026-10-14-other" });
  gone.claimSession(dead.id);
  const done = gone.addTurn({ sessionId: dead.id, ...workflowTurn });
  gone.endTurn(done, { state: "done" });
  const deadTurn = gone.addTurn({ sessionId: dead.id, ...workflowTurn });
  const unclaimed = gone.createSession(chat);
  const unclaimedTurn = gone.addTurn({ sessionId: unclaimed.id, ...workflowTurn });
  const ours = SessionCache.open(path);

  const stopped = ours.interrupted("Stopped: the server stopped while it ran.");

  expect(stopped.map((turn) => turn.id)).toEqual([deadTurn, unclaimedTurn]);
  expect(stopped[0]).toMatchObject({
    state: "stopped",
    reason: "Stopped: the server stopped while it ran.",
    endedAt: expect.any(String),
  });
  expect(ours.turn(theirTurn)?.state).toBe("running");
  expect(ours.turn(done)?.state).toBe("done");
});

test("interrupted stops the queued turns of gone servers too, which would read as working", () => {
  const path = tempPath();
  const live = SessionCache.open(path, { pid: process.ppid });
  const theirs = live.createSession(feature);
  live.claimSession(theirs.id);
  live.addTurn({ sessionId: theirs.id, ...workflowTurn });
  const theirQueued = live.addTurn({ sessionId: theirs.id, ...workflowTurn, state: "queued" });
  const gone = SessionCache.open(path, { pid: DEAD_PID });
  const dead = gone.createSession({ ...feature, folder: "2026-10-14-other" });
  gone.claimSession(dead.id);
  const deadTurn = gone.addTurn({ sessionId: dead.id, ...workflowTurn });
  const deadQueued = gone.addTurn({ sessionId: dead.id, ...workflowTurn, state: "queued" });
  const ours = SessionCache.open(path);

  const stopped = ours.interrupted("Stopped: the server stopped while it ran.");

  expect(stopped.map((turn) => turn.id)).toEqual([deadTurn, deadQueued]);
  expect(ours.turn(deadQueued)).toMatchObject({
    state: "stopped",
    reason: "Stopped: the server stopped while it ran.",
    endedAt: expect.any(String),
  });
  expect(ours.turn(theirQueued)?.state).toBe("queued");
});

test("reopening the file keeps the sessions", () => {
  const path = join(temporaryFolder("uraeda-cache"), "new", "runner.sqlite");
  const id = SessionCache.open(path).createSession(feature).id;

  expect(SessionCache.open(path).session(id)).toMatchObject({ folder: FOLDER });
});

test("a cache that cannot be opened is created again empty", () => {
  const path = tempPath();
  writeFileSync(path, "not a database, but long enough to be read as one's header".repeat(4));

  const cache = SessionCache.open(path);

  expect(cache.sessions(REPO)).toEqual([]);
  expect(cache.createSession(feature)).toMatchObject({ folder: FOLDER });
});

/** A file an earlier version wrote, at version 2, in the default journal mode. */
function version2(path: string): DatabaseSync {
  const old = new DatabaseSync(path);
  old.exec(migrations[0] as string);
  old.exec(migrations[1] as string);
  old.exec("PRAGMA user_version = 2");
  return old;
}

test("a cache another process holds locked is kept, never replaced", () => {
  const path = tempPath();
  const other = version2(path);
  other.exec("BEGIN EXCLUSIVE");
  other.exec("CREATE TABLE lock (x)");

  // The lock outlasts the wait: this server keeps its sessions in memory.
  const cache = SessionCache.open(path, { timeout: 50 });
  expect(cache.createSession(feature)).toMatchObject({ folder: FOLDER });

  other.exec("ROLLBACK");
  other.close();
  expect(SessionCache.open(path).featureSession(REPO, FOLDER)).toBeUndefined();
  expect(new DatabaseSync(path).prepare("PRAGMA user_version").get()).toEqual({
    user_version: migrations.length,
  });
});

test("a cache in WAL mode reads while another connection writes", () => {
  const path = tempPath();
  const id = SessionCache.open(path).createSession(feature).id;
  const other = new DatabaseSync(path);
  other.exec("BEGIN EXCLUSIVE");
  other.exec("UPDATE sessions SET title = 'Renamed'");

  const cache = SessionCache.open(path, { timeout: 50 });

  expect(cache.session(id)).toMatchObject({ title: null });
  other.exec("COMMIT");
  expect(cache.session(id)).toMatchObject({ title: "Renamed" });
});

test("migration 4 drops the turns' costs", () => {
  const path = tempPath();
  SessionCache.open(path);

  const columns = new DatabaseSync(path).prepare("PRAGMA table_info(turns)").all();
  expect(columns.map((column) => column.name)).not.toContain("cost_usd");
});

test("migration 3 turns each feature's runs into the turns of one session", () => {
  const path = tempPath();
  const old = version2(path);
  const run = old.prepare(
    `INSERT INTO runs (repo, folder, session_id, new_session, trigger, step, allowed, state,
       cost_usd, started_at, ended_at)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const event = old.prepare(
    "INSERT INTO events (run_id, seq, at, kind, data) VALUES (?, 0, '2026-10-12T10:00:00.000Z', ?, ?)",
  );
  const first = Number(
    run.run(
      REPO,
      "f",
      "aaaa",
      "manual",
      "plan",
      null,
      "done",
      1.5,
      "2026-10-12T10:00:00.000Z",
      "2026-10-12T10:05:00.000Z",
    ).lastInsertRowid,
  );
  event.run(first, "text", JSON.stringify({ text: "Planning" }));
  const second = Number(
    run.run(
      REPO,
      "f",
      "bbbb",
      "answers",
      "spec",
      null,
      "failed",
      2.5,
      "2026-10-12T11:00:00.000Z",
      "2026-10-12T11:05:00.000Z",
    ).lastInsertRowid,
  );
  event.run(second, "system", JSON.stringify({ text: "Started a new session" }));
  const allow = Number(
    run.run(
      REPO,
      "f",
      "bbbb",
      "allow",
      "spec",
      "Bash(gh pr create)",
      "done",
      3,
      "2026-10-12T12:00:00.000Z",
      "2026-10-12T12:05:00.000Z",
    ).lastInsertRowid,
  );
  run.run(
    "/repo/b",
    "f",
    "cccc",
    "manual",
    "plan",
    null,
    "running",
    null,
    "2026-10-12T13:00:00.000Z",
    null,
  );
  old
    .prepare("INSERT INTO sessions (repo, folder, session_id, created_at) VALUES (?, ?, ?, ?)")
    .run(REPO, "f", "bbbb", "2026-10-12T11:00:00.000Z");
  old
    .prepare("INSERT INTO sessions (repo, folder, session_id, created_at) VALUES (?, ?, ?, ?)")
    .run(REPO, "g", "dddd", "2026-10-12T09:00:00.000Z");
  old.close();

  const cache = SessionCache.open(path);
  const session = cache.featureSession(REPO, "f")!;

  expect(session).toMatchObject({
    repo: REPO,
    folder: "f",
    agent: "claude",
    nativeId: "bbbb",
    title: null,
    pid: null,
    createdAt: "2026-10-12T10:00:00.000Z",
    updatedAt: "2026-10-12T12:05:00.000Z",
  });
  expect(cache.turns(session.id)).toEqual([
    {
      id: first,
      sessionId: session.id,
      kind: "workflow",
      trigger: "manual",
      step: "plan",
      allowed: null,
      state: "done",
      reason: null,
      startedAt: "2026-10-12T10:00:00.000Z",
      endedAt: "2026-10-12T10:05:00.000Z",
    },
    expect.objectContaining({ id: second, kind: "workflow", trigger: "answers", step: "spec" }),
    expect.objectContaining({
      id: allow,
      kind: "allow",
      trigger: null,
      allowed: "Bash(gh pr create)",
    }),
  ]);
  expect(cache.items(first, 0, 10)).toEqual([{ seq: 0, kind: "text", text: "Planning" }]);
  expect(cache.items(second, 0, 10)).toEqual([
    { seq: 0, kind: "system", text: "Started a new session" },
  ]);
  expect(cache.featureSession("/repo/b", "f")).toMatchObject({ nativeId: "cccc" });
  expect(cache.featureSession(REPO, "g")).toMatchObject({
    nativeId: "dddd",
    createdAt: "2026-10-12T09:00:00.000Z",
  });
  expect(cache.turns(cache.featureSession(REPO, "g")!.id)).toEqual([]);
  expect(cache.interrupted("Stopped: the server stopped while it ran.")).toHaveLength(1);
  // Opened again, the migrated file is not migrated twice.
  expect(
    SessionCache.open(path)
      .turns(session.id)
      .map((turn) => turn.id),
  ).toEqual([first, second, allow]);
});
