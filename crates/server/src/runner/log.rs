//! A turn's log: its events, in the order they were appended, and never changed after. A reply
//! streams as events appended, and a reader that fell behind asks for the log from a place.

use std::time::SystemTime;

use rusqlite::{Connection, OptionalExtension};
use serde_json::Value;

use super::event::Event;
use super::store::{Store, StoreError, millis, time};

/// An event of a turn's log.
#[derive(Clone, Debug, PartialEq)]
pub struct Logged {
    /// Its place in its turn's log, from 0: what names it, as an `allowed` names its `denial`.
    pub seq: u64,
    /// When it was appended.
    pub at: SystemTime,
    pub event: Event,
}

/// Where an event went.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Appended {
    /// Its place in its turn's log, from 0.
    pub seq: u64,
    /// For a piece of a text, a `textDelta`: the text it grew.
    pub text: Option<Growth>,
}

/// The text a piece was added to, as the live engine's `Bus::append` asks for it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Growth {
    /// The place of the text's first piece, which names the text: the piece's own for a first.
    pub start: u64,
    /// The text's length before the piece, in bytes.
    pub at: u64,
}

impl Store {
    /// Appends an event to a turn's log, at `at`, and says where it went. A piece of a text
    /// learns its text's length from the log's last row of a text, not from a read of the turn.
    ///
    /// # Errors
    ///
    /// When the turn does not exist, or the store cannot be written.
    pub fn append(
        &self,
        turn_id: i64,
        at: SystemTime,
        event: &Event,
    ) -> Result<Appended, StoreError> {
        self.write(|db| add(db, turn_id, millis(at), event))
    }

    /// A turn's events from the place `from`, in order: all of them from 0, none past the end.
    pub fn log(&self, turn_id: i64, from: u64) -> Result<Vec<Logged>, StoreError> {
        let from = i64::try_from(from).unwrap_or(i64::MAX);
        self.read(|db| {
            let mut read = db.prepare_cached(
                "SELECT seq, at, data FROM events WHERE turn_id = ?1 AND seq >= ?2 ORDER BY seq",
            )?;
            let rows = read.query_map((turn_id, from), |row| {
                Ok((row.get(0)?, row.get(1)?, row.get::<_, String>(2)?))
            })?;
            rows.map(|row| {
                let (seq, at, data) = row?;
                Ok(Logged {
                    seq,
                    at: time(at),
                    event: Event::parse(&data)?,
                })
            })
            .collect()
        })
    }
}

/// Appends an event to a turn's log, inside a transaction.
pub(super) fn add(
    db: &Connection,
    turn: i64,
    at: i64,
    event: &Event,
) -> Result<Appended, StoreError> {
    let seq: u64 = db
        .prepare_cached("SELECT COALESCE(MAX(seq) + 1, 0) FROM events WHERE turn_id = ?1")?
        .query_row([turn], |row| row.get(0))?;
    let data = serde_json::to_value(event)?;
    let kind = data.get("type").and_then(Value::as_str).unwrap_or_default();
    // What the row says of its text: where the text started, and its bytes after this row.
    let (text, start, bytes) = match event {
        Event::TextDelta { text } => {
            let grown = growth(db, turn, seq)?;
            (
                Some(grown),
                Some(grown.start),
                Some(grown.at + text.len() as u64),
            )
        }
        Event::Text { .. } => (None, None, Some(0)),
        _ => (None, None, None),
    };
    db.prepare_cached(
        "INSERT INTO events (turn_id, seq, at, type, data, text_start, text_bytes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )?
    .execute((turn, seq, at, kind, data.to_string(), start, bytes))?;
    Ok(Appended { seq, text })
}

/// The text a piece at `seq` grows: the one of the turn's last piece, unless a whole text ended
/// it, or else a new text, which starts with this piece.
fn growth(db: &Connection, turn: i64, seq: u64) -> rusqlite::Result<Growth> {
    let last = db
        .prepare_cached(
            "SELECT text_start, text_bytes FROM events
             WHERE turn_id = ?1 AND text_bytes IS NOT NULL ORDER BY seq DESC LIMIT 1",
        )?
        .query_row([turn], |row| {
            Ok((row.get::<_, Option<u64>>(0)?, row.get(1)?))
        })
        .optional()?;
    Ok(match last {
        Some((Some(start), at)) => Growth { start, at },
        _ => Growth { start: seq, at: 0 },
    })
}
