//! What `/live` sends a screen, read from the browser's own record of the socket's frames: the
//! bytes from a navigation to its page drawn with its records, the largest message with its
//! record's name, what each message would weigh compressed, and how long the page waited for its
//! records' first values. A message whose large part is long comes in a binary frame, that part
//! compressed (the contract's "Frames"): a row says what went on the wire, and what the same
//! messages weigh as text, as they all went before task 69.

use std::collections::HashMap;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD;
use serde_json::Value;
use uraeda_protocol::unpack;
use uraeda_server::sandbox::LONG_CHAT;

use super::bench::{Timed, ms};

/// A frame of the app's socket: whether the page sent it, when, in the browser's clock, in
/// seconds, its bytes on the wire, and its message's text, a binary frame's unpacked.
pub struct Frame {
    pub sent: bool,
    pub at: f64,
    pub wire: usize,
    pub text: String,
}

impl Frame {
    fn message(&self) -> Value {
        serde_json::from_str(&self.text).unwrap_or(Value::Null)
    }
}

/// The socket's frames among what the page said.
pub fn frames(events: Vec<(String, Value)>) -> Vec<Frame> {
    events
        .into_iter()
        .filter_map(|(method, event)| {
            let sent = match method.as_str() {
                "Network.webSocketFrameSent" => true,
                "Network.webSocketFrameReceived" => false,
                _ => return None,
            };
            let payload = event["response"]["payloadData"]
                .as_str()
                .unwrap_or_default();
            // A binary frame's payload is in base64.
            let (wire, text) = if event["response"]["opcode"].as_u64() == Some(2) {
                let bytes = STANDARD.decode(payload).unwrap_or_default();
                let text = unpack(&bytes).unwrap_or_default();
                (bytes.len(), text)
            } else {
                (payload.len(), payload.to_owned())
            };
            Some(Frame {
                sent,
                at: event["timestamp"].as_f64().unwrap_or_default(),
                wire,
                text,
            })
        })
        .collect()
}

/// The records' names by their subscriptions' ids, and the actions' by their calls', as the page
/// asked for them: a change of a record subscribed before is named by an earlier `sub`.
#[derive(Default)]
pub struct Names(HashMap<u64, String>);

impl Names {
    /// Learns the names the page's `sub`s, `resume`s, and `call`s in `frames` gave their ids.
    pub fn learn(&mut self, frames: &[Frame]) {
        for frame in frames.iter().filter(|frame| frame.sent) {
            let message = frame.message();
            let named = match (message["record"].as_str(), message["action"].as_str()) {
                (Some(record), _) => Some(record.to_owned()),
                (None, Some(action)) => Some(format!("the action {action}")),
                (None, None) => None,
            };
            if let (Some(id), Some(named)) = (message["id"].as_u64(), named) {
                self.0.insert(id, named);
            }
        }
    }

    fn of(&self, message: &Value) -> String {
        let id = message["id"].as_u64();
        let name = id.and_then(|id| self.0.get(&id).cloned());
        let kind = message["type"].as_str().unwrap_or("?");
        format!(
            "{} ({kind})",
            name.unwrap_or_else(|| "no record".to_owned())
        )
    }
}

/// The table's head.
pub fn table() -> Vec<String> {
    vec![
        "| Screen | Settled | First frame | Waiting for first values | Records | Messages | Sent | As text | Largest message: sent, as text, record |".to_owned(),
        "| ------ | ------- | ----------- | ------------------------ | ------- | -------- | ---- | ------- | -------------------------------------- |".to_owned(),
    ]
}

/// A screen's row: what the server sent from the navigation to the page drawn with its records.
pub fn row(screen: &str, timed: &Timed, frames: &[Frame], names: &Names) -> String {
    let received: Vec<&Frame> = frames.iter().filter(|frame| !frame.sent).collect();
    let sent: usize = received.iter().map(|frame| frame.wire).sum();
    let text: usize = received.iter().map(|frame| frame.text.len()).sum();
    let largest = received.iter().max_by_key(|frame| frame.text.len());
    let largest = largest.map_or_else(
        || "none".to_owned(),
        |frame| {
            format!(
                "{}, {}, {}",
                kb(frame.wire),
                kb(frame.text.len()),
                names.of(&frame.message())
            )
        },
    );
    let (subs, waiting) = waiting(frames);
    let saved = if text == 0 {
        0.0
    } else {
        100.0 * (1.0 - sent as f64 / text as f64)
    };
    format!(
        "| {screen} | {} | {} | {} ({:.0}%) | {subs} | {} | {} ({saved:.0}% less) | {} | {largest} |",
        ms(timed.ms),
        ms(timed.first),
        ms(waiting),
        100.0 * waiting / timed.ms.max(1.0),
        received.len(),
        kb(sent),
        kb(text),
    )
}

/// How many records the page asked for, and how long from its first `sub` to the last of their
/// first values, in milliseconds.
fn waiting(frames: &[Frame]) -> (usize, f64) {
    let asked: Vec<(u64, f64)> = frames
        .iter()
        .filter(|frame| frame.sent)
        .filter_map(|frame| {
            let message = frame.message();
            let kind = message["type"].as_str()?;
            (kind == "sub" || kind == "resume").then(|| (message["id"].as_u64(), frame.at))
        })
        .filter_map(|(id, at)| Some((id?, at)))
        .collect();
    let Some(start) = asked.iter().map(|(_, at)| *at).reduce(f64::min) else {
        return (0, 0.0);
    };
    let last = frames
        .iter()
        .filter(|frame| !frame.sent)
        .filter(|frame| {
            let message = frame.message();
            let id = message["id"].as_u64();
            matches!(message["type"].as_str(), Some("data" | "error"))
                && asked.iter().any(|(asked, _)| Some(*asked) == id)
        })
        .map(|frame| frame.at)
        .fold(start, f64::max);
    (asked.len(), (last - start) * 1000.0)
}

fn kb(bytes: usize) -> String {
    if bytes < 1000 {
        format!("{bytes} B")
    } else {
        format!("{:.1} KB", bytes as f64 / 1000.0)
    }
}

/// The long chat's session id, when a record the server sent in `frames` names it.
pub fn long_chat(frames: &[Frame]) -> Option<String> {
    fn find(value: &Value) -> Option<String> {
        match value {
            Value::Object(fields) => {
                if fields.get("title").and_then(Value::as_str) == Some(LONG_CHAT)
                    && let Some(id) = fields.get("id").and_then(Value::as_str)
                {
                    return Some(id.to_owned());
                }
                fields.values().find_map(find)
            }
            Value::Array(items) => items.iter().find_map(find),
            _ => None,
        }
    }
    frames
        .iter()
        .filter(|frame| !frame.sent)
        .find_map(|frame| find(&frame.message()))
}
