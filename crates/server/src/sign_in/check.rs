//! The check: the only place that decides who a request or a connection is, and which routes one
//! reaches without a session.

use axum::Json;
use axum::extract::{FromRequestParts, MatchedPath, Request, State};
use axum::http::header::{AUTHORIZATION, CACHE_CONTROL, SET_COOKIE};
use axum::http::request::Parts;
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use serde_json::json;
use tokio::sync::watch;
use uraeda_protocol::{PROTOCOL, ServerMessage, SignIn};

use crate::shared::Shared;
use crate::sign_in::store::{Found, Kind};
use crate::sign_in::{cookie, state};

/// Who may reach a route without a session.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Open {
    /// Anyone the guard lets through: the route checks what it is given itself, as a key, a
    /// one-time code, or a `hello`.
    Anyone,
    /// The host's own `ura` and app, with the host token of the server's status file.
    Host,
    /// A sandboxed frame, which sends no cookie: only a path that carries the current frame
    /// secret, a preview's or a mockup's.
    Frame,
}

/// The routes a request without a session reaches, by their path as mounted: the sign-in
/// decision's exceptions, here and nowhere else. Every other route answers 401, so a new route is
/// closed until it is listed, which is a change to that decision.
pub const OPEN: &[(&str, Open)] = &[
    // The WebSocket: its `hello` signs in, and `check` decides.
    ("/live", Open::Anyone),
    // Signing in and out, with the key or a one-time link.
    ("/session", Open::Anyone),
    ("/session/{token}", Open::Anyone),
    // Pairing a device, with a one-time code.
    ("/pair", Open::Anyone),
    // The agents' tools: an agent's process signs in with the token the server issued it.
    ("/mcp", Open::Anyone),
    // The host's own: a second start's folder, a new key, a pairing code.
    ("/open", Open::Host),
    ("/session/key", Open::Host),
    ("/pair/code", Open::Host),
    // The previews, proxied: with the frame secret only.
    (crate::preview::proxy::PATHS[0], Open::Frame),
    (crate::preview::proxy::PATHS[1], Open::Frame),
    (crate::preview::proxy::PATHS[2], Open::Frame),
    // The mockups: with the frame secret, or for a signed-in page, which is sent to it.
    (crate::files::MOCKUPS, Open::Frame),
];

/// Who a request or a connection is: a browser's session or a paired device, signed in.
///
/// A route's handler takes it as an argument, and a connection gets it from [`check`]. Whatever
/// lives longer than a request holds it, and ends with it: see [`Identity::ended`].
#[derive(Clone, Debug)]
pub struct Identity {
    kind: Kind,
    id: String,
    ended: watch::Receiver<bool>,
}

impl Identity {
    /// Whether it is a browser's session or a paired device.
    pub fn kind(&self) -> Kind {
        self.kind
    }

    /// The session's or the device's id: a public name, the same in the list of devices.
    pub fn id(&self) -> &str {
        &self.id
    }

    /// Whether the sign-in ended since it was checked.
    pub fn has_ended(&self) -> bool {
        *self.ended.borrow()
    }

    /// Waits until the sign-in ends: signed out, revoked, a new key, or 30 days without use. A
    /// connection awaits it beside its messages, and closes then.
    pub async fn ended(&self) {
        let mut ended = self.ended.clone();
        // A signal whose store is gone ends too.
        let _ = ended.wait_for(|ended| *ended).await;
    }
}

impl From<Found> for Identity {
    fn from(found: Found) -> Identity {
        Identity {
            kind: found.kind,
            id: found.id,
            ended: found.ended,
        }
    }
}

/// Why a request or a `hello` is not let in: it carries no session and no device token that the
/// server knows. As a response, it is the 401 every closed route answers; as a message, the
/// `refused` of a `hello`.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Refusal {
    /// The name of the cookie the request carried, which names no session: to clear, so it is
    /// never sent again.
    stale: Option<&'static str>,
}

impl IntoResponse for Refusal {
    fn into_response(self) -> Response {
        let error = Json(json!({ "error": "Sign in to Uraeda." }));
        let mut response = (StatusCode::UNAUTHORIZED, error).into_response();
        let headers = response.headers_mut();
        headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
        if let Some(name) = self.stale {
            headers.insert(SET_COOKIE, cookie::clear(name));
        }
        response
    }
}

impl From<Refusal> for ServerMessage {
    fn from(_: Refusal) -> ServerMessage {
        ServerMessage::Refused {
            reason: uraeda_protocol::Refusal::NotSignedIn,
            protocol: PROTOCOL,
        }
    }
}

/// The one check of a request: who sends it, by its session cookie, or by a paired device's
/// token as `Authorization: Bearer <token>`.
///
/// # Errors
///
/// The [`Refusal`] to answer, when it carries neither, or one the server does not know.
pub fn require(shared: &Shared, headers: &HeaderMap) -> Result<Identity, Refusal> {
    found(shared, headers).map(Identity::from)
}

