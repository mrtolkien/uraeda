import { mkdirSync, rmSync } from "node:fs";
import { dirname, posix, win32 } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { RunEvent, RunState, Trigger } from "./events.ts";

/**
 * Uraeda's data folder for the user: `URAEDA_DATA_DIR`, or else the operating system's default
 * for application data.
 */
export function dataDir(env: NodeJS.ProcessEnv, platform: NodeJS.Platform, home: string): string {
  if (env.URAEDA_DATA_DIR) {
    return env.URAEDA_DATA_DIR;
  }
  if (platform === "win32") {
    return win32.join(env.APPDATA || win32.join(home, "AppData", "Roaming"), "uraeda");
  }
  if (platform === "darwin") {
    return posix.join(home, "Library", "Application Support", "uraeda");
  }
  return posix.join(env.XDG_DATA_HOME || posix.join(home, ".local", "share"), "uraeda");
}

/** A run, as the cache keeps it. */
export type RunRow = {
  id: number;
  /** The repository's main checkout. */
  repo: string;
  folder: string;
  sessionId: string;
  /** Whether this run started the session. */
  newSession: boolean;
  trigger: Trigger;
  /** The core's step when the run started. */
  step: string;
  /** The allow rule of "Allow and continue". */
  allowed: string | null;
  state: RunState;
  /** Why it failed or stopped, in the UI's words. */
  reason: string | null;
  /** The latest result's cost: the session's total. */
  costUsd: number | null;
  startedAt: string;
  endedAt: string | null;
};

/** The schema, one migration per version: `PRAGMA user_version` is the number applied. */
export const migrations = [
  `CREATE TABLE sessions (
    repo       TEXT NOT NULL,
    folder     TEXT NOT NULL,
    session_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (repo, folder)
  );
  CREATE TABLE runs (
    id          INTEGER PRIMARY KEY,
    repo        TEXT NOT NULL,
    folder      TEXT NOT NULL,
    session_id  TEXT NOT NULL,
    new_session INTEGER NOT NULL,
    trigger     TEXT NOT NULL,
    step        TEXT NOT NULL,
    allowed     TEXT,
    state       TEXT NOT NULL,
    reason      TEXT,
    cost_usd    REAL,
    started_at  TEXT NOT NULL,
    ended_at    TEXT
  );
  CREATE INDEX runs_by_feature ON runs (repo, folder, id);
  CREATE TABLE events (
    run_id INTEGER NOT NULL REFERENCES runs(id),
    seq    INTEGER NOT NULL,
    at     TEXT NOT NULL,
    kind   TEXT NOT NULL,
    data   TEXT NOT NULL,
    PRIMARY KEY (run_id, seq)
  );`,
  // The process that runs it: servers of other repositories share the file.
  "ALTER TABLE runs ADD COLUMN pid INTEGER;",
];

/** How long a statement waits for another process's lock, by default. */
const TIMEOUT_MS = 5000;

/** SQLite's primary result codes for a file that is not a database, or a damaged one. */
const SQLITE_CORRUPT = 11;
const SQLITE_NOTADB = 26;

/** Whether an error says the file is damaged, not busy or locked by another process. */
function corrupt(error: unknown): boolean {
  const code = (error as { errcode?: unknown }).errcode;
  return typeof code === "number" && [SQLITE_CORRUPT, SQLITE_NOTADB].includes(code & 0xff);
}

/** Whether a process runs with the pid: `kill` with signal 0 sends nothing, and checks. */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: it runs, as another user.
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

type Row = Record<string, string | number | null>;

const toRun = (row: Row): RunRow => ({
  id: Number(row.id),
  repo: String(row.repo),
  folder: String(row.folder),
  sessionId: String(row.session_id),
  newSession: row.new_session === 1,
  trigger: row.trigger as Trigger,
  step: String(row.step),
  allowed: row.allowed as string | null,
  state: row.state as RunState,
  reason: row.reason as string | null,
  costUsd: row.cost_usd as number | null,
  startedAt: String(row.started_at),
  endedAt: row.ended_at as string | null,
});

