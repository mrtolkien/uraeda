import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vite-plus/test";
import { dataDir, migrations, RunCache } from "../cache.ts";

const REPO = "/repo/a";
const FOLDER = "2026-10-12-cli-tuis";

const run = {
  repo: REPO,
  folder: FOLDER,
  sessionId: "3f2c",
  newSession: true,
  trigger: "manual" as const,
  step: "plan",
  allowed: null,
  startedAt: "2026-10-12T10:00:00.000Z",
};

test.each([
  [{ URAEDA_DATA_DIR: "/data" }, "linux", "/data"],
  [{ XDG_DATA_HOME: "/xdg" }, "linux", "/xdg/uraeda"],
  [{}, "linux", "/home/me/.local/share/uraeda"],
  [{}, "darwin", "/home/me/Library/Application Support/uraeda"],
  [
    { APPDATA: "C:\\Users\\me\\AppData\\Roaming" },
    "win32",
    "C:\\Users\\me\\AppData\\Roaming\\uraeda",
  ],
])("the data folder for %o on %s is %s", (env, platform, expected) => {
  expect(dataDir(env, platform as NodeJS.Platform, "/home/me")).toBe(expected);
});

test("sessions are kept per repository and folder", () => {
  const cache = RunCache.open(":memory:");

  cache.saveSession(REPO, FOLDER, "3f2c");

  expect(cache.session(REPO, FOLDER)).toBe("3f2c");
  expect(cache.session("/repo/b", FOLDER)).toBeUndefined();
});

test("a saved session replaces the feature's previous one", () => {
  const cache = RunCache.open(":memory:");

  cache.saveSession(REPO, FOLDER, "3f2c");
  cache.saveSession(REPO, FOLDER, "9a9a");

  expect(cache.session(REPO, FOLDER)).toBe("9a9a");
});

test("a run's events come back in order, a tool event updated in place", () => {
  const cache = RunCache.open(":memory:");
  const id = cache.startRun(run);

  expect(cache.appendEvent(id, { kind: "text", text: "Reading the answers" })).toBe(0);
  const seq = cache.appendEvent(id, {
    kind: "tool",
    id: "toolu_1",
    name: "Bash",
    target: "vp run ready",
    status: "running",
  });
  expect(seq).toBe(1);
  cache.updateEvent(id, seq, {
    kind: "tool",
    id: "toolu_1",
    name: "Bash",
    target: "vp run ready",
    status: "complete",
    durationMs: 2500,
    output: "ok",
  });

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
  ]);
  expect(cache.events(id, 1, 100).map((event) => event.seq)).toEqual([1]);
  expect(cache.eventCount(id)).toBe(2);
});

test("a run's events of one kind come back alone, with their seq", () => {
  const cache = RunCache.open(":memory:");
  const id = cache.startRun(run);
  cache.appendEvent(id, { kind: "text", text: "Opening the pull request" });
  cache.appendEvent(id, {
    kind: "denial",
    tool: "Bash",
    target: "gh pr create",
    rule: "Bash(gh pr create)",
  });
  cache.appendEvent(id, { kind: "denial", tool: "WebFetch", rule: "WebFetch" });

  expect(cache.eventsOf(id, "denial")).toEqual([
    { seq: 1, kind: "denial", tool: "Bash", target: "gh pr create", rule: "Bash(gh pr create)" },
    { seq: 2, kind: "denial", tool: "WebFetch", rule: "WebFetch" },
  ]);
  expect(cache.eventsOf(id, "tool")).toEqual([]);
});

test("runs come back newest first, with their end", () => {
  const cache = RunCache.open(":memory:");
  const first = cache.startRun(run);
  cache.endRun(first, { state: "done", costUsd: 3.1 });
  const second = cache.startRun({ ...run, newSession: false, trigger: "allow", allowed: "Bash" });
  cache.startRun({ ...run, repo: "/repo/b" });

  const runs = cache.runs(REPO, FOLDER);

  expect(runs.map((row) => row.id)).toEqual([second, first]);
  expect(runs[1]).toMatchObject({
    id: first,
    repo: REPO,
    folder: FOLDER,
    sessionId: "3f2c",
    newSession: true,
    trigger: "manual",
    step: "plan",
    allowed: null,
    state: "done",
    reason: null,
    costUsd: 3.1,
    startedAt: "2026-10-12T10:00:00.000Z",
  });
  expect(runs[1].endedAt).toEqual(expect.any(String));
  expect(runs[0]).toMatchObject({
    newSession: false,
    trigger: "allow",
    allowed: "Bash",
    state: "running",
    costUsd: null,
    endedAt: null,
  });
});

test("a failed run keeps its reason", () => {
  const cache = RunCache.open(":memory:");
  const id = cache.startRun(run);

  cache.endRun(id, { state: "failed", reason: "Rate limit reached" });

  expect(cache.run(id)).toMatchObject({ state: "failed", reason: "Rate limit reached" });
  expect(cache.run(id + 1)).toBeUndefined();
});

test("reopening the file keeps the runs", () => {
  const path = join(mkdtempSync(join(tmpdir(), "uraeda-cache-")), "new", "runner.sqlite");
  const id = RunCache.open(path).startRun(run);

  expect(RunCache.open(path).run(id)).toMatchObject({ folder: FOLDER, state: "running" });
});

