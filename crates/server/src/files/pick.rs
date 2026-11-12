//! Pick mode in a mockup's page: the page asked with `uraeda-pick` carries the pick script,
//! which tells the app the element pressed in it.

use axum::http::Uri;

/// The pick script, which tells the app the element pressed in a page while it picks.
const PICK: &str = include_str!("../../../../skills/uraeda/assets/storybook/uraeda-pick.js");

/// Whether the page is asked for picking: its query names `uraeda-pick`.
pub(super) fn picking(uri: &Uri) -> bool {
    let query = uri.query().unwrap_or_default();
    query
        .split('&')
        .any(|pair| pair.split('=').next() == Some("uraeda-pick"))
}

/// The page with the pick script at the end of its head; at its start
/// when it has no head.
pub(super) fn with_pick(page: &str) -> String {
    let script = format!("<script>{PICK}</script>");
    let at = page.to_ascii_lowercase().find("</head>").unwrap_or(0);
    format!("{}{script}{}", &page[..at], &page[at..])
}
