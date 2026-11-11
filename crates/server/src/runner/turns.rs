//! What the sessions write of a turn after it was added: its start, its end, its tokens, the
//! human's dismissal, and what a server that stopped while it ran leaves behind.

use std::time::SystemTime;

use rusqlite::{Connection, OptionalExtension};

use super::event::{Event, TokenCounts};
use super::log;
use super::store::{Store, StoreError, millis};
use super::turn::{self, NewTurn, Turn, TurnKind, TurnState};

/// How a turn ends: its state, and why.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TurnEnd {
    pub state: TurnState,
    pub reason: Option<String>,
}

impl TurnEnd {
    /// An end without a reason, as a turn that is done.
    pub fn of(state: TurnState) -> TurnEnd {
        TurnEnd {
            state,
            reason: None,
        }
    }

    /// An end that says why.
    pub fn because(state: TurnState, reason: impl Into<String>) -> TurnEnd {
        TurnEnd {
            state,
            reason: Some(reason.into()),
        }
    }
}

impl Store {
    /// The turn of an id, none when there is none.
    pub fn turn(&self, id: i64) -> Result<Option<Turn>, StoreError> {
        self.read(|db| {
            let mut read = db.prepare_cached("SELECT * FROM turns WHERE id = ?1")?;
            Ok(read.query_row([id], turn::turn).optional()?)
        })
    }

    /// Adds a turn with the first events of its log, as one write, or not at all: its id, and
    /// each event's place.
    pub fn begin_turn(
        &self,
        new: NewTurn,
        events: &[Event],
        at: SystemTime,
    ) -> Result<(i64, Vec<u64>), StoreError> {
        self.write(|db| begin(db, new, events, at))
    }

    /// Starts a queued turn, at `at`.
    pub fn start_turn(&self, id: i64, at: SystemTime) -> Result<(), StoreError> {
        self.write(|db| {
            let session = db
                .prepare_cached(
                    "UPDATE turns SET state = 'running', started_at = ?1 WHERE id = ?2
                     RETURNING session_id",
                )?
                .query_row((millis(at), id), |row| row.get::<_, String>(0))
                .optional()?;
            session.map_or(Ok(()), |session| touch(db, &session, at))
        })
    }

    /// Makes an ended turn run again, as its agent went on after it ended.
    pub fn reopen_turn(&self, id: i64, at: SystemTime) -> Result<(), StoreError> {
        self.write(|db| {
            let session = db
                .prepare_cached(
                    "UPDATE turns SET state = 'running', reason = NULL, ended_at = NULL
                     WHERE id = ?1 RETURNING session_id",
                )?
                .query_row([id], |row| row.get::<_, String>(0))
                .optional()?;
            session.map_or(Ok(()), |session| touch(db, &session, at))
        })
    }

    /// Ends a turn, at `at`.
    pub fn end_turn(&self, id: i64, end: &TurnEnd, at: SystemTime) -> Result<(), StoreError> {
        self.write(|db| {
            let session = db
                .prepare_cached(
                    "UPDATE turns SET state = ?1, reason = ?2, ended_at = ?3 WHERE id = ?4
                     RETURNING session_id",
                )?
                .query_row((end.state, &end.reason, millis(at), id), |row| {
                    row.get::<_, String>(0)
                })
                .optional()?;
            session.map_or(Ok(()), |session| touch(db, &session, at))
        })
    }

    /// Makes an ended turn, done or failed, stopped by the human, without a reason, as their
    /// Stop while its run waited outside the store: its agent's own wakeup, or a message's
    /// takeover of its wait. False for a turn in any other state, or dismissed.
    pub fn stop_ended(&self, id: i64) -> Result<bool, StoreError> {
        self.write(|db| {
            let changed = db
                .prepare_cached(
                    "UPDATE turns SET state = 'stopped', reason = NULL
                     WHERE id = ?1 AND state IN ('done', 'failed') AND dismissed_at IS NULL",
                )?
                .execute([id])?;
            Ok(changed > 0)
        })
    }

