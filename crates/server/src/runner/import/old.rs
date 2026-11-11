//! The Node server's store, `runner.sqlite`, as the import reads it: its sessions, its turns, and
//! each turn's items, at its last schema. It is opened to read only.

use std::path::Path;
use std::time::{Duration, SystemTime};

use rusqlite::{Connection, OpenFlags, Row};

use super::lines;
use crate::runner::event::TokenCounts;
use crate::runner::session::Session;
use crate::runner::store::time;
use crate::runner::turn::Turn;

/// The schema of the Node server's store this import reads: its last. Its 13th step added a
/// session's account; its 14th, the scheduled jobs' runs, which this import does not read.
pub(super) const SCHEMA: u32 = 14;

/// The old store, read at one moment of it: what another process writes meanwhile is not read.
pub(super) struct Old(Connection);

/// A time the Node server wrote in ISO 8601, read as milliseconds since 1970 by SQLite itself.
fn ms(time: &str) -> String {
    format!("CAST(ROUND(unixepoch({time}, 'subsec') * 1000) AS INTEGER)")
}

/// A time of a row, none for a column that is empty or holds no time.
fn at(row: &Row, column: &str) -> rusqlite::Result<Option<SystemTime>> {
    Ok(row.get::<_, Option<i64>>(column)?.map(time))
}

impl Old {
    /// Opens the store to read only.
    pub(super) fn open(path: &Path) -> rusqlite::Result<Old> {
        let flags = OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX;
        let old = Connection::open_with_flags(path, flags)?;
        // The Node server may be writing it.
        old.busy_timeout(Duration::from_secs(5))?;
        old.execute_batch("BEGIN")?;
        Ok(Old(old))
    }

    /// The number of the store's schema.
    pub(super) fn schema(&self) -> rusqlite::Result<u32> {
        self.0
            .query_row("PRAGMA user_version", [], |row| row.get(0))
    }

    /// Every session, in the order they were made. Its `pid`, the Node server's process that
    /// held it, is not read: the new server holds none of them.
    pub(super) fn sessions(&self) -> rusqlite::Result<Vec<Session>> {
        let mut read = self.0.prepare(&format!(
            "SELECT id, repo, folder, parent, role, step, worktree, agent, native_id, title,
               model, effort, ran_model, ran_effort,
               CAST(automatic_continues AS INTEGER) AS continues, account,
               {} AS created_at, {} AS updated_at, {} AS seen_at, {} AS archived_at
             FROM sessions ORDER BY rowid",
            ms("created_at"),
            ms("updated_at"),
            ms("seen_at"),
            ms("archived_at")
        ))?;
        let sessions = read.query_map([], session)?;
        sessions.collect()
    }

    /// Every turn, the oldest first.
    pub(super) fn turns(&self) -> rusqlite::Result<Vec<Turn>> {
        let mut read = self.0.prepare(&format!(
            "SELECT id, session_id, kind, trigger, step, allowed, caught_up_to, state, reason,
               {} AS started_at, {} AS ended_at, {} AS dismissed_at,
               {} AS continue_at, continue_reason,
               CAST(input_tokens AS INTEGER) AS input,
               CAST(cache_write_tokens AS INTEGER) AS cache_write,
               CAST(cache_read_tokens AS INTEGER) AS cache_read,
               CAST(output_tokens AS INTEGER) AS output
             FROM turns ORDER BY id",
            ms("started_at"),
            ms("ended_at"),
            ms("dismissed_at"),
            // Already in milliseconds.
            "CAST(continue_at AS INTEGER)"
        ))?;
        let turns = read.query_map([], turn)?;
        turns.collect()
    }

    /// A turn's items, in order. One whose time cannot be read is dated `now`.
    pub(super) fn items(&self, turn: i64, now: i64) -> rusqlite::Result<Vec<lines::Row>> {
        let mut read = self.0.prepare_cached(&format!(
            "SELECT {} AS at, {} AS sent, kind, data FROM items WHERE turn_id = ?1 ORDER BY seq",
            ms("at"),
            ms("CASE WHEN json_valid(data) THEN json_extract(data, '$.at') END")
        ))?;
        let items = read.query_map([turn], |row| {
            Ok(lines::Row {
                at: row.get::<_, Option<i64>>("at")?.unwrap_or(now),
                sent: row.get("sent")?,
                kind: row.get("kind")?,
                data: row.get("data")?,
            })
        })?;
        items.collect()
    }
}

/// A session of the old store.
fn session(row: &Row) -> rusqlite::Result<Session> {
    let created = at(row, "created_at")?.unwrap_or(SystemTime::UNIX_EPOCH);
    Ok(Session {
        id: row.get("id")?,
        repo: row.get("repo")?,
        folder: row.get("folder")?,
        parent: row.get("parent")?,
        role: row.get("role")?,
        step: row.get("step")?,
        worktree: row.get("worktree")?,
        agent: row.get("agent")?,
        native_id: row.get("native_id")?,
        title: row.get("title")?,
        model: row.get("model")?,
        effort: row.get("effort")?,
        ran_model: row.get("ran_model")?,
        ran_effort: row.get("ran_effort")?,
        continues: row.get("continues")?,
        account: row.get("account")?,
        created_at: created,
        updated_at: at(row, "updated_at")?.unwrap_or(created),
        seen_at: at(row, "seen_at")?,
        archived_at: at(row, "archived_at")?,
    })
}

/// A turn of the old store.
fn turn(row: &Row) -> rusqlite::Result<Turn> {
    Ok(Turn {
        id: row.get("id")?,
        session_id: row.get("session_id")?,
        kind: row.get("kind")?,
        trigger: row.get("trigger")?,
        step: row.get("step")?,
        allowed: row.get("allowed")?,
        caught_up_to: row.get("caught_up_to")?,
        state: row.get("state")?,
        reason: row.get("reason")?,
        started_at: at(row, "started_at")?,
        ended_at: at(row, "ended_at")?,
        dismissed_at: at(row, "dismissed_at")?,
        continue_at: at(row, "continue_at")?,
        continue_reason: row.get("continue_reason")?,
        tokens: tokens(row)?,
    })
}

/// A turn's tokens, none when all four counts are: a missing count alone reads as 0.
fn tokens(row: &Row) -> rusqlite::Result<Option<TokenCounts>> {
    let count = |column: &str| row.get::<_, Option<u64>>(column);
    let counts = [
        count("cache_read")?,
        count("cache_write")?,
        count("input")?,
        count("output")?,
    ];
    if counts.iter().all(Option::is_none) {
        return Ok(None);
    }
    let [cache_read, cache_write, input, output] = counts.map(Option::unwrap_or_default);
    Ok(Some(TokenCounts {
        cache_read,
        cache_write,
        input,
        output,
    }))
}
