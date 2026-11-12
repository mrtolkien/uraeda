//! How a server's message goes on the WebSocket: one text frame, or, when its large part is
//! long, one binary frame with that part compressed. The contract's "Frames" says it for a
//! client.
//!
//! A binary frame is the message's head, its JSON without its large part and with that part's
//! `size`, then a newline, then the part's JSON compressed with raw deflate (RFC 1951). The large
//! part is a `data`'s `value`, a `change`'s `ops`, and a `result`'s `output`. A change made of
//! appends alone, a reply's pieces, always stays text, and so does every other message.

use std::io::{Read as _, Write as _};

use flate2::Compression;
use flate2::read::DeflateDecoder;
use flate2::write::DeflateEncoder;
use serde::Serialize;
use serde_json::{Map, Value};

use crate::change::Op;
use crate::message::ServerMessage;

/// A part longer than this, in bytes of JSON, is sent compressed: 1 KB. Every message of task
/// 60's table above it shrinks by 63 to 91%, and the long chat's pages of 400 bytes only by 33%.
pub const PACK_ABOVE: usize = 1024;

/// The most a client inflates of one part, in bytes: 16 MiB, thirty times the largest value
/// measured, a `Ledger` of 532 KB. A frame that declares more, or holds more than it declares, is
/// refused before it is read.
pub const CEILING: usize = 16 * 1024 * 1024;

/// One frame of the WebSocket.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Frame {
    Text(String),
    Binary(Vec<u8>),
}

/// A message's large part, written once: every subscriber of one value is sent the same.
#[derive(Clone, Debug)]
pub enum Part {
    /// Its JSON, short enough to send as it is.
    Text(String),
    /// Its JSON compressed, and the JSON's length in bytes.
    Packed { size: usize, body: Vec<u8> },
}

impl Part {
    /// Writes a part: compressed when its JSON is longer than [`PACK_ABOVE`].
    ///
    /// # Panics
    ///
    /// Never: a part is JSON, and it is compressed in memory.
    pub fn of(part: &impl Serialize) -> Part {
        let text = serde_json::to_string(part).expect("a part is JSON");
        if text.len() <= PACK_ABOVE {
            return Part::Text(text);
        }
        let mut encoder = DeflateEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(text.as_bytes()).expect("in memory");
        let body = encoder.finish().expect("in memory");
        Part::Packed {
            size: text.len(),
            body,
        }
    }
}

/// A message with a large part, without it: its type and its numbers.
#[derive(Clone, Copy, Debug)]
pub enum Head {
    Data { id: u32, seq: u64 },
    Change { id: u32, seq: u64 },
    Result { id: u32 },
}

impl Head {
    /// Its JSON's fields, `"type":"data","id":1,"seq":40`, in the order serde writes the message
    /// in, and the name of its large part.
    fn fields(self) -> (String, &'static str) {
        match self {
            Head::Data { id, seq } => (format!(r#""type":"data","id":{id},"seq":{seq}"#), "value"),
            Head::Change { id, seq } => {
                (format!(r#""type":"change","id":{id},"seq":{seq}"#), "ops")
            }
            Head::Result { id } => (format!(r#""type":"result","id":{id}"#), "output"),
        }
    }
}

/// The frame of a message whose large part was written already.
///
pub fn framed(head: Head, part: &Part) -> Frame {
    let (fields, name) = head.fields();
    match part {
        Part::Text(text) => Frame::Text(format!(r#"{{{fields},"{name}":{text}}}"#)),
        Part::Packed { size, body } => {
            let mut bytes = format!(r#"{{{fields},"size":{size}}}"#).into_bytes();
            bytes.push(b'\n');
            bytes.extend_from_slice(body);
            Frame::Binary(bytes)
        }
    }
}

/// The frame of a message.
///
/// # Panics
///
/// Never: a message is JSON.
pub fn frame(message: &ServerMessage) -> Frame {
    let split = match message {
        ServerMessage::Data { id, seq, value } => {
            Some((Head::Data { id: *id, seq: *seq }, Part::of(value)))
        }
        ServerMessage::Change { id, seq, ops } if !ops.iter().all(Op::is_append) => {
            Some((Head::Change { id: *id, seq: *seq }, Part::of(ops)))
        }
        ServerMessage::Result { id, output } => Some((Head::Result { id: *id }, Part::of(output))),
        _ => None,
    };
    match split {
        Some((head, part)) => framed(head, &part),
        None => Frame::Text(serde_json::to_string(message).expect("a server message is JSON")),
    }
}

/// Why a client cannot read a binary frame: the `id` its head names, when it names one, and why,
/// for a person.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Unreadable {
    pub id: Option<u32>,
    pub why: String,
}

/// Reads a binary frame as a client does: the JSON text of its message, its part inflated. A part
/// is inflated only up to the size its head declares, and never past [`CEILING`].
///
/// # Errors
///
/// When the frame has no head, its head names no message with a large part, or its part is not
/// what the head declares, or not JSON: with the id the head names.
pub fn unpack(frame: &[u8]) -> Result<String, Unreadable> {
    let unreadable = |id, why: String| Unreadable { id, why };
    let Some(newline) = frame.iter().position(|byte| *byte == b'\n') else {
        return Err(unreadable(None, "a binary frame has no head".to_owned()));
    };
    let head: Map<String, Value> = serde_json::from_slice(&frame[..newline])
        .map_err(|error| unreadable(None, format!("a binary frame's head is not JSON: {error}")))?;
    let id = head
        .get("id")
        .and_then(Value::as_u64)
        .and_then(|id| u32::try_from(id).ok());
    let failed = |why: String| {
        unreadable(
            id,
            format!("The server sent a frame this app cannot read: {why}."),
        )
    };
    let name = match head.get("type").and_then(Value::as_str) {
        Some("data") => "value",
        Some("change") => "ops",
        Some("result") => "output",
        other => {
            return Err(failed(format!(
                "a `{}` is never compressed",
                other.unwrap_or("?")
            )));
        }
    };
    let size = head
        .get("size")
        .and_then(Value::as_u64)
        .and_then(|size| usize::try_from(size).ok())
        .ok_or_else(|| failed("its head declares no size".to_owned()))?;
    if size > CEILING {
        return Err(failed(format!(
            "it declares {size} bytes, more than the {CEILING} this app reads"
        )));
    }
    let mut text = Vec::with_capacity(size);
    DeflateDecoder::new(&frame[newline + 1..])
        .take(size as u64 + 1)
        .read_to_end(&mut text)
        .map_err(|error| failed(format!("its part does not inflate: {error}")))?;
    if text.len() != size {
        let than = if text.len() > size {
            "longer"
        } else {
            "shorter"
        };
        return Err(failed(format!(
            "its part is {than} than the {size} bytes it declares"
        )));
    }
    let text = String::from_utf8(text).map_err(|_| failed("its part is not JSON".to_owned()))?;
    serde_json::from_str::<serde::de::IgnoredAny>(&text)
        .map_err(|error| failed(format!("its part is not JSON: {error}")))?;
    let mut fields = head;
    fields.remove("size");
    let head = serde_json::to_string(&fields).expect("a head is JSON");
    let open = head.strip_suffix('}').expect("a head is an object");
    Ok(format!(r#"{open},"{name}":{text}}}"#))
}
