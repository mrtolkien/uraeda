//! MCP's streamable HTTP transport, stateless: `initialize`, `ping`, `tools/list`, and
//! `tools/call`, the last answered as an event stream, with progress until the tool answers.
//!
//! - Every request needs `Authorization: Bearer <token>` of a process the server issued one to,
//!   or gets 401, saying nothing of why. The tool runs for that token's session.
//! - A notification is accepted with 202. A `notifications/cancelled` of a call of the same
//!   session stops it.
//! - A `GET`, which would open the server's own stream, is 405. A batch is an invalid request.

use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::{Arc, Mutex, PoisonError};
use std::time::Duration;

use axum::body::{Body, Bytes};
use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::http::header::{AUTHORIZATION, CACHE_CONTROL, CONTENT_TYPE};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::{Extension, Json};
use futures_util::stream;
use serde_json::{Map, Value, json};
use tokio::sync::Notify;
use tokio::time::{Instant, Interval, interval_at};

use super::Mcp;
use super::tools::{self, Answer};
use crate::shared::Shared;

/// The protocol versions the endpoint speaks, the latest first: a client's own is answered back.
/// 2025-03-26 stays for older clients, though its JSON-RPC batches are refused with an error.
const VERSIONS: [&str; 3] = ["2025-11-25", "2025-06-18", "2025-03-26"];

/// How often a running call reports progress: an agent drops a call that stays silent for long.
const PROGRESS_EVERY: Duration = Duration::from_secs(30);

/// The largest message the endpoint reads.
pub(super) const MAX_BODY: usize = 1024 * 1024;

/// The session a request's token was issued to.
#[derive(Clone)]
pub(super) struct Session(String);