    /// Dismisses a failed or stopped turn, or a done one sent at `catch-up`, which stops on a
    /// conflict, so it no longer asks for the human, nor continues: false for a turn in any
    /// other state, or dismissed already.
    pub fn dismiss(&self, id: i64, at: SystemTime) -> Result<bool, StoreError> {
        self.write(|db| {
            let changed = db
                .prepare_cached(
                    "UPDATE turns SET dismissed_at = ?1, continue_at = NULL, continue_reason = NULL
                     WHERE id = ?2 AND dismissed_at IS NULL
                       AND (state IN ('failed', 'stopped')
                            OR (state = 'done' AND step = 'catch-up'))",
                )?
                .execute((millis(at), id))?;
            Ok(changed > 0)
        })
    }

    /// Makes a queued workflow turn a chat, which catches up with nothing, and writes its log
    /// again, whole: the only time a log changes, before its turn started. False for a turn
    /// that is no longer queued, which is left as it is.
    pub fn retype_queued(
        &self,
        id: i64,
        events: &[Event],
        at: SystemTime,
    ) -> Result<bool, StoreError> {
        self.write(|db| {
            let changed = db
                .prepare_cached(
                    "UPDATE turns SET kind = ?1, step = NULL, trigger = NULL, caught_up_to = NULL
                     WHERE id = ?2 AND state = 'queued'",
                )?
                .execute((TurnKind::Chat, id))?;
            if changed == 0 {
                return Ok(false);
            }
            db.prepare_cached("DELETE FROM events WHERE turn_id = ?1")?
                .execute([id])?;
            for event in events {
                log::add(db, id, millis(at), event)?;
            }
            Ok::<_, StoreError>(true)
        })
    }

