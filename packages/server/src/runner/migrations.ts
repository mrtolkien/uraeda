import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { Row } from "./cache-rows.ts";

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
  // Each turn's own tokens, null when the agent reported none, as for the turns before.
  `ALTER TABLE turns ADD COLUMN input_tokens INTEGER;
  ALTER TABLE turns ADD COLUMN cache_write_tokens INTEGER;
  ALTER TABLE turns ADD COLUMN cache_read_tokens INTEGER;
  ALTER TABLE turns ADD COLUMN output_tokens INTEGER;`,
];

/**
 * Runs `body` in a write transaction, taken before it reads: another process cannot write between
 * its reads and its writes.
 */
export function transaction<T>(db: DatabaseSync, body: () => T): T {
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
export function migrate(db: DatabaseSync): DatabaseSync {
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
