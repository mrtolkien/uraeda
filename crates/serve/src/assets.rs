//! The style sheet and the script, embedded in the binary. Their address holds a version, the
//! hash of their text, so a browser keeps them for good and fetches them again only after a change.

use std::sync::OnceLock;

use axum::extract::Path;
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};

pub const CSS: &str = include_str!("../assets/ura.css");
pub const JS: &str = include_str!("../assets/ura.js");

/// The version of the embedded files: a hash of both, in hex.
pub fn version() -> &'static str {
    static VERSION: OnceLock<String> = OnceLock::new();
    VERSION.get_or_init(|| {
        // FNV-1a: enough to tell two versions apart, with nothing to add.
        let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
        for byte in CSS.bytes().chain(JS.bytes()) {
            hash ^= u64::from(byte);
            hash = hash.wrapping_mul(0x0100_0000_01b3);
        }
        format!("{hash:016x}")
    })
}

/// `GET /a/<version>/<name>`: an embedded file, kept for a year when its version is the current
/// one. It answers anyone: the sign-in page is drawn with it.
pub async fn serve(Path((asked, name)): Path<(String, String)>) -> Response {
    let (body, kind) = match name.as_str() {
        "ura.css" => (CSS, "text/css; charset=utf-8"),
        "ura.js" => (JS, "text/javascript; charset=utf-8"),
        _ => return StatusCode::NOT_FOUND.into_response(),
    };
    let cache = if asked == version() {
        "public, max-age=31536000, immutable"
    } else {
        "no-cache"
    };
    (
        [(header::CONTENT_TYPE, kind), (header::CACHE_CONTROL, cache)],
        body,
    )
        .into_response()
}