const now = () => new Date().toISOString();

/** Splits an event into its kind and the JSON of its other fields. */
function stored(event: RunEvent): [string, string] {
  const { kind, ...data } = event;
  return [kind, JSON.stringify(data)];
}

/**
 * The runner's cache of sessions, runs, and their events, in SQLite. It holds no workflow state:
 * losing it costs new sessions and the old logs. The servers of every repository share the file,
 * each from its own process: it is in WAL mode, and waits for another's lock.
 */
export class RunCache {
  #db: DatabaseSync;
  #pid: number;

  private constructor(db: DatabaseSync, pid: number) {
    this.#db = db;
    this.#pid = pid;
  }

  /**
   * Opens the database, creating its folder, and migrates it. A file that is not a database, or a
   * damaged one, is replaced with an empty database. On any other error, like a lock held longer
   * than `timeout`, the file is kept, and the cache lives in memory as long as the process.
   * `":memory:"` opens one that lives as long as the process. Its runs are
   * recorded as `pid`'s, this process by default.
   */
  static open(
    path: string,
    { pid = process.pid, timeout = TIMEOUT_MS }: { pid?: number; timeout?: number } = {},
  ): RunCache {
    if (path === ":memory:") {
      return new RunCache(migrate(new DatabaseSync(path)), pid);
    }
    mkdirSync(dirname(path), { recursive: true });
    const connect = () => {
      const db = new DatabaseSync(path, { timeout });
      try {
        db.exec("PRAGMA journal_mode = WAL");
        return migrate(db);
      } catch (error) {
        db.close();
        throw error;
      }
    };
    try {
      return new RunCache(connect(), pid);
    } catch (error) {
      if (!corrupt(error)) {
        console.error(
          `The runner's cache could not be opened, so this server keeps its runs in memory: ${String(error)}`,
        );
        return new RunCache(migrate(new DatabaseSync(":memory:")), pid);
      }
      console.error(`The runner's cache could not be read, so it starts empty: ${String(error)}`);
      for (const suffix of ["", "-wal", "-shm"]) {
        rmSync(path + suffix, { force: true });
      }
      return new RunCache(connect(), pid);
    }
  }

  /** The feature's session ID. */
  session(repo: string, folder: string): string | undefined {
    const row = this.#db
      .prepare("SELECT session_id FROM sessions WHERE repo = ? AND folder = ?")
      .get(repo, folder) as Row | undefined;
    return row ? String(row.session_id) : undefined;
  }

  /** Records the feature's session, replacing the previous one. */
  saveSession(repo: string, folder: string, sessionId: string): void {
    this.#db
      .prepare(
        `INSERT INTO sessions (repo, folder, session_id, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (repo, folder) DO UPDATE SET session_id = excluded.session_id,
           created_at = excluded.created_at`,
      )
      .run(repo, folder, sessionId, now());
  }

  /** Writes a new running run, and returns its ID. */
  startRun(row: Omit<RunRow, "id" | "state" | "reason" | "costUsd" | "endedAt">): number {
    const { lastInsertRowid } = this.#db
      .prepare(
        `INSERT INTO runs (repo, folder, session_id, new_session, trigger, step, allowed, state,
           started_at, pid)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?, ?)`,
      )
      .run(
        row.repo,
        row.folder,
        row.sessionId,
        row.newSession ? 1 : 0,
        row.trigger,
        row.step,
        row.allowed,
        row.startedAt,
        this.#pid,
      );
    return Number(lastInsertRowid);
  }

  /** Adds an event at the end of the run's log, and returns its `seq`. */
  appendEvent(runId: number, event: RunEvent): number {
    const { seq } = this.#db
      .prepare("SELECT COALESCE(MAX(seq) + 1, 0) AS seq FROM events WHERE run_id = ?")
      .get(runId) as { seq: number };
    this.#db
      .prepare("INSERT INTO events (run_id, seq, at, kind, data) VALUES (?, ?, ?, ?, ?)")
      .run(runId, seq, now(), ...stored(event));
    return seq;
  }

