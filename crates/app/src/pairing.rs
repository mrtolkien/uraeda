//! Pairing this device with a server: `POST /pair` with a code `ura pair` printed, or with the
//! access key, for a token of its own. On its own machine the app asks its server for a code
//! itself, with the host token of the status file, as `ura pair` does.

use std::io::Read as _;
use std::time::Duration;

use serde_json::{Value, json};

/// How long the server has to answer: a wrong code waits a second there.
const ANSWER: Duration = Duration::from_secs(15);

/// What a person gives to pair.
pub enum Given<'a> {
    Code(&'a str),
    Key(&'a str),
}

/// A new device token from the server at `address`, for the device named `name`.
///
/// # Errors
///
/// The server's own words, as "This pairing code is not valid", or why it cannot be reached.
pub fn pair(address: &str, given: &Given<'_>, name: &str) -> Result<String, String> {
    let body = match given {
        Given::Code(code) => json!({ "code": code, "name": name }),
        Given::Key(key) => json!({ "key": key, "name": name }),
    };
    let answer = post(address, "/pair", None, &body)?;
    text(&answer, "token")
}

/// A pairing code from the server at `address`, asked as its own host.
///
/// # Errors
///
/// When the server does not take the host token, or cannot be reached.
pub fn code(address: &str, host_token: &str) -> Result<String, String> {
    let answer = post(address, "/pair/code", Some(host_token), &json!({}))?;
    text(&answer, "code")
}

fn text(answer: &Value, field: &str) -> Result<String, String> {
    let found = answer.get(field).and_then(Value::as_str);
    found
        .map(str::to_owned)
        .ok_or_else(|| "The server answered the pairing without a token.".to_owned())
}

/// The JSON answer to a `POST` of `body`, answered 200; another answer's `error`, or its status.
fn post(address: &str, path: &str, token: Option<&str>, body: &Value) -> Result<Value, String> {
    let config = ureq::Agent::config_builder()
        .timeout_global(Some(ANSWER))
        .http_status_as_error(false)
        .build();
    let agent = ureq::Agent::new_with_config(config);
    let url = format!("{}{path}", address.trim_end_matches('/'));
    let mut request = agent.post(&url).header("Content-Type", "application/json");
    if let Some(token) = token {
        request = request.header("Authorization", &format!("Bearer {token}"));
    }
    let mut answer = request
        .send(body.to_string())
        .map_err(|error| format!("{address} cannot be reached: {error}"))?;
    let status = answer.status().as_u16();
    let mut read = String::new();
    let _ = answer
        .body_mut()
        .as_reader()
        .take(64 * 1024)
        .read_to_string(&mut read);
    let value: Value = serde_json::from_str(&read).unwrap_or(Value::Null);
    if status == 200 {
        return Ok(value);
    }
    let said = value.get("error").and_then(Value::as_str);
    Err(said.map_or_else(|| format!("{address} answered {status}."), str::to_owned))
}

/// Unpairs the device of `token`, as a run that held it alone closes: what fails is left, as the
/// owner can revoke it from the server's list.
pub fn unpair(address: &str, token: &str) {
    let config = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(3)))
        .http_status_as_error(false)
        .build();
    let agent = ureq::Agent::new_with_config(config);
    let url = format!("{}/session", address.trim_end_matches('/'));
    let _ = agent
        .delete(&url)
        .header("Authorization", &format!("Bearer {token}"))
        .call();
}
