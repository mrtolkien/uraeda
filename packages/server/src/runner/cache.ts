// oxlint-disable max-lines -- over the limit before the code quality decision: the migrations in a module of their own
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Item, Trigger, TurnKind, TurnState } from "./events.ts";

/** A session, as the cache keeps it. */
export type SessionRow = {
  /** The agent's kind: `claude`. */
  agent: string;
  archivedAt: string | null;
  createdAt: string;
  /** The feature's folder, null for a chat. */
  folder: string | null;
  /** Uraeda's own ID, a UUID. */
  id: string;
  /** The agent's own session ID. */
  nativeId: string;
  /** The server process that holds the session's agent process, null when closed. */
  pid: number | null;
  /** The repository's main checkout. */
  repo: string;
  /** When the human last saw it ended. */
  seenAt: string | null;
  /** Null for a feature's session: its feature's name shows. */
  title: string | null;
  /** The last turn's start or end. */
  updatedAt: string;
};

/** A turn, as the cache keeps it: one message until the agent settles. */
export type TurnRow = {
  /** Allow turns: the allow rule. */
  allowed: string | null;
  endedAt: string | null;
  id: number;
  kind: TurnKind;
  /** Why it failed or stopped, in the UI's words. */
  reason: string | null;
  sessionId: string;
  startedAt: string | null;
  state: TurnState;
  /** Workflow turns: the core's step when it started. */
  step: string | null;
  /** Workflow turns: what started it. */
  trigger: Trigger | null;
};

/** A step of the schema: its SQL, or a function for a step that computes in TypeScript. */
type Migration = string | ((db: DatabaseSync) => void);

/**
 * Migration 3: sessions of turns and items, for every agent. Each feature's runs become the
 * turns of one session, keeping their IDs, and their events its items. A feature's session takes
 * its latest run's agent session, or else the one the old `sessions` table kept.
 */
function sessionsOfTurns(db: DatabaseSync): void {
  const features = db
    .prepare(
      `SELECT f.repo, f.folder,
         (SELECT session_id FROM runs r WHERE r.repo = f.repo AND r.folder = f.folder
          ORDER BY id DESC LIMIT 1) AS run_session,
         s.session_id AS saved_session,
         (SELECT MIN(started_at) FROM runs r WHERE r.repo = f.repo AND r.folder = f.folder)
           AS first_start,
         s.created_at AS saved_at,
         (SELECT MAX(COALESCE(ended_at, started_at)) FROM runs r
          WHERE r.repo = f.repo AND r.folder = f.folder) AS last_change
       FROM (SELECT repo, folder FROM runs UNION SELECT repo, folder FROM sessions) f
       LEFT JOIN sessions s ON s.repo = f.repo AND s.folder = f.folder`,
    )
    .all() as Array<Row>;
  db.exec(`DROP TABLE sessions;
    CREATE TABLE sessions (
      id          TEXT PRIMARY KEY,
      repo        TEXT NOT NULL,
      folder      TEXT,
      agent       TEXT NOT NULL,
      native_id   TEXT NOT NULL,
      title       TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      seen_at     TEXT,
      archived_at TEXT,
      pid         INTEGER
    );
    CREATE UNIQUE INDEX one_session_per_feature ON sessions (repo, folder)
      WHERE folder IS NOT NULL;
    CREATE TABLE turns (
      id         INTEGER PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions (id),
      kind       TEXT NOT NULL,
      trigger    TEXT,
      step       TEXT,
      allowed    TEXT,
      state      TEXT NOT NULL,
      reason     TEXT,
      cost_usd   REAL,
      started_at TEXT,
      ended_at   TEXT
    );
    CREATE INDEX turns_by_session ON turns (session_id, id);`);
  const insert = db.prepare(
    `INSERT INTO sessions (id, repo, folder, agent, native_id, title, created_at, updated_at,
       seen_at)
     VALUES (?, ?, ?, 'claude', ?, NULL, ?, ?, ?)`,
  );
  for (const feature of features) {
    const createdAt = feature.first_start ?? feature.saved_at;
    const updatedAt = feature.last_change ?? createdAt;
    // Seen when it last changed: the old runs do not all show as new replies.
    insert.run(
      randomUUID(),
      feature.repo,
      feature.folder,
      feature.run_session ?? feature.saved_session,
      createdAt,
      updatedAt,
      updatedAt,
    );
  }
  // "Allow and continue" was a trigger, and is a kind of turn. Items are recreated rather than
  // renamed, so that they reference turns, not the dropped runs.
  db.exec(`INSERT INTO turns (id, session_id, kind, trigger, step, allowed, state, reason, cost_usd,
      started_at, ended_at)
    SELECT r.id, s.id, CASE r.trigger WHEN 'allow' THEN 'allow' ELSE 'workflow' END,
      NULLIF(r.trigger, 'allow'), r.step, r.allowed, r.state, r.reason, r.cost_usd, r.started_at,
      r.ended_at
    FROM runs r JOIN sessions s ON s.repo = r.repo AND s.folder = r.folder;
    CREATE TABLE items (
      turn_id INTEGER NOT NULL REFERENCES turns (id),
      seq     INTEGER NOT NULL,
      at      TEXT NOT NULL,
      kind    TEXT NOT NULL,
      data    TEXT NOT NULL,
      PRIMARY KEY (turn_id, seq)
    );
    INSERT INTO items (turn_id, seq, at, kind, data)
      SELECT run_id, seq, at, kind, data FROM events;
    DROP TABLE events;
    DROP TABLE runs;`);
}

