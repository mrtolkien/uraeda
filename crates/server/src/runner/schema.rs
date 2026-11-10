//! The schema of `sessions.sqlite`, numbered: `PRAGMA user_version` is the number of the last
//! step applied. A change of the schema is a new step at the end of [`STEPS`], never an edit of
//! one: a store written by an earlier version takes the steps it lacks as it opens.

use rusqlite::Connection;

/// The first schema: sessions, their turns, and each turn's log of events.
///
/// - A time is the milliseconds since 1970, in UTC.
/// - `events` is only ever added to. A row is one event: `data` is its JSON, `type` its kind,
///   and `seq` its place in its turn, from 0.
/// - A row of a text says how long its text is: a piece, `textDelta`, has the place of the
///   text's first piece in `text_start`, and the text's bytes so far, its own included, in
///   `text_bytes`; a whole `text`, which ends the pieces, has no start and 0 bytes. Any other row
///   has neither. The next piece reads the last such row of its turn, through the index.
const FIRST: &str = "
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  repo        TEXT NOT NULL,
  folder      TEXT,
  parent      TEXT,
  role        TEXT,
  step        TEXT,
  worktree    TEXT,
  agent       TEXT NOT NULL,
  native_id   TEXT NOT NULL,
  title       TEXT,
  model       TEXT,
  effort      TEXT,
  ran_model   TEXT,
  ran_effort  TEXT,
  continues   INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  seen_at     INTEGER,
  archived_at INTEGER
) STRICT;
CREATE INDEX sessions_by_folder ON sessions (repo, folder);
CREATE INDEX sessions_by_parent ON sessions (parent) WHERE parent IS NOT NULL;
CREATE TABLE turns (
  id                 INTEGER PRIMARY KEY,
  session_id         TEXT NOT NULL REFERENCES sessions (id),
  kind               TEXT NOT NULL,
  trigger            TEXT,
  step               TEXT,
  allowed            TEXT,
  caught_up_to       TEXT,
  state              TEXT NOT NULL,
  reason             TEXT,
  started_at         INTEGER,
  ended_at           INTEGER,
  dismissed_at       INTEGER,
  continue_at        INTEGER,
  continue_reason    TEXT,
  input_tokens       INTEGER,
  cache_write_tokens INTEGER,
  cache_read_tokens  INTEGER,
  output_tokens      INTEGER
) STRICT;
CREATE INDEX turns_by_session ON turns (session_id, id);
CREATE TABLE events (
  turn_id    INTEGER NOT NULL REFERENCES turns (id),
  seq        INTEGER NOT NULL,
  at         INTEGER NOT NULL,
  type       TEXT NOT NULL,
  data       TEXT NOT NULL,
  text_start INTEGER,
  text_bytes INTEGER,
  PRIMARY KEY (turn_id, seq)
) STRICT, WITHOUT ROWID;
CREATE INDEX events_of_texts ON events (turn_id, seq) WHERE text_bytes IS NOT NULL;
";

/// The schema's steps, in order: the store's number is how many it has taken.
const STEPS: &[&str] = &[FIRST];

/// The number of the schema this version reads and writes.
pub(super) fn known() -> u32 {
    u32::try_from(STEPS.len()).unwrap_or(u32::MAX)
}

/// The number of the schema a store is at: 0 for a new file.
pub(super) fn found(db: &Connection) -> rusqlite::Result<u32> {
    db.query_row("PRAGMA user_version", [], |row| row.get(0))
}

/// Applies the steps a store lacks, in one transaction: all of them, or none.
pub(super) fn migrate(db: &mut Connection) -> rusqlite::Result<()> {
    let transaction = db.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
    let applied = found(&transaction)? as usize;
    for step in STEPS.iter().skip(applied) {
        transaction.execute_batch(step)?;
    }
    transaction.pragma_update(None, "user_version", known())?;
    transaction.commit()
}
