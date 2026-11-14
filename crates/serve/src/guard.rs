//! The guard every request passes first.
//!
//! - A `Host` other than this machine's own, or a name of `[serve] hosts`, is refused: a page of
//!   another site whose name was pointed at this machine reaches nothing.
//! - A request must be the human's: its cookie holds the session a sign-in with the token gave
//!   (see [`crate::login`]), or its `Authorization: Bearer` holds the token, as the phone's plugin
//!   sends it. Without either, a page asked for by a browser leads to the sign-in page, and
//!   anything else is a 401. The sign-in page, the embedded style sheet and script, and a
//!   feature's raw files, which carry a key of their own (see [`crate::files`]), need neither.
//! - A write, any method but `GET` and `HEAD`, must carry an `Origin` whose host is the
//!   request's own `Host`, and a browser's `Sec-Fetch-Site`, when it sends one, must say
//!   `same-origin`: a page of another site cannot write, even in a signed-in browser. The
//!   plugin sends no `Origin`: a write of the vault's sync, `/vault/...`, may carry the token
//!   as a bearer instead, which a page of another site cannot send without CORS, which nothing
//!   here allows.
//!
//! Every answer says `Referrer-Policy: same-origin`, so no address leaves in a link followed to
//! another site, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: SAMEORIGIN`: no other
//! site frames a page to have the human click in it.

use std::sync::Arc;

use axum::extract::{Request, State};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Redirect, Response};

use crate::Shared;
use crate::token;

/// The cookie a signed-in browser keeps.
pub const COOKIE: &str = "ura_session";

/// Refuses what is not the human's own, then adds the headers every answer carries.
pub async fn guard(State(shared): State<Arc<Shared>>, request: Request, next: Next) -> Response {
    if !allowed_host(request.headers(), &shared.settings().hosts) {
        return (StatusCode::FORBIDDEN, "Forbidden host").into_response();
    }
    let reads = matches!(*request.method(), Method::GET | Method::HEAD);
    let path = request.uri().path();
    let mut segments = path.split('/').skip(1);
    let first = segments.next().unwrap_or_default();
    let open =
        first == "login" || (reads && first == "a") || (reads && segments.nth(1) == Some("raw"));
    let headers = request.headers();
    let known = signed_in(headers, &shared.session) || bearer(headers, &shared.token);
    if !open && !known {
        return if reads && wants_a_page(headers) {
            Redirect::to(&crate::login::address(request.uri())).into_response()
        } else {
            (StatusCode::UNAUTHORIZED, "Sign in with ura serve's token").into_response()
        };
    }
    if !reads && !same_origin(headers) && !(first == "vault" && bearer(headers, &shared.token)) {
        return (StatusCode::FORBIDDEN, "Forbidden origin").into_response();
    }
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    headers.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("same-origin"),
    );
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::X_FRAME_OPTIONS,
        HeaderValue::from_static("SAMEORIGIN"),
    );
    response
}

/// Whether the request's cookie holds the session.
pub fn signed_in(headers: &HeaderMap, session: &str) -> bool {
    headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(';'))
        .filter_map(|pair| pair.trim().strip_prefix(COOKIE)?.strip_prefix('='))
        .any(|given| token::matches(session, given))
}

/// Whether a browser asks for a page, which a sign-in can lead back to.
fn wants_a_page(headers: &HeaderMap) -> bool {
    headers
        .get(header::ACCEPT)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|accept| accept.contains("text/html"))
}

/// Whether the request's `Host` names this machine, or one of `hosts`: a page of another site
/// whose name a DNS answer points at this machine (DNS rebinding) is refused, even signed in.
pub fn allowed_host(headers: &HeaderMap, hosts: &[String]) -> bool {
    let Some(host) = headers.get(header::HOST).and_then(|v| v.to_str().ok()) else {
        return false;
    };
    let host = host.trim().to_ascii_lowercase();
    // The name without its port: `[::1]:4310`, `127.0.0.1:4310`, `name.ts.net`.
    let name = match host.strip_prefix('[') {
        Some(rest) => rest.split(']').next().unwrap_or_default(),
        None => host
            .rsplit_once(':')
            .map_or(host.as_str(), |(name, _)| name),
    };
    matches!(name, "127.0.0.1" | "localhost" | "::1") || hosts.iter().any(|allowed| allowed == name)
}

/// Whether the request carries the token in `Authorization: Bearer`.
pub fn bearer(headers: &HeaderMap, token: &str) -> bool {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .is_some_and(|given| token::matches(token, given.trim()))
}

/// Whether a write comes from the page's own origin. A browser says so itself in
/// `Sec-Fetch-Site`, which no page can set: `same-origin` is enough, and anything else refuses.
/// A form sent by a page may carry `Origin: null`, as a sandboxed mockup's does: only what the
/// browser says tells them apart. Without `Sec-Fetch-Site`, as an older browser sends, the
/// `Origin`'s host and port must be the request's `Host`.
pub fn same_origin(headers: &HeaderMap) -> bool {
    let text = |name| {
        headers
            .get(name)
            .and_then(|value: &HeaderValue| value.to_str().ok())
    };
    match text(header::HeaderName::from_static("sec-fetch-site")) {
        Some("same-origin") => return true,
        Some(_) => return false,
        None => {}
    }
    let (Some(origin), Some(host)) = (text(header::ORIGIN), text(header::HOST)) else {
        return false;
    };
    origin
        .split_once("://")
        .is_some_and(|(_, authority)| authority.eq_ignore_ascii_case(host))
}
