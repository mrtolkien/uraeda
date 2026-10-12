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
const migrations = [
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
];

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
 * losing it costs new sessions and the old logs. Nothing else opens the database.
 */
export class RunCache {
  #db: DatabaseSync;

  private constructor(db: DatabaseSync) {
    this.#db = db;
  }

  /**
   * Opens the database, creating its folder, and migrates it. A file that cannot be opened is
   * replaced with an empty database. `":memory:"` opens one that lives as long as the process.
   */
  static open(path: string): RunCache {
    if (path === ":memory:") {
      return new RunCache(migrate(new DatabaseSync(path)));
    }
    mkdirSync(dirname(path), { recursive: true });
    let db: DatabaseSync | undefined;
    try {
      db = new DatabaseSync(path);
      return new RunCache(migrate(db));
    } catch (error) {
      console.error(`The runner's cache could not be opened, so it starts empty: ${String(error)}`);
      db?.close();
      rmSync(path, { force: true });
      return new RunCache(migrate(new DatabaseSync(path)));
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
           started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?)`,
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

  /** Marks every run still `running` as stopped with the reason, and returns them. */
  interrupted(reason: string): Array<RunRow> {
    const rows = this.#db
      .prepare(
        `UPDATE runs SET state = 'stopped', reason = ?, ended_at = ? WHERE state = 'running'
         RETURNING *`,
      )
      .all(reason, now()) as Array<Row>;
    return rows.map(toRun).sort((a, b) => a.id - b.id);
  }
}

/** Applies the migrations the database has not run yet, in one transaction. */
function migrate(db: DatabaseSync): DatabaseSync {
  const { user_version: version } = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  if (version < migrations.length) {
    db.exec("BEGIN");
    try {
      for (const [index, sql] of migrations.entries()) {
        if (index >= version) {
          db.exec(sql);
        }
      }
      db.exec(`PRAGMA user_version = ${migrations.length}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  return db;
}
