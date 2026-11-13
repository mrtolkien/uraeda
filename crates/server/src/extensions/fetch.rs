//! `fetch`: a request an extension sends from the server, whose whole answer comes back to
//! its VM. It runs on one of tokio's blocking threads, and holds nothing of the VM: once the
//! VM is gone its answer is dropped, and the request ends by its own time limit.

use std::time::Duration;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD;
use serde::Deserialize;
use serde_json::{Value, json};

use super::vm::Vm;

/// How long a request has, from its start to the last byte of its answer.
const TIMEOUT: Duration = Duration::from_secs(30);

/// The largest answer read: a longer one fails the request.
const MOST_BYTES: u64 = 64 * 1024 * 1024;

/// What the prelude's `fetch` asks for.
#[derive(Deserialize)]
struct Asked {
    id: u64,
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    /// The body, in base64: none for a request without one.
    body: Option<String>,
}

/// Starts a request: its answer reaches the VM as `fetch.done`.
pub(super) fn start(vm: &Vm, payload: Value) -> Result<Value, String> {
    let asked: Asked = serde_json::from_value(payload).map_err(|error| error.to_string())?;
    let vm = vm.clone();
    tokio::task::spawn_blocking(move || {
        let id = asked.id;
        let done = match send(asked) {
            Ok(mut answer) => {
                answer["id"] = json!(id);
                answer
            }
            Err(error) => json!({ "id": id, "error": error }),
        };
        vm.dispatch("fetch.done", done);
    });
    Ok(Value::Null)
}

/// Sends the request, and reads its whole answer: any status is an answer.
fn send(asked: Asked) -> Result<Value, String> {
    let words = |error: &dyn std::fmt::Display| error.to_string();
    let body = asked.body.map(|body| STANDARD.decode(body)).transpose();
    let body = body.map_err(|error| words(&error))?.unwrap_or_default();
    let config = ureq::Agent::config_builder()
        .timeout_global(Some(TIMEOUT))
        .http_status_as_error(false)
        .build();
    let agent = ureq::Agent::new_with_config(config);
    let mut request = ureq::http::Request::builder()
        .method(asked.method.as_str())
        .uri(&asked.url);
    for (name, value) in &asked.headers {
        request = request.header(name, value);
    }
    let request = request.body(body).map_err(|error| words(&error))?;
    let mut answer = agent.run(request).map_err(|error| words(&error))?;
    let status = answer.status();
    let headers: Vec<(String, String)> = answer
        .headers()
        .iter()
        .map(|(name, value)| {
            let value = String::from_utf8_lossy(value.as_bytes()).into_owned();
            (name.as_str().to_owned(), value)
        })
        .collect();
    let read = answer.body_mut().with_config().limit(MOST_BYTES);
    let bytes = read.read_to_vec().map_err(|error| words(&error))?;
    Ok(json!({
        "status": status.as_u16(),
        "statusText": status.canonical_reason().unwrap_or_default(),
        "headers": headers,
        "body": STANDARD.encode(bytes),
    }))
}
