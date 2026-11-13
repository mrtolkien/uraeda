//! Signing in and out: `/session`, `/sessions`, a new key for the host, and one-time links. The
//! session check runs before them, and gives the identity a valid cookie or token names.

use std::time::Duration;

use axum::Json;
use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, Path, Request, State};
use axum::http::header::{CACHE_CONTROL, LOCATION, SET_COOKIE};
use axum::http::{HeaderMap, HeaderValue, StatusCode, Uri};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post};
use percent_encoding::percent_decode_str;
use serde_json::{Value, json};

use crate::handoff::on_server;
use crate::http::Routes;
use crate::shared::Shared;
use crate::sign_in::store::{Kind, Problem};
use crate::sign_in::{Identity, Refusal, cookie, pairing, state};

/// The largest body a sign-in or a pairing reads, before anyone signed in: a key is 47 characters.
pub(super) const BODY: usize = 4 * 1024;

/// How long a failed sign-in or pairing waits for its answer: what a guess costs. Nothing counts
/// the failures, so nothing ever locks the owner out.
const SLOWED: Duration = Duration::from_secs(1);

/// Mounts the session routes.
pub(super) fn mount(routes: &mut Routes) {
    let session = get(session).post(sign_in).delete(sign_out);
    let session = session.layer(DefaultBodyLimit::max(BODY));
    routes.route("/session", session.layer(middleware::from_fn(no_store)));
    let everywhere = delete(sign_out_everywhere);
    routes.route("/sessions", everywhere.layer(middleware::from_fn(no_store)));
    routes.route(
        "/session/key",
        post(new_key).layer(middleware::from_fn(no_store)),
    );
    routes.route(
        "/session/{token}",
        get(link).layer(middleware::from_fn(no_store)),
    );
}

