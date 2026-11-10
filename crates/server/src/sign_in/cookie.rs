//! The session cookie: its name, its attributes, and how a request's is read. Its value is
//! `<id>.<secret>`, which the store makes and checks.

use axum::http::header::{COOKIE, HOST};
use axum::http::{HeaderMap, HeaderValue};

use crate::shared::Shared;
use crate::sign_in::store::UNUSED;

/// The cookie's name over HTTPS, where it is `Secure`: a browser sets a `__Host-` cookie for the
/// exact host only, and never over plain HTTP.
const SECURE: &str = "__Host-uraeda";

/// The cookie's name on the machine itself, over plain HTTP.
const PLAIN: &str = "uraeda";

/// The name of a request's session cookie. A request counts as HTTPS when its `Host` is a listed
/// host name, exactly: only a proxy on this machine sends one, ending HTTPS. The names are those
/// in force at the request.
pub(crate) fn name(shared: &Shared, headers: &HeaderMap) -> &'static str {
    let host = headers.get(HOST).and_then(|host| host.to_str().ok());
    let host = host.unwrap_or_default().to_ascii_lowercase();
    if shared.allowed_hosts().contains(&host) {
        SECURE
    } else {
        PLAIN
    }
}

/// Whether a request came through the owner's proxy: its `Host` is a listed host name.
pub(crate) fn proxied(shared: &Shared, headers: &HeaderMap) -> bool {
    name(shared, headers) == SECURE
}

/// The value of a request's session cookie, by the name its `Host` gives it.
pub(crate) fn read<'a>(shared: &Shared, headers: &'a HeaderMap) -> Option<&'a str> {
    let name = name(shared, headers);
    let sent = headers.get_all(COOKIE).into_iter();
    let mut cookies = sent
        .filter_map(|cookies| cookies.to_str().ok())
        .flat_map(|cookies| cookies.split(';'))
        .filter_map(|cookie| cookie.trim().split_once('='));
    cookies.find_map(|(sent, value)| (sent == name).then_some(value))
}

/// The cookie's attributes, for a cookie of that name: never read by a script, sent with the
/// site's own requests and links to it, and `Secure` over HTTPS.
fn attributes(name: &str) -> &'static str {
    if name == SECURE {
        "Path=/; HttpOnly; Secure; SameSite=Lax"
    } else {
        "Path=/; HttpOnly; SameSite=Lax"
    }
}

/// The `Set-Cookie` that sets the session cookie, for as long as a session may go unused. Its
/// life is a number of seconds, never a date: a date is read on the device's clock, which may be
/// wrong.
pub(crate) fn set(name: &str, value: &str) -> HeaderValue {
    let seconds = UNUSED.as_secs();
    let cookie = format!("{name}={value}; Max-Age={seconds}; {}", attributes(name));
    HeaderValue::from_str(&cookie).expect("a session's cookie is a header's text")
}

/// The `Set-Cookie` that clears the session cookie in the browser.
pub(crate) fn clear(name: &str) -> HeaderValue {
    let cookie = format!("{name}=; Max-Age=0; {}", attributes(name));
    HeaderValue::from_str(&cookie).expect("a cleared cookie is a header's text")
}
