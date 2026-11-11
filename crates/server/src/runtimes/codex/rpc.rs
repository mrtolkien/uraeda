//! The JSON-RPC channel of a `codex app-server` process, one JSON message per line both ways:
//! the requests the runtime writes and what each waits for, by their ids, and the requests
//! Codex writes to its client, each refused at once, so a turn never waits on a client that
//! does not answer.
//!
//! The channel reads and writes nothing itself: [`Rpc::request`] gives the line to write, and
//! [`Rpc::read`] says what a line read is. What waits for an answer is a value of the caller's,
//! `P`, given back with the answer, so answers are handled in the order their lines came.

use std::collections::BTreeMap;

use serde_json::{Value, json};

/// JSON-RPC's code for a method the receiver does not have.
const METHOD_NOT_FOUND: i32 = -32_601;

/// The answer to one of the runtime's requests: its result, or Codex's error in words.
pub(super) type Answer = Result<Value, String>;

/// What a line of Codex's is.
pub(super) enum Read<P> {
    /// A notification: a message with a method and no id.
    Notification { method: String, params: Value },
    /// The answer to a request of the runtime's, with what waited for it.
    Answer(P, Answer),
    /// A request of Codex's to its client: the error to write back at once.
    Refused(Value),
    /// Any other line: no JSON, no message, or an answer nothing waits for.
    Other,
}

/// A process's requests, and what waits for each answer.
pub(super) struct Rpc<P> {
    next: u64,
    waiting: BTreeMap<u64, P>,
    ended: Option<String>,
}

impl<P> Rpc<P> {
    pub(super) fn new() -> Rpc<P> {
        Rpc {
            next: 0,
            waiting: BTreeMap::new(),
            ended: None,
        }
    }

    /// A request: the line to write, `waiting` kept for its answer.
    ///
    /// # Errors
    ///
    /// Once the channel ended: what waited, and why it will get no answer.
    pub(super) fn request(
        &mut self,
        method: &str,
        params: Value,
        waiting: P,
    ) -> Result<Value, (P, String)> {
        if let Some(why) = &self.ended {
            return Err((waiting, why.clone()));
        }
        self.next += 1;
        self.waiting.insert(self.next, waiting);
        Ok(json!({ "id": self.next, "method": method, "params": params }))
    }

    /// A notification, which Codex does not answer: the line to write.
    pub(super) fn notify(method: &str) -> Value {
        json!({ "method": method })
    }

    /// Reads one line of Codex's.
    pub(super) fn read(&mut self, line: &str) -> Read<P> {
        let Ok(message) = serde_json::from_str::<Value>(line) else {
            return Read::Other;
        };
        if !message.is_object() {
            return Read::Other;
        }
        let id = message.get("id");
        let named = id.is_some_and(|id| id.is_number() || id.is_string());
        if let Some(method) = message.get("method").and_then(Value::as_str) {
            if !named {
                let params = message.get("params").cloned().unwrap_or(Value::Null);
                return Read::Notification {
                    method: method.to_owned(),
                    params,
                };
            }
            let words = format!("Uraeda does not answer {method}");
            let error = json!({ "code": METHOD_NOT_FOUND, "message": words });
            return Read::Refused(json!({ "error": error, "id": id }));
        }
        let waiting = id.and_then(Value::as_u64);
        let Some(waiting) = waiting.and_then(|id| self.waiting.remove(&id)) else {
            return Read::Other;
        };
        let answer = match message.get("error") {
            Some(error) => Err(error_text(error)),
            None => Ok(message.get("result").cloned().unwrap_or(Value::Null)),
        };
        Read::Answer(waiting, answer)
    }

    /// Ends the channel: what waited for an answer, in the order it was asked, each to be
    /// failed with `why`, as every request from now on.
    pub(super) fn end(&mut self, why: &str) -> Vec<P> {
        self.ended.get_or_insert_with(|| why.to_owned());
        std::mem::take(&mut self.waiting).into_values().collect()
    }
}

/// The message of a JSON-RPC error object.
fn error_text(error: &Value) -> String {
    let message = error.get("message").and_then(Value::as_str);
    let message = message.filter(|message| !message.is_empty());
    message.unwrap_or("Codex refused the request").to_owned()
}