/// The token's check, before anything of a request is read: 401 without the token of a process
/// the server issued one to.
pub(super) async fn checked(
    State(shared): State<Shared>,
    mut request: Request,
    next: Next,
) -> Response {
    let given = request.headers().get(AUTHORIZATION);
    let given = given.and_then(|value| value.to_str().ok());
    match shared.get::<Mcp>().tokens.session_of(given) {
        Some(session) => {
            request.extensions_mut().insert(Session(session));
            next.run(request).await
        }
        None => (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    }
}

/// `POST /mcp`: one JSON-RPC message. A request is answered as JSON, or for a tool's call as an
/// event stream. A notification, or a response to the server, which never asks, is 202.
pub(super) async fn message(
    State(shared): State<Shared>,
    Extension(Session(session)): Extension<Session>,
    body: Bytes,
) -> Response {
    let invalid = |code, text| {
        (
            StatusCode::BAD_REQUEST,
            Json(failure(&Value::Null, code, text)),
        )
    };
    let Ok(message) = serde_json::from_slice::<Value>(&body) else {
        return invalid(-32_700, "Parse error").into_response();
    };
    let Some(message) = message.as_object() else {
        return invalid(-32_600, "Invalid request").into_response();
    };
    let method = message.get("method").and_then(Value::as_str);
    let method = method.unwrap_or_default();
    // Params absent, null, or not an object are read as none.
    let none = Map::new();
    let params = message.get("params").and_then(Value::as_object);
    let params = params.unwrap_or(&none);
    let mcp = shared.get::<Mcp>();
    let Some(id) = message.get("id").filter(|id| is_id(id)) else {
        let asked = params.get("requestId").filter(|id| is_id(id));
        if let Some(asked) = asked.filter(|_| method == "notifications/cancelled") {
            mcp.running.cancel(&session, asked);
        }
        return StatusCode::ACCEPTED.into_response();
    };
    match method {
        "initialize" => Json(result(id, initialized(params))).into_response(),
        "ping" => Json(result(id, json!({}))).into_response(),
        "tools/list" => Json(result(id, json!({ "tools": tools::listed() }))).into_response(),
        "tools/call" => call(mcp, &session, id, params),
        _ => Json(failure(id, -32_601, &format!("Unknown method: {method}"))).into_response(),
    }
}

/// Whether a value is a JSON-RPC id: a text or a number.
fn is_id(value: &Value) -> bool {
    value.is_string() || value.is_number()
}

/// A request's result.
fn result(id: &Value, value: Value) -> Value {
    json!({ "id": id, "jsonrpc": "2.0", "result": value })
}

/// A request's error.
fn failure(id: &Value, code: i32, message: &str) -> Value {
    json!({ "error": { "code": code, "message": message }, "id": id, "jsonrpc": "2.0" })
}

/// The answer to `initialize`: the client's own protocol version when the endpoint speaks it,
/// else the latest.
fn initialized(params: &Map<String, Value>) -> Value {
    let asked = params.get("protocolVersion").and_then(Value::as_str);
    let version = asked.filter(|asked| VERSIONS.contains(asked));
    json!({
        "capabilities": { "tools": {} },
        "protocolVersion": version.unwrap_or(VERSIONS[0]),
        "serverInfo": { "name": "uraeda", "version": "1" },
    })
}

/// The answer to `tools/call`: an error for a tool the endpoint does not have, else the call's
/// stream.
fn call(mcp: Arc<Mcp>, session: &str, id: &Value, params: &Map<String, Value>) -> Response {
    let name = params.get("name").and_then(Value::as_str);
    let Some(tool) = name.and_then(tools::find) else {
        let name = name.unwrap_or("(no name)");
        return Json(failure(id, -32_602, &format!("Unknown tool: {name}"))).into_response();
    };
    let no_arguments = json!({});
    let input = params.get("arguments").filter(|input| !input.is_null());
    let work = tools::start(tool, mcp.runner(), session, input.unwrap_or(&no_arguments));
    let token = params
        .get("_meta")
        .and_then(|meta| meta.get("progressToken"));
    let call = Call {
        id: id.clone(),
        token: token.filter(|token| !token.is_null()).cloned(),
        work,
        ticks: interval_at(Instant::now() + PROGRESS_EVERY, PROGRESS_EVERY),
        progress: 0,
        entry: Entry::add(mcp, session, id),
    };
    let headers = [
        (CACHE_CONTROL, "no-cache"),
        (CONTENT_TYPE, "text/event-stream"),
    ];
    (headers, Body::from_stream(stream::unfold(Some(call), next))).into_response()
}

/// A running call of a tool, as its stream holds it: dropped with the stream, when the tool
/// answered, when its client cancelled it, or when its connection dropped. The tool's work is
/// dropped with it.
struct Call {
    id: Value,
    /// The client's progress token, when it gave one.
    token: Option<Value>,
    work: Answer,
    ticks: Interval,
    progress: u64,
    entry: Entry,
}

/// The stream's next event, and the call when more follow: a progress notification with the
/// client's token at each tick, a comment without one, so the connection never goes silent, then
/// the result, which ends the stream. A cancelled call ends it without a result.
async fn next(call: Option<Call>) -> Option<(Result<Bytes, Infallible>, Option<Call>)> {
    let mut call = call?;
    tokio::select! {
        biased;
        () = call.entry.cancelled.notified() => None,
        answer = &mut call.work => {
            let (text, failed) = match answer {
                Ok(text) => (text, false),
                Err(text) => (text, true),
            };
            let mut content = json!({ "content": [{ "text": text, "type": "text" }] });
            if failed {
                content["isError"] = true.into();
            }
            Some((Ok(event(&result(&call.id, content))), None))
        }
        _ = call.ticks.tick() => {
            call.progress += 1;
            let said = match &call.token {
                Some(token) => event(&json!({
                    "jsonrpc": "2.0",
                    "method": "notifications/progress",
                    "params": { "progress": call.progress, "progressToken": token },
                })),
                None => Bytes::from_static(b": working\n\n"),
            };
            Some((Ok(said), Some(call)))
        }
    }
}

/// A JSON-RPC message as an event of a stream.
fn event(message: &Value) -> Bytes {
    format!("event: message\ndata: {message}\n\n").into()
}

/// The calls that run now, by their session and their id: two sessions' ids may be the same.
#[derive(Default)]
pub(super) struct Running(Mutex<HashMap<(String, String), Arc<Notify>>>);

impl Running {
    /// Stops a session's call of this id, when it runs.
    fn cancel(&self, session: &str, id: &Value) {
        let running = self.0.lock().unwrap_or_else(PoisonError::into_inner);
        if let Some(cancelled) = running.get(&key(session, id)) {
            cancelled.notify_one();
        }
    }
}

/// The key of a call among the running ones.
fn key(session: &str, id: &Value) -> (String, String) {
    (session.to_owned(), id.to_string())
}

/// A call's place among the running ones, which it leaves when dropped.
struct Entry {
    mcp: Arc<Mcp>,
    key: (String, String),
    cancelled: Arc<Notify>,
}

impl Entry {
    /// Adds a call to the running ones.
    fn add(mcp: Arc<Mcp>, session: &str, id: &Value) -> Entry {
        let (key, cancelled) = (key(session, id), Arc::new(Notify::new()));
        let mut running = mcp.running.0.lock().unwrap_or_else(PoisonError::into_inner);
        running.insert(key.clone(), cancelled.clone());
        drop(running);
        Entry {
            mcp,
            key,
            cancelled,
        }
    }
}

impl Drop for Entry {
    fn drop(&mut self) {
        let running = &self.mcp.running.0;
        let mut running = running.lock().unwrap_or_else(PoisonError::into_inner);
        // A later call of the same id took the place: it is left there.
        if running
            .get(&self.key)
            .is_some_and(|kept| Arc::ptr_eq(kept, &self.cancelled))
        {
            running.remove(&self.key);
        }
    }
}