test("a cache that cannot be opened is created again empty", () => {
  const path = join(mkdtempSync(join(tmpdir(), "uraeda-cache-")), "runner.sqlite");
  writeFileSync(path, "not a database, but long enough to be read as one's header".repeat(4));

  const cache = RunCache.open(path);

  expect(cache.runs(REPO, FOLDER)).toEqual([]);
  expect(cache.run(cache.startRun(run))).toMatchObject({ state: "running" });
});

test("runs left running are marked stopped on startup", () => {
  const cache = RunCache.open(":memory:");
  const running = cache.startRun(run);
  const done = cache.startRun(run);
  cache.endRun(done, { state: "done" });

  const stopped = cache.interrupted("Stopped: the server stopped while it ran.");

  expect(stopped.map((row) => row.id)).toEqual([running]);
  expect(stopped[0]).toMatchObject({
    state: "stopped",
    reason: "Stopped: the server stopped while it ran.",
  });
  expect(cache.run(running)?.endedAt).toEqual(expect.any(String));
  expect(cache.run(done)?.state).toBe("done");
});

test("the schema is at version 2", () => {
  const path = join(mkdtempSync(join(tmpdir(), "uraeda-cache-")), "runner.sqlite");
  RunCache.open(path);

  const version = new DatabaseSync(path).prepare("PRAGMA user_version").get();

  expect(version).toEqual({ user_version: 2 });
});

/** A pid no process has: above Linux's and macOS's highest. */
const DEAD_PID = 2 ** 31 - 1;

const tempPath = () => join(mkdtempSync(join(tmpdir(), "uraeda-cache-")), "runner.sqlite");

test("a cache another process holds locked is kept, never replaced", () => {
  const path = tempPath();
  // A file an earlier version wrote, in the default journal mode: a lock blocks its readers.
  const other = new DatabaseSync(path);
  other.exec(migrations[0]);
  other.exec("PRAGMA user_version = 1");
  other
    .prepare(
      `INSERT INTO runs (repo, folder, session_id, new_session, trigger, step, state, started_at)
       VALUES (?, ?, '3f2c', 1, 'manual', 'plan', 'done', ?)`,
    )
    .run(REPO, FOLDER, run.startedAt);
  other.exec("BEGIN EXCLUSIVE");
  other.exec("UPDATE runs SET step = 'spec'");

  // The lock outlasts the wait: this server keeps its runs in memory.
  const cache = RunCache.open(path, { timeout: 50 });
  expect(cache.runs(REPO, FOLDER)).toEqual([]);
  expect(cache.run(cache.startRun(run))).toMatchObject({ state: "running" });

  other.exec("COMMIT");
  other.close();
  expect(RunCache.open(path).runs(REPO, FOLDER)).toMatchObject([{ step: "spec", state: "done" }]);
});

test("a cache in WAL mode reads while another connection writes", () => {
  const path = tempPath();
  const id = RunCache.open(path).startRun(run);
  const other = new DatabaseSync(path);
  other.exec("BEGIN EXCLUSIVE");
  other.exec("UPDATE runs SET step = 'spec'");

  const cache = RunCache.open(path, { timeout: 50 });

  expect(cache.run(id)).toMatchObject({ step: "plan" });
  other.exec("COMMIT");
  expect(cache.run(id)).toMatchObject({ step: "spec" });
});

test("a running run of another live process stays running", () => {
  const path = tempPath();
  // Another server: the process that started this test's runner is alive.
  const first = RunCache.open(path, { pid: process.ppid });
  const theirs = first.startRun(run);
  const second = RunCache.open(path);
  const ours = second.startRun(run);

  const stopped = second.interrupted("Stopped: the server stopped while it ran.");

  expect(stopped.map((row) => row.id)).toEqual([ours]);
  expect(first.run(theirs)?.state).toBe("running");
});

test("a running run of a process that is gone is marked stopped", () => {
  const path = tempPath();
  const id = RunCache.open(path, { pid: DEAD_PID }).startRun(run);

  const stopped = RunCache.open(path).interrupted("Stopped: the server stopped while it ran.");

  expect(stopped.map((row) => row.id)).toEqual([id]);
});

test("migrating from version 1 keeps the runs, and stops those left running", () => {
  const path = tempPath();
  const old = new DatabaseSync(path);
  old.exec(migrations[0]);
  old.exec("PRAGMA user_version = 1");
  const insert = old.prepare(
    `INSERT INTO runs (repo, folder, session_id, new_session, trigger, step, state, started_at)
     VALUES (?, ?, '3f2c', 1, 'manual', 'plan', ?, ?)`,
  );
  insert.run(REPO, FOLDER, "done", run.startedAt);
  insert.run(REPO, FOLDER, "running", run.startedAt);
  old.close();

  const cache = RunCache.open(path);
  const stopped = cache.interrupted("Stopped: the server stopped while it ran.");

  expect(stopped.map((row) => row.id)).toEqual([2]);
  expect(cache.runs(REPO, FOLDER).map((row) => [row.id, row.state])).toEqual([
    [2, "stopped"],
    [1, "done"],
  ]);
});
