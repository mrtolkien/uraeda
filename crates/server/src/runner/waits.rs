//! The automatic continues the store holds: a turn that waits for its time to continue, one
//! that would have past the cap, and each session's count of continues in a row. Each check and
//! its write are one statement, or one transaction, so a decision the human made meanwhile
//! stands, and a continue is claimed once.

use std::time::SystemTime;

use rusqlite::OptionalExtension;

use super::event::Event;
use super::store::{Store, StoreError, millis};
use super::turn::{self, ContinueReason, NewTurn, Turn};
use super::turns;

impl Store {
    /// Sets when the turn's run continues by itself, and why: none for a run past the cap,
    /// which only says why it would have. Whether it did: only for a turn not decided yet nor
    /// dismissed, its session's latest but those stopped with the reason `taken_back`.
    pub fn decide_continue(
        &self,
        turn: i64,
        at: Option<SystemTime>,
        why: ContinueReason,
        taken_back: &str,
    ) -> Result<bool, StoreError> {
        self.write(|db| {
            let changed = db
                .prepare_cached(
                    "UPDATE turns SET continue_at = ?1, continue_reason = ?2
                     WHERE id = ?3 AND continue_reason IS NULL AND dismissed_at IS NULL
                       AND id = (SELECT MAX(id) FROM turns t
                                 WHERE t.session_id = turns.session_id
                                   AND NOT (t.state = 'stopped' AND t.reason IS ?4))",
                )?
                .execute((at.map(millis), why, turn, taken_back))?;
            Ok(changed > 0)
        })
    }

    /// Puts a continue back as it waited, after a message that took its place was refused:
    /// [`Store::decide_continue`].
    pub fn restore_continue(
        &self,
        turn: i64,
        at: SystemTime,
        why: ContinueReason,
        taken_back: &str,
    ) -> Result<bool, StoreError> {
        self.decide_continue(turn, Some(at), why, taken_back)
    }

    /// Moves the turn's waiting continue from `from` to `at`: whether it did, only while it
    /// still waits for `from`.
    pub fn move_continue(
        &self,
        turn: i64,
        from: SystemTime,
        at: SystemTime,
    ) -> Result<bool, StoreError> {
        self.write(|db| {
            let changed = db
                .prepare_cached(
                    "UPDATE turns SET continue_at = ?1 WHERE id = ?2 AND continue_at = ?3",
                )?
                .execute((millis(at), turn, millis(from)))?;
            Ok(changed > 0)
        })
    }

    /// Claims the turn's waiting continue, and returns the turn, its reason kept: none when no
    /// continue waited, or it was claimed or cancelled first.
    pub fn take_continue(&self, turn: i64) -> Result<Option<Turn>, StoreError> {
        self.write(|db| {
            let mut claim = db.prepare_cached(
                "UPDATE turns SET continue_at = NULL WHERE id = ?1 AND continue_at IS NOT NULL
                 RETURNING *",
            )?;
            Ok(claim.query_row([turn], turn::turn).optional()?)
        })
    }

    /// Clears the turn's continue, and its reason: whether a continue waited. With `stopped`, a
    /// waiting continue's turn becomes stopped without a reason, as the human's Stop does.
    pub fn cancel_continue(&self, turn: i64, stopped: bool) -> Result<bool, StoreError> {
        self.write(|db| {
            let waited = db
                .prepare_cached("SELECT 1 FROM turns WHERE id = ?1 AND continue_at IS NOT NULL")?
                .exists([turn])?;
            db.prepare_cached(
                "UPDATE turns SET continue_at = NULL, continue_reason = NULL WHERE id = ?1",
            )?
            .execute([turn])?;
            if waited && stopped {
                db.prepare_cached(
                    "UPDATE turns SET state = 'stopped', reason = NULL WHERE id = ?1",
                )?
                .execute([turn])?;
            }
            Ok(waited)
        })
    }

    /// Clears every waiting continue of a reason, as its setting turned off, and returns the
    /// turns, the oldest first.
    pub fn drop_continues(&self, why: ContinueReason) -> Result<Vec<Turn>, StoreError> {
        self.write(|db| {
            let mut dropped = db.prepare_cached(
                "UPDATE turns SET continue_at = NULL, continue_reason = NULL
                 WHERE continue_reason = ?1 AND continue_at IS NOT NULL RETURNING *",
            )?;
            let turns = dropped.query_map([why], turn::turn)?;
            let mut turns: Vec<Turn> = turns.collect::<rusqlite::Result<_>>()?;
            turns.sort_by_key(|turn| turn.id);
            Ok::<_, StoreError>(turns)
        })
    }

    /// Every turn whose continue waits, the soonest first.
    pub fn pending_continues(&self) -> Result<Vec<Turn>, StoreError> {
        self.read(|db| {
            let mut read = db.prepare_cached(
                "SELECT * FROM turns WHERE continue_at IS NOT NULL ORDER BY continue_at, id",
            )?;
            let turns = read.query_map([], turn::turn)?;
            Ok(turns.collect::<rusqlite::Result<_>>()?)
        })
    }

    /// The turns a server's stop cut since `since`, the oldest first: stopped with `reason`
    /// after they started, neither dismissed nor waiting, capped, or claimed for a continue.
    pub fn server_cuts(&self, reason: &str, since: SystemTime) -> Result<Vec<Turn>, StoreError> {
        self.read(|db| {
            let mut read = db.prepare_cached(
                "SELECT * FROM turns WHERE state = 'stopped' AND reason = ?1
                   AND started_at IS NOT NULL AND dismissed_at IS NULL
                   AND continue_reason IS NULL AND ended_at >= ?2 ORDER BY id",
            )?;
            let turns = read.query_map((reason, millis(since)), turn::turn)?;
            Ok(turns.collect::<rusqlite::Result<_>>()?)
        })
    }

    /// Whether a limit's continue waits for a time from `from`, before `to`.
    pub fn limit_continue_within(
        &self,
        from: SystemTime,
        to: SystemTime,
    ) -> Result<bool, StoreError> {
        self.read(|db| {
            let mut waits = db.prepare_cached(
                "SELECT 1 FROM turns WHERE continue_reason = 'limit' AND continue_at >= ?1
                   AND continue_at < ?2 LIMIT 1",
            )?;
            Ok(waits.exists((millis(from), millis(to)))?)
        })
    }

    /// Queues an automatic continue's turn with the first events of its log, and counts it for
    /// its session, as one write, or not at all: the turn's id, and each event's place.
    pub fn queue_continue(
        &self,
        new: NewTurn,
        events: &[Event],
        at: SystemTime,
    ) -> Result<(i64, Vec<u64>), StoreError> {
        self.write(|db| {
            let session = new.session_id.clone();
            let queued = turns::begin(db, new, events, at)?;
            db.prepare_cached("UPDATE sessions SET continues = continues + 1 WHERE id = ?1")?
                .execute([session])?;
            Ok::<_, StoreError>(queued)
        })
    }

    /// Sets the session's continues in a row: back to 0 for a commit or the human's message,
    /// or to what they were, as a refused message gives them back.
    pub fn set_continues(&self, session: &str, count: u32) -> Result<(), StoreError> {
        self.write(|db| {
            db.prepare_cached("UPDATE sessions SET continues = ?1 WHERE id = ?2")?
                .execute((count, session))?;
            Ok::<_, StoreError>(())
        })
    }
}
