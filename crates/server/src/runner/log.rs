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

    /// Whether a message of any session holds the chat image of this id, taken back or not: one
    /// that does is never deleted from the data folder.
    pub fn holds_image(&self, id: &str) -> Result<bool, StoreError> {
        self.read(|db| {
            let mut held = db.prepare_cached(
                "SELECT 1 FROM events, json_each(events.data, '$.images') AS image
                 WHERE events.type = 'message' AND json_extract(image.value, '$.id') = ?1
                 LIMIT 1",
            )?;
            Ok(held.exists([id])?)
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
    let item = match starts_line(db, turn, seq, event, text)? {
        true => Some(lines(db, turn)?),
        false => None,
    };
    db.prepare_cached(
        "INSERT INTO events (turn_id, seq, at, type, data, text_start, text_bytes, item)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )?
    .execute((turn, seq, at, kind, data.to_string(), start, bytes, item))?;
    Ok(Appended { seq, text })
}

/// Whether an event starts a line of the transcript, which a page counts: a message, a tool
/// call, a thought, a line, a blocked action, the first piece of a text, a whole text no piece
/// came before, and the first skipped line of its turn. Every other event changes a line that
/// is there, or shows nothing.
fn starts_line(
    db: &Connection,
    turn: i64,
    seq: u64,
    event: &Event,
    text: Option<Growth>,
) -> rusqlite::Result<bool> {
    Ok(match event {
        Event::Message { .. }
        | Event::ToolStart { .. }
        | Event::Thought { .. }
        | Event::Notice { .. }
        | Event::Retry { .. }
        | Event::Denial { .. } => true,
        Event::TextDelta { .. } => text.is_some_and(|text| text.start == seq),
        // A whole text ends the pieces before it, and is a line of its own without them.
        Event::Text { .. } => {
            let last: Option<Option<u64>> = db
                .prepare_cached(
                    "SELECT text_start FROM events
                     WHERE turn_id = ?1 AND text_bytes IS NOT NULL ORDER BY seq DESC LIMIT 1",
                )?
                .query_row([turn], |row| row.get(0))
                .optional()?;
            !matches!(last, Some(Some(_)))
        }
        Event::Skipped => !db
            .prepare_cached("SELECT 1 FROM events WHERE turn_id = ?1 AND type = 'skipped'")?
            .exists([turn])?,
        _ => false,
    })
}

/// How many lines a turn's transcript has: the number of its next one.
pub(super) fn lines(db: &Connection, turn: i64) -> rusqlite::Result<u64> {
    db.prepare_cached(
        "SELECT COALESCE(MAX(item) + 1, 0) FROM events WHERE turn_id = ?1 AND item IS NOT NULL",
    )?
    .query_row([turn], |row| row.get(0))
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
