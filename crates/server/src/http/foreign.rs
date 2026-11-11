//! What Uraeda's origin never shares with code that is not the server's own, a preview's dev
//! server or an extension's route: a request reaches it without the client's credentials, and
//! its answer comes back without what would set or clear the origin's own state.

use axum::http::HeaderName;

/// The client's credentials: the session's cookie, every cookie on Uraeda's origin being
/// Uraeda's, and a device's or the host's token.
const CREDENTIALS: [&str; 2] = ["authorization", "cookie"];

/// What an answer would set on Uraeda's own origin: its cookies, and site data clearing.
const OWN_ORIGIN: [&str; 3] = ["clear-site-data", "set-cookie", "set-cookie2"];

/// Whether a request's header carries the client's credentials: it is never passed on.
pub(crate) fn credential(name: &HeaderName) -> bool {
    CREDENTIALS.contains(&name.as_str())
}

/// Whether an answer's header would reach Uraeda's own origin: it is never passed back.
pub(crate) fn reaches_origin(name: &HeaderName) -> bool {
    OWN_ORIGIN.contains(&name.as_str())
}
