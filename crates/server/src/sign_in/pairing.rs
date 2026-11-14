//! Pairing a device: the host's own `ura pair` asks for a one-time code, and the device gives it
//! back for a token of its own, which signs it in from then on.

use std::path::Path;
use std::time::Duration;

use axum::Json;
use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, State};
use axum::http::HeaderMap;
use axum::middleware;
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use serde_json::{Value, json};

use crate::http::Routes;
use crate::secret;
use crate::shared::Shared;
use crate::sign_in::routes::{BODY, failed, no_store, slowed, text};
use crate::sign_in::store::Kind;
use crate::sign_in::{Refusal, devices, host, state};

/// How long a pairing code lives: 10 minutes, on the server's clock.
pub(super) const LIVES: Duration = Duration::from_secs(10 * 60);

/// The symbols of a code, 5 random bits each: digits and capitals a person tells apart, with no
/// I, L, O, or U.
const SYMBOLS: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/// How many symbols a code has: 60 random bits, in three groups, as `7KQ2-M9XA-0TBD`.
const LENGTH: usize = 12;

/// Mounts `POST /pair` and `POST /pair/code`.
pub(super) fn mount(routes: &mut Routes) {
    let pair = post(pair).layer(DefaultBodyLimit::max(BODY));
    routes.route("/pair", pair.layer(middleware::from_fn(no_store)));
    routes.route(
        "/pair/code",
        post(code).layer(middleware::from_fn(no_store)),
    );
}

/// `POST /pair/code`, from the host: a new code, how long it lives, and the address a device
/// reaches the server at.
async fn code(State(shared): State<Shared>, headers: HeaderMap) -> Response {
    // The session check let the host alone through: asked again here, where the code is made.
    if !shared.from_host(&headers) {
        return Refusal::default().into_response();
    }
    let code = new_code();
    let codes = &state(&shared).codes;
    codes.hold(&typed(&code), (), shared.now());
    let minutes = LIVES.as_secs() / 60;
    let answer = json!({ "code": code, "minutes": minutes, "address": address(&shared) });
    Json(answer).into_response()
}

/// `POST /pair` with `{ code, name }`: pairs a device with a code that was not used yet, and
/// answers `{ token, id }`, the only time its token is shown. `{ key, name }` pairs one with the
/// access key, which signs a browser in already: the app has no cookie to keep. Any other code or
/// key waits a second, then gets 401.
async fn pair(State(shared): State<Shared>, headers: HeaderMap, body: Bytes) -> Response {
    let state = state(&shared);
    if let Some(key) = text(&body, "key") {
        if !state.store.is_key(&key) {
            let error = "This is not Uraeda's access key.";
            return slowed(&shared, &headers, "pairing", error).await;
        }
    } else {
        let code = text(&body, "code");
        let known = |code: String| state.codes.take(&typed(&code), shared.now());
        if code.and_then(known).is_none() {
            let error = "This pairing code is not valid: run `ura pair` again for a new one.";
            return slowed(&shared, &headers, "pairing", error).await;
        }
    }
    let name = text(&body, "name").and_then(|name| devices::named(&name));
    let name = name.unwrap_or_else(|| "A device".to_owned());
    match state.store.add(Kind::Device, Some(name), shared.now()) {
        Ok(token) => {
            let id = token.split_once('.').map(|(id, _)| id);
            Json(json!({ "token": token, "id": id })).into_response()
        }
        Err(problem) => failed(&problem),
    }
}

/// A new code, as it is shown.
fn new_code() -> String {
    let symbols = secret::random_bytes(LENGTH);
    let symbols = symbols.iter().map(|byte| SYMBOLS[usize::from(byte & 31)]);
    let symbols: Vec<u8> = symbols.collect();
    let groups = symbols.chunks(4).map(String::from_utf8_lossy);
    groups.collect::<Vec<_>>().join("-")
}

/// A code as a person types it, made the code as it is held: its letters and digits alone, in
/// capitals, with the letters a code never has read as the digits they look like.
fn typed(code: &str) -> String {
    let symbols = code.chars().filter(char::is_ascii_alphanumeric);
    let symbols = symbols.map(|symbol| match symbol.to_ascii_uppercase() {
        'O' => '0',
        'I' | 'L' => '1',
        symbol => symbol,
    });
    symbols.collect()
}

/// The address a device reaches the server at: the owner's first host name, behind HTTPS, or
/// else the server's own, on this machine.
pub(super) fn address(shared: &Shared) -> String {
    let hosts = shared.allowed_hosts();
    let named = hosts.first().map(|host| format!("https://{host}"));
    named.unwrap_or_else(|| shared.address())
}

/// A pairing code, as `ura pair` shows it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Pairing {
    /// The code, which pairs one device, once.
    pub code: String,
    /// How many minutes it lives.
    pub minutes: u64,
    /// The address a device reaches the server at.
    pub address: String,
}

/// Asks the server of a data folder for a pairing code, as the host's own `ura pair`: with the
/// host token of its status file, which only the data folder's user reads.
///
/// # Errors
///
/// When no server runs on the data folder, or it does not answer with a code.
pub fn pairing_code(data_dir: &Path) -> Result<Pairing, String> {
    let answer = host::ask(data_dir, "/pair/code", &json!({}))?;
    let text = |field: &str| answer.get(field).and_then(Value::as_str).map(str::to_owned);
    let minutes = answer.get("minutes").and_then(Value::as_u64);
    match (text("code"), minutes, text("address")) {
        (Some(code), Some(minutes), Some(address)) => Ok(Pairing {
            code,
            minutes,
            address,
        }),
        _ => Err(format!(
            "no server runs on {}: start one with `ura serve-app`",
            data_dir.display()
        )),
    }
}
