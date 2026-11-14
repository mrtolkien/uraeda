//! The guard every request passes first. An address that does not start with the token does not
//! exist: 404, as any address a stranger guesses. A write, any method but `GET` and `HEAD`, must
//! carry an `Origin` whose host is the request's own `Host`, and a browser's `Sec-Fetch-Site`, when
//! it sends one, must say `same-origin`: a page of another site cannot write, even with the token.
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
    let reads = matches!(*request.method(), Method::GET | Method::HEAD);
    if !reads && !same_origin(request.headers()) {
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
