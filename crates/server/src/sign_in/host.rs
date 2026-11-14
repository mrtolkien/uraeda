//! What the host's own `ura` asks the running server, with the host token of its status file,
//! which only the data folder's user reads: a pairing code, and an access key.

use std::path::Path;
use std::time::Duration;

use axum::http::StatusCode;
use serde_json::{Value, json};

use crate::{handoff, status};

/// How long `ura` waits for the server's answer.
const ANSWER: Duration = Duration::from_secs(10);

/// A new access key, as `ura key` shows it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NewKey {
    /// The key, shown this once.
    pub key: String,
    /// It replaced a key: every browser and device was signed out.
    pub replaced: bool,
    /// The address a browser reaches the server at.
    pub address: String,
}

/// Asks the server of a data folder for an access key: the first one, or, with `replace`, a new
/// one in place of the one there, which signs every browser and device out.
///
/// # Errors
///
/// When no server runs on the data folder, or it refuses: the server's words, as for a key that
/// is there already and is not to be replaced.
pub fn access_key(data_dir: &Path, replace: bool) -> Result<NewKey, String> {
    let answer = ask(data_dir, "/session/key", &json!({ "replace": replace }))?;
    let text = |field: &str| answer.get(field).and_then(Value::as_str).map(str::to_owned);
    let replaced = answer.get("replaced").and_then(Value::as_bool);
    match (text("key"), replaced, text("address")) {
        (Some(key), Some(replaced), Some(address)) => Ok(NewKey {
            key,
            replaced,
            address,
        }),
        _ => Err(text("error").unwrap_or_else(|| "the server gave no key".to_owned())),
    }
}

/// The JSON answer of the server of a data folder to a `POST` of `body` to `path`, as its host.
///
/// # Errors
///
/// When no server runs on the data folder, or its answer is not a 200 or a 409 with JSON: a 409
/// is the server's refusal, in its `error`.
pub(super) fn ask(data_dir: &Path, path: &str, body: &Value) -> Result<Value, String> {
    let folder = data_dir.display();
    let none = || format!("no server runs on {folder}: start one with `ura serve-app`");
    let running = status::read(data_dir).ok_or_else(none)?;
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|error| error.to_string())?;
    let asked = runtime.block_on(async {
        let ask = handoff::post(running.port, Some(running.token.as_str()), path, body);
        tokio::time::timeout(ANSWER, ask).await
    });
    match asked {
        Ok(Some((StatusCode::OK | StatusCode::CONFLICT, answer))) => Ok(answer),
        _ => Err(none()),
    }
}
