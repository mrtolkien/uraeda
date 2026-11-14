//! The guard every request passes first. An address that does not start with the token does not
//! exist: 404, as any address a stranger guesses. A write, any method but `GET` and `HEAD`, must
//! carry an `Origin` whose host is the request's own `Host`, and a browser's `Sec-Fetch-Site`, when
//! it sends one, must say `same-origin`: a page of another site cannot write, even with the token.
//!
//! The phone's plugin sends no `Origin`: a write of the vault's sync, `/<token>/vault/...`, may
//! carry the token in `Authorization: Bearer` instead, which a page of another site cannot send
//! without CORS, which nothing here allows.
//!
//! A `Host` other than this machine's own, or a name of `[serve] hosts`, is refused: a page of
//! another site whose name was pointed at this machine reaches nothing.
//!
//! Every answer says `Referrer-Policy: no-referrer`, so the token never leaves in a link followed
//! to another site, and `X-Content-Type-Options: nosniff`.

use std::sync::Arc;

use axum::extract::{Request, State};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};

use crate::Shared;
use crate::token;

/// Refuses what is not the human's own page, then adds the headers every answer carries.
pub async fn guard(State(shared): State<Arc<Shared>>, request: Request, next: Next) -> Response {
    let given = request
        .uri()
        .path()
        .trim_start_matches('/')
        .split('/')
        .next()
        .unwrap_or_default();
    if !token::matches(&shared.token, given) {
        return (StatusCode::NOT_FOUND, "Not found").into_response();
    }
    if !allowed_host(request.headers(), &shared.settings().hosts) {
        return (StatusCode::FORBIDDEN, "Forbidden host").into_response();
    }
    let reads = matches!(*request.method(), Method::GET | Method::HEAD);
    let sync = request.uri().path().split('/').nth(2) == Some("vault");
    if !reads
        && !same_origin(request.headers())
        && !(sync && bearer(request.headers(), &shared.token))
    {
        return (StatusCode::FORBIDDEN, "Forbidden origin").into_response();
    }
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    headers.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("no-referrer"),
    );
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    response
}

/// Whether the request's `Host` names this machine, or one of `hosts`: a page of another site
/// whose name a DNS answer points at this machine (DNS rebinding) is refused, even with the token.
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

/// Whether a write comes from the page's own origin: its `Origin`'s host and port are the
/// request's `Host`, and no `Sec-Fetch-Site` says otherwise.
pub fn same_origin(headers: &HeaderMap) -> bool {
    let text = |name| {
        headers
            .get(name)
            .and_then(|value: &HeaderValue| value.to_str().ok())
    };
    if text(header::HeaderName::from_static("sec-fetch-site"))
        .is_some_and(|site| site != "same-origin")
    {
        return false;
    }
    let (Some(origin), Some(host)) = (text(header::ORIGIN), text(header::HOST)) else {
        return false;
    };
    origin
        .split_once("://")
        .is_some_and(|(_, authority)| authority.eq_ignore_ascii_case(host))
}