/** The schema, one migration per version: `PRAGMA user_version` is the number applied. */
export const migrations: Array<Migration> = [
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
  sessionsOfTurns,
  // Costs were the agent's own estimates, and are no longer shown.
  "ALTER TABLE turns DROP COLUMN cost_usd;",
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

const toSession = (row: Row): SessionRow => ({
  agent: String(row.agent),
  archivedAt: row.archived_at as string | null,
  createdAt: String(row.created_at),
  folder: row.folder as string | null,
  id: String(row.id),
  nativeId: String(row.native_id),
  pid: row.pid as number | null,
  repo: String(row.repo),
  seenAt: row.seen_at as string | null,
  title: row.title as string | null,
  updatedAt: String(row.updated_at),
});

const toTurn = (row: Row): TurnRow => ({
  allowed: row.allowed as string | null,
  endedAt: row.ended_at as string | null,
  id: Number(row.id),
  kind: row.kind as TurnKind,
  reason: row.reason as string | null,
  sessionId: String(row.session_id),
  startedAt: row.started_at as string | null,
  state: row.state as TurnState,
  step: row.step as string | null,
  trigger: row.trigger as Trigger | null,
});

const now = () => new Date().toISOString();

/** Splits an item into its kind and the JSON of its other fields. */
function stored(item: Item): [string, string] {
  const { kind, ...data } = item;
  return [kind, JSON.stringify(data)];
}

/** A `LIKE` pattern that matches the text anywhere, literally: `%`, `_`, and `\` escaped. */
const contains = (text: string) => `%${text.replaceAll(/[\\%_]/g, String.raw`\$&`)}%`;

/** How many sessions a list gives, by default. */
const SESSIONS_LIMIT = 50;

/** The session columns a write may change, by their field. */
const sessionColumns = {
  archivedAt: "archived_at",
  nativeId: "native_id",
  seenAt: "seen_at",
  title: "title",
} as const;

/**
 * The runner's cache of sessions, their turns, and the turns' items, in SQLite. It holds no
 * workflow state: losing it costs new sessions and the old transcripts. The servers of every
 * repository share the file, each from its own process: it is in WAL mode, and waits for another's
 * lock.
 */
export class SessionCache {
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
   * `":memory:"` opens one that lives as long as the process. Its sessions are claimed as `pid`'s,
   * this process by default.
   */
  static open(
    path: string,
    { pid = process.pid, timeout = TIMEOUT_MS }: { pid?: number; timeout?: number } = {},
  ): SessionCache {
    if (path === ":memory:") {
      return new SessionCache(migrate(new DatabaseSync(path)), pid);
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
      return new SessionCache(connect(), pid);
    } catch (error) {
      if (!corrupt(error)) {
        process.stderr.write(
          `The runner's cache could not be opened, so this server keeps its sessions in memory: ${String(error)}\n`,
        );
        return new SessionCache(migrate(new DatabaseSync(":memory:")), pid);
      }
      process.stderr.write(
        `The runner's cache could not be read, so it starts empty: ${String(error)}\n`,
      );
      for (const suffix of ["", "-wal", "-shm"]) {
        rmSync(path + suffix, { force: true });
      }
      return new SessionCache(connect(), pid);
    }
  }

  /** Records a new session, with a new ID. Throws when the feature has one already. */
  createSession(row: {
    agent: string;
    folder: string | null;
    nativeId: string;
    repo: string;
    title: string | null;
  }): SessionRow {
    const created = now();
    const inserted = this.#db
      .prepare(
        `INSERT INTO sessions (id, repo, folder, agent, native_id, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      )
      .get(
        randomUUID(),
        row.repo,
        row.folder,
        row.agent,
        row.nativeId,
        row.title,
        created,
        created,
      ) as Row;
    return toSession(inserted);
  }

  session(id: string): SessionRow | undefined {
    const row = this.#db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Row | undefined;
    return row ? toSession(row) : undefined;
  }

  /** The feature's one session. */
  featureSession(repo: string, folder: string): SessionRow | undefined {
    const row = this.#db
      .prepare("SELECT * FROM sessions WHERE repo = ? AND folder = ?")
      .get(repo, folder) as Row | undefined;
    return row ? toSession(row) : undefined;
  }

  /** Changes the session's fields that are given. */
  updateSession(
    id: string,
    fields: Partial<Pick<SessionRow, "nativeId" | "title" | "seenAt" | "archivedAt">>,
  ): void {
    const changed = (Object.keys(sessionColumns) as Array<keyof typeof sessionColumns>).filter(
      (field) => fields[field] !== undefined,
    );
    if (changed.length === 0) {
      return;
    }
    this.#db
      .prepare(
        `UPDATE sessions SET ${changed.map((field) => `${sessionColumns[field]} = ?`).join(", ")}
         WHERE id = ?`,
      )
      .run(...changed.map((field) => fields[field] ?? null), id);
  }

  /**
   * Claims the session for this process, before it opens the agent's process. Returns false when
   * another live process, a server of any repository, holds it: the check and the write are one
   * transaction, so two servers cannot both claim it.
   */
  claimSession(id: string): boolean {
    return transaction(this.#db, () => {
      const row = this.#db.prepare("SELECT pid FROM sessions WHERE id = ?").get(id) as
        | { pid: number | null }
        | undefined;
      if (!row || (row.pid !== null && row.pid !== this.#pid && alive(row.pid))) {
        return false;
      }
      this.#db.prepare("UPDATE sessions SET pid = ? WHERE id = ?").run(this.#pid, id);
      return true;
    });
  }

  /** Releases the session when this process holds it, once its agent's process closed. */
  releaseSession(id: string): void {
    this.#db.prepare("UPDATE sessions SET pid = NULL WHERE id = ? AND pid = ?").run(id, this.#pid);
  }

  /**
   * The repository's sessions, the last updated first. A query keeps those whose title, folder,
   * messages, or text hold it, ignoring case.
   */
  sessions(
    repo: string,
    { limit = SESSIONS_LIMIT, query }: { limit?: number; query?: string } = {},
  ): Array<SessionRow> {
    const rows = query
      ? (this.#db
          .prepare(
            `SELECT * FROM sessions s WHERE repo = ?1 AND (
               lower(s.title) LIKE lower(?2) ESCAPE '\\'
               OR lower(s.folder) LIKE lower(?2) ESCAPE '\\'
               OR EXISTS (
                 SELECT 1 FROM turns t JOIN items i ON i.turn_id = t.id
                 WHERE t.session_id = s.id AND i.kind IN ('message', 'text')
                   AND lower(json_extract(i.data, '$.text')) LIKE lower(?2) ESCAPE '\\'))
             ORDER BY updated_at DESC, rowid DESC LIMIT ?3`,
          )
          .all(repo, contains(query), limit) as Array<Row>)
      : (this.#db
          .prepare(
            "SELECT * FROM sessions WHERE repo = ? ORDER BY updated_at DESC, rowid DESC LIMIT ?",
          )
          .all(repo, limit) as Array<Row>);
    return rows.map(toSession);
  }

  /** Adds a turn to the session, and returns its ID. A running turn starts now. */
  addTurn(row: {
    allowed: string | null;
    kind: TurnKind;
    sessionId: string;
    state: "queued" | "running";
    step: string | null;
    trigger: Trigger | null;
  }): number {
    return transaction(this.#db, () => {
      const at = now();
      const { lastInsertRowid } = this.#db
        .prepare(
          `INSERT INTO turns (session_id, kind, trigger, step, allowed, state, started_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          row.sessionId,
          row.kind,
          row.trigger,
          row.step,
          row.allowed,
          row.state,
          row.state === "running" ? at : null,
        );
      this.#touch(row.sessionId, at);
      return Number(lastInsertRowid);
    });
  }

  /** Starts a queued turn. */
  startTurn(id: number): void {
    transaction(this.#db, () => {
      const at = now();
      const row = this.#db
        .prepare(
          "UPDATE turns SET state = 'running', started_at = ? WHERE id = ? RETURNING session_id",
        )
        .get(at, id) as { session_id: string } | undefined;
      if (row) {
        this.#touch(row.session_id, at);
      }
    });
  }

  /** Makes an ended turn run again, as its agent went on after it ended. */
  reopenTurn(id: number): void {
    transaction(this.#db, () => {
      const row = this.#db
        .prepare(
          `UPDATE turns SET state = 'running', reason = NULL, ended_at = NULL WHERE id = ?
           RETURNING session_id`,
        )
        .get(id) as { session_id: string } | undefined;
      if (row) {
        this.#touch(row.session_id, now());
      }
    });
  }

  /** Ends a turn. */
  endTurn(id: number, end: { reason?: string; state: TurnState }): void {
    transaction(this.#db, () => {
      const at = now();
      const row = this.#db
        .prepare(
          `UPDATE turns SET state = ?, reason = ?, ended_at = ? WHERE id = ? RETURNING session_id`,
        )
        .get(end.state, end.reason ?? null, at, id) as { session_id: string } | undefined;
      if (row) {
        this.#touch(row.session_id, at);
      }
    });
  }

  turn(id: number): TurnRow | undefined {
    const row = this.#db.prepare("SELECT * FROM turns WHERE id = ?").get(id) as Row | undefined;
    return row ? toTurn(row) : undefined;
  }

  /** The session's turns, oldest first. */
  turns(sessionId: string): Array<TurnRow> {
    const rows = this.#db
      .prepare("SELECT * FROM turns WHERE session_id = ? ORDER BY id")
      .all(sessionId) as Array<Row>;
    return rows.map(toTurn);
  }

  /** Adds an item at the end of the turn, and returns its `seq`. */
  appendItem(turnId: number, item: Item): number {
    const { seq } = this.#db
      .prepare("SELECT COALESCE(MAX(seq) + 1, 0) AS seq FROM items WHERE turn_id = ?")
      .get(turnId) as { seq: number };
    this.#db
      .prepare("INSERT INTO items (turn_id, seq, at, kind, data) VALUES (?, ?, ?, ?, ?)")
      .run(turnId, seq, now(), ...stored(item));
    return seq;
  }

  /** Replaces an item of the turn, like a tool call once its result arrives. */
  updateItem(turnId: number, seq: number, item: Item): void {
    this.#db
      .prepare("UPDATE items SET kind = ?, data = ? WHERE turn_id = ? AND seq = ?")
      .run(...stored(item), turnId, seq);
  }

  /** A page of the turn's items, in order. */
  items(turnId: number, offset: number, limit: number): Array<Item & { seq: number }> {
    const rows = this.#db
      .prepare("SELECT seq, kind, data FROM items WHERE turn_id = ? ORDER BY seq LIMIT ? OFFSET ?")
      .all(turnId, limit, offset) as Array<{ data: string; kind: string; seq: number }>;
    return rows.map(
      ({ data, kind, seq }) => ({ kind, seq, ...JSON.parse(data) }) as Item & { seq: number },
    );
  }

  /** The turn's items of one kind, in order, like its denials. */
  itemsOf<K extends Item["kind"]>(
    turnId: number,
    kind: K,
  ): Array<Extract<Item, { kind: K }> & { seq: number }> {
    const rows = this.#db
      .prepare("SELECT seq, data FROM items WHERE turn_id = ? AND kind = ? ORDER BY seq")
      .all(turnId, kind) as Array<{ data: string; seq: number }>;
    return rows.map(
      ({ data, seq }) =>
        ({ kind, seq, ...JSON.parse(data) }) as Extract<Item, { kind: K }> & { seq: number },
    );
  }

  /** The chat images the messages of every repository hold, by their IDs. */
  imagesInUse(): Set<string> {
    const rows = this.#db
      .prepare(
        `SELECT DISTINCT json_extract(image.value, '$.id') AS id
         FROM items, json_each(items.data, '$.images') AS image
         WHERE items.kind = 'message'`,
      )
      .all() as Array<{ id: string | null }>;
    return new Set(rows.flatMap(({ id }) => (id === null ? [] : [id])));
  }

  itemCount(turnId: number): number {
    const { count } = this.#db
      .prepare("SELECT COUNT(*) AS count FROM items WHERE turn_id = ?")
      .get(turnId) as { count: number };
    return count;
  }

  /**
   * Marks the turns still `running` or `queued` as stopped with the reason, and returns them, when
   * their session is held by no process, by this one, or by one that is gone: a queued turn left
   * behind would read as working forever. Another live server's turns, of any repository, keep
   * running.
   */
  interrupted(reason: string): Array<TurnRow> {
    return transaction(this.#db, () => {
      const running = this.#db
        .prepare(
          `SELECT t.id, s.pid FROM turns t JOIN sessions s ON s.id = t.session_id
           WHERE t.state IN ('running', 'queued')`,
        )
        .all() as Array<{ id: number; pid: number | null }>;
      const ended = now();
      const stop = this.#db.prepare(
        "UPDATE turns SET state = 'stopped', reason = ?, ended_at = ? WHERE id = ? RETURNING *",
      );
      return running
        .filter(({ pid }) => pid === null || pid === this.#pid || !alive(pid))
        .map(({ id }) => toTurn(stop.get(reason, ended, id) as Row))
        .sort((a, b) => a.id - b.id);
    });
  }

  /** Records a change of the session's turns. */
  #touch(sessionId: string, at: string): void {
    this.#db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(at, sessionId);
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
      for (const migration of migrations.slice(applied)) {
        if (typeof migration === "string") {
          db.exec(migration);
        } else {
          migration(db);
        }
      }
      db.exec(`PRAGMA user_version = ${migrations.length}`);
    });
  }
  return db;
}