/// The one check of a connection: who says `hello`, by the session cookie of the request that
/// opened the connection, or by the device's token the `hello` gives.
///
/// # Errors
///
/// The [`Refusal`] to answer, as a `refused`, before closing the connection.
pub fn check(shared: &Shared, headers: &HeaderMap, sign_in: &SignIn) -> Result<Identity, Refusal> {
    if let Some(open) = shared.find::<Unguarded>() {
        return Ok(Identity::from(open.found()));
    }
    let found = match sign_in {
        SignIn::Cookie => by_cookie(shared, headers),
        SignIn::Token(token) => by_token(shared, token),
    };
    found.map(Identity::from).ok_or(Refusal::default())
}

/// The session a request's cookie signs in.
fn by_cookie(shared: &Shared, headers: &HeaderMap) -> Option<Found> {
    let cookie = cookie::read(shared, headers)?;
    state(shared)
        .store
        .find(Kind::Session, cookie, shared.now())
}

/// The device a token signs in.
fn by_token(shared: &Shared, token: &str) -> Option<Found> {
    state(shared).store.find(Kind::Device, token, shared.now())
}

/// The sign-in of a request: its cookie's session, or else its token's device.
fn found(shared: &Shared, headers: &HeaderMap) -> Result<Found, Refusal> {
    if let Some(open) = shared.find::<Unguarded>() {
        return Ok(open.found());
    }
    let bearer = || {
        let given = headers.get(AUTHORIZATION)?.to_str().ok()?;
        by_token(shared, given.strip_prefix("Bearer ")?)
    };
    by_cookie(shared, headers).or_else(bearer).ok_or_else(|| {
        let stale = cookie::read(shared, headers).map(|_| cookie::name(shared, headers));
        Refusal { stale }
    })
}

/// Whether a request passes the check: signed in, or on a route open to it. A path that is no
/// route is the client's own files, which hold nothing of the owner's.
fn passes(shared: &Shared, request: &Request, signed_in: bool) -> bool {
    let Some(route) = request.extensions().get::<MatchedPath>() else {
        return true;
    };
    match OPEN.iter().find(|(path, _)| *path == route.as_str()) {
        Some((_, Open::Anyone)) => true,
        Some((_, Open::Host)) => shared.from_host(request.headers()),
        Some((_, Open::Frame)) => {
            signed_in || crate::preview::is_frame(shared, request.uri().path())
        }
        None => signed_in,
    }
}

/// The session check, on every request, after the guard. A request that does not pass gets 401.
/// One that does carries its [`Identity`], on the open routes too, or else the [`Refusal`] it
/// would have got. A session used for the first time in a day sets its cookie again, unless the
/// request ended it.
pub(crate) async fn layer(
    State(shared): State<Shared>,
    mut request: Request,
    next: Next,
) -> Response {
    let found = found(&shared, request.headers());
    if !passes(&shared, &request, found.is_ok()) {
        return found.err().unwrap_or_default().into_response();
    }
    let found = match found {
        Ok(found) => found,
        Err(refusal) => {
            request.extensions_mut().insert(refusal);
            return next.run(request).await;
        }
    };
    let again = (found.recorded && found.kind == Kind::Session)
        .then(|| again(&shared, request.headers()))
        .flatten();
    let identity = Identity::from(found);
    request.extensions_mut().insert(identity.clone());
    let mut response = next.run(request).await;
    if let Some(cookie) = again.filter(|_| !identity.has_ended()) {
        response.headers_mut().append(SET_COOKIE, cookie);
    }
    response
}

/// The `Set-Cookie` that sets a request's session cookie again.
fn again(shared: &Shared, headers: &HeaderMap) -> Option<HeaderValue> {
    let value = cookie::read(shared, headers)?;
    Some(cookie::set(cookie::name(shared, headers), value))
}

/// A handler's argument: the identity the session check found. On a route open without a
/// session, `Result<Identity, Refusal>` says whether there is one.
impl<S: Send + Sync> FromRequestParts<S> for Identity {
    type Rejection = Refusal;

    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Identity, Refusal> {
        let extensions = &parts.extensions;
        let refusal = || extensions.get::<Refusal>().copied().unwrap_or_default();
        extensions.get::<Identity>().cloned().ok_or_else(refusal)
    }
}

/// A server without sign-in, as `ura sandbox` starts one: every request and every `hello` is
/// the one browser session `sandbox`, which never ends. Only code provides it, through
/// [`crate::Options::sandbox`]; the guard still keeps every other site and machine out.
pub(crate) struct Unguarded {
    /// Never sent: the session's end, which never comes.
    never: watch::Sender<bool>,
}

impl Unguarded {
    /// The sign-in of a server without one.
    pub(crate) fn new() -> Unguarded {
        Unguarded {
            never: watch::channel(false).0,
        }
    }

    /// The one session every request is.
    fn found(&self) -> Found {
        Found {
            kind: Kind::Session,
            id: "sandbox".to_owned(),
            ended: self.never.subscribe(),
            recorded: false,
        }
    }
}
