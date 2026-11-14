//! The HTML every page shares: escaping, and the page around a body.

use std::fmt::Write as _;

use crate::assets;

/// `text` escaped for HTML text and attribute values.
pub fn escape(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            c => out.push(c),
        }
    }
    out
}

/// A whole page: `title`, escaped, and `body`, HTML already. Its style sheet and script are the
/// embedded ones, at addresses relative to the page's, so the token is kept without being named.
/// `base` is the path back to the token's folder from the page: `./` for the home page.
pub fn page_at(base: &str, title: &str, body: &str) -> String {
    let mut out = String::with_capacity(body.len() + 600);
    let _ = write!(
        out,
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">\
         <meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\
         <meta name=\"referrer\" content=\"no-referrer\"><link rel=\"icon\" href=\"data:,\">\
         <title>{title}</title>\
         <link rel=\"stylesheet\" href=\"{base}a/{version}/ura.css\">\
         <script defer src=\"{base}a/{version}/ura.js\"></script>\
         </head><body>{body}</body></html>",
        title = escape(title),
        version = assets::version(),
    );
    out
}

/// A page at the token's folder itself.
pub fn page(title: &str, body: &str) -> String {
    page_at("./", title, body)
}