    /// Marks every turn still running or queued as stopped with `reason`, and returns them, the
    /// oldest first: what a server that stopped, or was killed, left behind. One server owns
    /// the data folder, so none of them runs any more. Each ends at its last event, or at its
    /// start, else at `at`: a killed server may start again hours later.
    pub fn interrupted(&self, reason: &str, at: SystemTime) -> Result<Vec<Turn>, StoreError> {
        self.write(|db| {
            let mut stop = db.prepare_cached(
                "UPDATE turns SET state = 'stopped', reason = ?1, ended_at = COALESCE(
                   MAX((SELECT MAX(at) FROM events WHERE turn_id = turns.id), started_at),
                   (SELECT MAX(at) FROM events WHERE turn_id = turns.id), started_at, ?2)
                 WHERE state IN ('running', 'queued') RETURNING *",
            )?;
            let stopped = stop.query_map((reason, millis(at)), turn::turn)?;
            let mut stopped: Vec<Turn> = stopped.collect::<rusqlite::Result<_>>()?;
            stopped.sort_by_key(|turn| turn.id);
            Ok::<_, StoreError>(stopped)
        })
    }

    /// Adds the counts to the turn's own, a missing count read as 0.
    pub fn add_turn_tokens(&self, id: i64, counts: TokenCounts) -> Result<(), StoreError> {
        let count = |count: u64| i64::try_from(count).unwrap_or(i64::MAX);
        self.write(|db| {
            db.prepare_cached(
                "UPDATE turns SET input_tokens = COALESCE(input_tokens, 0) + ?1,
                   cache_write_tokens = COALESCE(cache_write_tokens, 0) + ?2,
                   cache_read_tokens = COALESCE(cache_read_tokens, 0) + ?3,
                   output_tokens = COALESCE(output_tokens, 0) + ?4
                 WHERE id = ?5",
            )?
            .execute((
                count(counts.input),
                count(counts.cache_write),
                count(counts.cache_read),
                count(counts.output),
                id,
            ))?;
            Ok::<_, StoreError>(())
        })
    }

    /// The tokens of the session's current agent session: the sum of its turns since the latest
    /// whose log says a new one started, with one of `lines`, that turn included, or of all its
    /// turns.
    pub fn agent_session_tokens(
        &self,
        session: &str,
        lines: &[&str],
    ) -> Result<TokenCounts, StoreError> {
        self.read(|db| {
            let since: i64 = {
                let mut started = db.prepare_cached(
                    "SELECT e.turn_id, json_extract(e.data, '$.text') FROM events e
                     JOIN turns t ON t.id = e.turn_id
                     WHERE t.session_id = ?1 AND e.type = 'notice' ORDER BY e.turn_id DESC",
                )?;
                let notices = started.query_map([session], |row| {
                    Ok((row.get::<_, i64>(0)?, row.get::<_, Option<String>>(1)?))
                })?;
                let notices: Vec<(i64, Option<String>)> =
                    notices.collect::<rusqlite::Result<_>>()?;
                let said = |(_, text): &&(i64, Option<String>)| {
                    text.as_deref().is_some_and(|text| lines.contains(&text))
                };
                notices.iter().find(said).map_or(0, |(turn, _)| *turn)
            };
            let mut sum = db.prepare_cached(
                "SELECT COALESCE(SUM(cache_read_tokens), 0), COALESCE(SUM(cache_write_tokens), 0),
                   COALESCE(SUM(input_tokens), 0), COALESCE(SUM(output_tokens), 0)
                 FROM turns WHERE session_id = ?1 AND id >= ?2",
            )?;
            Ok(sum.query_row((session, since), |row| {
                Ok(TokenCounts {
                    cache_read: row.get(0)?,
                    cache_write: row.get(1)?,
                    input: row.get(2)?,
                    output: row.get(3)?,
                })
            })?)
        })
    }

    /// Whether a turn of any session of the folder caught up with the default branch's
    /// `commit`: a catch-up runs once per tip.
    pub fn caught_up(&self, repo: &str, folder: &str, commit: &str) -> Result<bool, StoreError> {
        self.read(|db| {
            let mut caught = db.prepare_cached(
                "SELECT 1 FROM turns t JOIN sessions s ON s.id = t.session_id
                 WHERE s.repo = ?1 AND s.folder = ?2 AND t.caught_up_to = ?3 LIMIT 1",
            )?;
            Ok(caught.exists((repo, folder, commit))?)
        })
    }
}

/// Adds a turn and the first events of its log, inside a transaction: its id, and each event's
/// place.
pub(super) fn begin(
    db: &Connection,
    new: NewTurn,
    events: &[Event],
    at: SystemTime,
) -> Result<(i64, Vec<u64>), StoreError> {
    let started = (new.state == TurnState::Running).then_some(at);
    let session = new.session_id.clone();
    let id = turn::insert(db, &new_row(new, started), None)?;
    touch(db, &session, at)?;
    let places = events.iter().map(|event| {
        let added = log::add(db, id, millis(at), event)?;
        Ok::<_, StoreError>(added.seq)
    });
    Ok((id, places.collect::<Result<_, _>>()?))
}

/// A new turn's row, started at `started` when it runs.
fn new_row(new: NewTurn, started: Option<SystemTime>) -> Turn {
    Turn {
        // Taken from the store: the next one.
        id: 0,
        session_id: new.session_id,
        kind: new.kind,
        trigger: new.trigger,
        step: new.step,
        allowed: new.allowed,
        caught_up_to: new.caught_up_to,
        state: new.state,
        reason: None,
        started_at: started,
        ended_at: None,
        dismissed_at: None,
        continue_at: None,
        continue_reason: None,
        tokens: None,
    }
}

/// Records a change of a session's turns.
pub(super) fn touch(db: &Connection, session: &str, at: SystemTime) -> Result<(), StoreError> {
    db.prepare_cached("UPDATE sessions SET updated_at = ?1 WHERE id = ?2")?
        .execute((millis(at), session))?;
    Ok(())
}