  /** Replaces an event of the run's log, like a tool call once its result arrives. */
  updateEvent(runId: number, seq: number, event: RunEvent): void {
    this.#db
      .prepare("UPDATE events SET kind = ?, data = ? WHERE run_id = ? AND seq = ?")
      .run(...stored(event), runId, seq);
  }

  /** Ends a run. The cost is kept when the end gives none. */
  endRun(runId: number, end: { state: RunState; reason?: string; costUsd?: number }): void {
    this.#db
      .prepare(
        `UPDATE runs SET state = ?, reason = ?, cost_usd = COALESCE(?, cost_usd), ended_at = ?
         WHERE id = ?`,
      )
      .run(end.state, end.reason ?? null, end.costUsd ?? null, now(), runId);
  }

  run(id: number): RunRow | undefined {
    const row = this.#db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as Row | undefined;
    return row ? toRun(row) : undefined;
  }

  /** The feature's runs, newest first. */
  runs(repo: string, folder: string): Array<RunRow> {
    const rows = this.#db
      .prepare("SELECT * FROM runs WHERE repo = ? AND folder = ? ORDER BY id DESC")
      .all(repo, folder) as Array<Row>;
    return rows.map(toRun);
  }

  /** A page of the run's log, in order. */
  events(runId: number, offset: number, limit: number): Array<RunEvent & { seq: number }> {
    const rows = this.#db
      .prepare("SELECT seq, kind, data FROM events WHERE run_id = ? ORDER BY seq LIMIT ? OFFSET ?")
      .all(runId, limit, offset) as Array<{ seq: number; kind: string; data: string }>;
    return rows.map(
      ({ seq, kind, data }) => ({ seq, kind, ...JSON.parse(data) }) as RunEvent & { seq: number },
    );
  }

  /** The run's events of one kind, in order, like its denials. */
  eventsOf<Kind extends RunEvent["kind"]>(
    runId: number,
    kind: Kind,
  ): Array<Extract<RunEvent, { kind: Kind }> & { seq: number }> {
    const rows = this.#db
      .prepare("SELECT seq, kind, data FROM events WHERE run_id = ? AND kind = ? ORDER BY seq")
      .all(runId, kind) as Array<{ seq: number; kind: string; data: string }>;
    return rows.map(
      ({ seq, data }) =>
        ({ seq, kind, ...JSON.parse(data) }) as Extract<RunEvent, { kind: Kind }> & { seq: number },
    );
  }

  eventCount(runId: number): number {
    const { count } = this.#db
      .prepare("SELECT COUNT(*) AS count FROM events WHERE run_id = ?")
      .get(runId) as { count: number };
    return count;
  }

  /**
   * Marks the runs still `running` whose process is gone, or is this one, as stopped with the
   * reason, and returns them. Another live server's runs, of any repository, keep running.
   */
  interrupted(reason: string): Array<RunRow> {
    return transaction(this.#db, () => {
      const running = this.#db
        .prepare("SELECT id, pid FROM runs WHERE state = 'running'")
        .all() as Array<{ id: number; pid: number | null }>;
      const ended = now();
      const stop = this.#db.prepare(
        "UPDATE runs SET state = 'stopped', reason = ?, ended_at = ? WHERE id = ? RETURNING *",
      );
      return running
        .filter(({ pid }) => pid === null || pid === this.#pid || !alive(pid))
        .map(({ id }) => toRun(stop.get(reason, ended, id) as Row))
        .sort((a, b) => a.id - b.id);
    });
  }
}

/**
 * Runs `body` in a write transaction, taken before it reads: another process cannot write between
 * its reads and its writes.
 */
function transaction<T>(db: DatabaseSync, body: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = body();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** Applies the migrations the database has not run yet, in one transaction. */
function migrate(db: DatabaseSync): DatabaseSync {
  const version = () =>
    (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
  if (version() < migrations.length) {
    // Another process may have migrated it since.
    transaction(db, () => {
      const applied = version();
      for (const sql of migrations.slice(applied)) {
        db.exec(sql);
      }
      db.exec(`PRAGMA user_version = ${migrations.length}`);
    });
  }
  return db;
}
