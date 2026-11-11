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

/// The second step: an event that starts a line of the transcript says which one, `item`, from 0
/// in its turn, so a page of a transcript is found without reading the turn. The events
/// already there are numbered by the same rule as [`log`](super::log) numbers a new one: a
/// message, a tool call, a thought, a line, a blocked action, the first piece of a text, a whole
/// text no piece came before, and the first skipped line of a turn.
///
/// And an index by an event's kind, for what reads one kind of a turn: its blocked actions, its
/// last text.
const ITEMS: &str = "
ALTER TABLE events ADD COLUMN item INTEGER;
CREATE INDEX events_of_items ON events (turn_id, item) WHERE item IS NOT NULL;
CREATE INDEX events_by_type ON events (turn_id, type, seq);
UPDATE events SET item = numbered.item FROM (
  SELECT turn_id, seq, starts,
    SUM(starts) OVER (PARTITION BY turn_id ORDER BY seq) - 1 AS item
  FROM (
    SELECT e.turn_id, e.seq, CASE
      WHEN e.type IN ('message', 'toolStart', 'thought', 'notice', 'retry', 'denial') THEN 1
      WHEN e.type = 'textDelta' AND e.text_start = e.seq THEN 1
      WHEN e.type = 'text' AND COALESCE(
        (SELECT p.text_start IS NULL FROM events p
         WHERE p.turn_id = e.turn_id AND p.seq < e.seq AND p.text_bytes IS NOT NULL
         ORDER BY p.seq DESC LIMIT 1), 1) THEN 1
      WHEN e.type = 'skipped' AND NOT EXISTS (
        SELECT 1 FROM events s
        WHERE s.turn_id = e.turn_id AND s.seq < e.seq AND s.type = 'skipped') THEN 1
      ELSE 0 END AS starts
    FROM events e)
) AS numbered
WHERE numbered.turn_id = events.turn_id AND numbered.seq = events.seq AND numbered.starts = 1;
";

/// The schema's steps, in order: the store's number is how many it has taken.
const STEPS: &[&str] = &[FIRST, ITEMS];

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
