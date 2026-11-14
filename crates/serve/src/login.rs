//! Signing in: the human gives the token once, and the browser keeps a session.
//!
//! - `GET /login?next=`: the page, one field for the token, which a password manager fills.
//! - `POST /login`: the form's `token` and `next`. The right token sets the session's cookie and
//!   leads to `next`; a wrong one draws the page again.
//!
//! The cookie holds a value derived from the token (see [`crate::token::session`]), for a year:
//! it survives a restart of `ura serve`, and ends when the token's file is removed. It is
//! `HttpOnly`, so no script reads it, and `SameSite=Lax`, so a link from Obsidian to a page opens
//! it signed in, while a write from another site is refused by its origin (see [`crate::guard`]).

use std::sync::Arc;

use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, Uri, header};
use axum::response::{Html, IntoResponse, Redirect, Response};

use crate::html::{self, escape};
use crate::vault_page::{form_value, percent};
use crate::{Shared, guard, token};

/// The sign-in page's address, leading back to `asked` once signed in.
pub fn address(asked: &Uri) -> String {
    let next = asked
        .path_and_query()
        .map_or("/", axum::http::uri::PathAndQuery::as_str);
    format!("/login?next={}", percent(next))
}

/// Where a sign-in leads: `next` when it is a path of this server, else the home page.
fn destination(next: Option<&str>) -> String {
    match next {
        Some(next) if next.starts_with('/') && !next.starts_with("//") && !next.contains('\\') => {
            next.to_string()
        }
        _ => "/".to_string(),
    }
}

fn draw(next: &str, wrong: bool) -> String {
    let error = if wrong {
        "<p class=\"error\">That is not the token.</p>"
    } else {
        ""
    };
    let body = format!(
        "<main class=\"notes\"><h1>Sign in</h1>\
         <p>Paste the token <code>ura serve</code> printed when it started.</p>{error}\
         <form method=\"post\" action=\"/login\">\
         <input type=\"hidden\" name=\"next\" value=\"{next}\">\
         <input type=\"text\" name=\"username\" value=\"ura serve\" autocomplete=\"username\" hidden>\
         <label>Token <input type=\"password\" name=\"token\" autocomplete=\"current-password\" \
         autocapitalize=\"off\" spellcheck=\"false\" required autofocus></label> \
         <button type=\"submit\" class=\"button primary\">Sign in</button></form></main>",
        next = escape(next),
    );
    html::page("Sign in", &body)
}

/// `GET /login`.
pub async fn page(uri: Uri) -> Html<String> {
    let next = uri
        .query()
        .and_then(|query| form_value(query.as_bytes(), "next"));
    Html(draw(&destination(next.as_deref()), false))
}

/// `POST /login`.
pub async fn sign_in(
    State(shared): State<Arc<Shared>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let next = destination(form_value(&body, "next").as_deref());
    let given = form_value(&body, "token").unwrap_or_default();
    if !token::matches(&shared.token, given.trim()) {
        return (StatusCode::UNAUTHORIZED, Html(draw(&next, true))).into_response();
    }
    // Behind `tailscale serve`, the browser speaks HTTPS, and the cookie travels on it alone.
    let secure = headers
        .get("x-forwarded-proto")
        .and_then(|value| value.to_str().ok())
        == Some("https");
    let cookie = format!(
        "{}={}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax{}",
        guard::COOKIE,
        shared.session,
        if secure { "; Secure" } else { "" },
    );
    ([(header::SET_COOKIE, cookie)], Redirect::to(&next)).into_response()
}