/// No answer of the sign-in routes is ever cached: they set and clear the session cookie, and
/// carry keys and tokens.
pub(super) async fn no_store(request: Request, next: Next) -> Response {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

/// `GET /session`: 204 when signed in, else 401, which is the answer a client asks for.
async fn session(identity: Result<Identity, Refusal>) -> Response {
    match identity {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(refusal) => refusal.into_response(),
    }
}

/// `POST /session` with `{ key }`: signs the browser in, and sets its cookie. A wrong key waits a
/// second, then gets 401. A body over 4 KB is refused at once, with 413.
async fn sign_in(
    State(shared): State<Shared>,
    identity: Result<Identity, Refusal>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let key = text(&body, "key");
    if !key.is_some_and(|key| state(&shared).store.is_key(&key)) {
        let error = "This is not Uraeda's access key.";
        return slowed(&shared, &headers, "sign-in", error).await;
    }
    match start(&shared, &headers, identity.ok().as_ref()) {
        Ok(cookie) => (StatusCode::NO_CONTENT, [(SET_COOKIE, cookie)]).into_response(),
        Err(problem) => failed(&problem),
    }
}

/// `DELETE /session`: signs the browser out, or unpairs the device that asks, and clears the
/// cookie.
async fn sign_out(
    State(shared): State<Shared>,
    identity: Result<Identity, Refusal>,
    headers: HeaderMap,
) -> Response {
    let store = &state(&shared).store;
    let ended = identity.map_or(Ok(false), |identity| {
        store.end(identity.kind(), identity.id())
    });
    cleared(&shared, &headers, ended.map(drop))
}

/// `DELETE /sessions`, past the session check: signs every browser out, and unpairs every device.
async fn sign_out_everywhere(State(shared): State<Shared>, headers: HeaderMap) -> Response {
    cleared(&shared, &headers, state(&shared).store.end_all())
}

/// `POST /session/key` with `{ replace }`, from the host: makes the access key, and answers
/// `{ key, replaced, address }`, the only time the key is shown. The first key ends nothing. A
/// key there already is replaced only when asked, which ends every session and every device;
/// otherwise 409 with `{ error }`: it was shown once, and only its hash is kept.
async fn new_key(State(shared): State<Shared>, headers: HeaderMap, body: Bytes) -> Response {
    // The session check let the host alone through: asked again here, where the key is made.
    if !shared.from_host(&headers) {
        return Refusal::default().into_response();
    }
    let replace = serde_json::from_slice::<Value>(&body)
        .ok()
        .and_then(|body| body.get("replace").and_then(Value::as_bool))
        .unwrap_or(false);
    let store = &state(&shared).store;
    let made = match store.first_key() {
        Ok(Some(key)) => Ok((key, false)),
        Ok(None) if replace => store.replace_key().map(|key| (key, true)),
        Ok(None) => {
            let error = "Uraeda has an access key already, and showed it once: it keeps only \
                         its hash. `ura key --replace` makes a new one, and signs every browser \
                         and device out.";
            return (StatusCode::CONFLICT, Json(json!({ "error": error }))).into_response();
        }
        Err(problem) => Err(problem),
    };
    match made {
        Ok((key, replaced)) => {
            let address = pairing::address(&shared);
            Json(json!({ "key": key, "replaced": replaced, "address": address })).into_response()
        }
        Err(problem) => failed(&problem),
    }
}

/// `GET /session/<token>?to=<path>`, a one-time link: signs the browser in the first time it is
/// used, within 5 minutes, and leads to its path on the server either way.
async fn link(
    State(shared): State<Shared>,
    identity: Result<Identity, Refusal>,
    Path(token): Path<String>,
    headers: HeaderMap,
    uri: Uri,
) -> Response {
    let to = state(&shared).links.take(&token, shared.now());
    let cookie = match &to {
        Some(_) => match start(&shared, &headers, identity.ok().as_ref()) {
            Ok(cookie) => Some(cookie),
            Err(problem) => return failed(&problem),
        },
        None => None,
    };
    let asked = to.or_else(|| asked(&uri, "to"));
    let location = asked.filter(|to| on_server(to));
    let location = location.unwrap_or_else(|| "/".to_owned());
    let mut redirect = (StatusCode::SEE_OTHER, [(LOCATION, location)]).into_response();
    if let Some(cookie) = cookie {
        redirect.headers_mut().insert(SET_COOKIE, cookie);
    }
    redirect
}

/// Makes the browser's new session, ending the one it had, and gives the cookie to set.
fn start(
    shared: &Shared,
    headers: &HeaderMap,
    had: Option<&Identity>,
) -> Result<HeaderValue, Problem> {
    let store = &state(shared).store;
    if let Some(had) = had.filter(|had| had.kind() == Kind::Session) {
        store.end(Kind::Session, had.id())?;
    }
    let value = store.add(Kind::Session, None, shared.now())?;
    Ok(cookie::set(cookie::name(shared, headers), &value))
}

/// The answer to a sign-out: 204, the cookie cleared, even when the file could not be written,
/// since what ended has ended.
fn cleared(shared: &Shared, headers: &HeaderMap, ended: Result<(), Problem>) -> Response {
    let clear = [(SET_COOKIE, cookie::clear(cookie::name(shared, headers)))];
    match ended {
        Ok(()) => (StatusCode::NO_CONTENT, clear).into_response(),
        Err(problem) => (clear, failed(&problem)).into_response(),
    }
}

/// The answer to a wrong key or a wrong pairing code, a second later: 401 with `{ error }`. The
/// failure is logged with where it came from, never with what was tried.
pub(super) async fn slowed(
    shared: &Shared,
    headers: &HeaderMap,
    what: &str,
    error: &str,
) -> Response {
    tokio::time::sleep(SLOWED).await;
    say_err!("uraeda: failed {what} from {}", sender(shared, headers));
    (StatusCode::UNAUTHORIZED, Json(json!({ "error": error }))).into_response()
}

/// Where a request came from, for the log: `X-Forwarded-For`'s first entry when the `Host` is a
/// listed host name, which only a proxy on this machine sends, else this machine. It says where
/// to look, and proves nothing.
fn sender(shared: &Shared, headers: &HeaderMap) -> String {
    let forwarded = headers.get("x-forwarded-for");
    let forwarded = forwarded.and_then(|forwarded| forwarded.to_str().ok());
    let first = forwarded.and_then(|forwarded| forwarded.split(',').next());
    match first.map(str::trim) {
        Some(address) if !address.is_empty() && cookie::proxied(shared, headers) => {
            address.chars().take(64).collect()
        }
        _ => "this machine".to_owned(),
    }
}

/// The answer when the sign-in file could not be written: 500 with `{ error }`.
pub(super) fn failed(problem: &Problem) -> Response {
    let error = Json(json!({ "error": problem.to_string() }));
    (StatusCode::INTERNAL_SERVER_ERROR, error).into_response()
}

/// A text field of a JSON body, or nothing when the body is not an object with one.
pub(super) fn text(body: &[u8], field: &str) -> Option<String> {
    let body: Value = serde_json::from_slice(body).ok()?;
    Some(body.get(field)?.as_str()?.to_owned())
}

/// A field of a request's query, decoded, or nothing when it has none.
fn asked(uri: &Uri, field: &str) -> Option<String> {
    let mut fields = uri
        .query()?
        .split('&')
        .filter_map(|pair| pair.split_once('='));
    let (_, value) = fields.find(|(name, _)| *name == field)?;
    let decoded = percent_decode_str(value).decode_utf8().ok()?;
    Some(decoded.into_owned())
}
