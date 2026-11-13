//! Pick mode in a mockup's page: the page asked with `uraeda-pick` carries the pick script,
//! which tells the app the element pressed in it.

use axum::http::Uri;

/// The pick script, which tells the app the element pressed in a page while it picks.
pub(crate) const PICK: &str =
    include_str!("../../../../skills/uraeda/assets/storybook/uraeda-pick.js");

/// Whether the page is asked for picking: its query names `uraeda-pick`.
pub(super) fn picking(uri: &Uri) -> bool {
    let query = uri.query().unwrap_or_default();
    query
        .split('&')
        .any(|pair| pair.split('=').next() == Some("uraeda-pick"))
}

/// The elements whose content is text, whatever it looks like: no tag opens in it.
const TEXT_ONLY: [&str; 4] = ["script", "style", "title", "textarea"];

/// The page with the pick script, where it changes nothing of how the page is read: see
/// [`place`].
pub(super) fn with_pick(page: &str) -> String {
    let at = place(page);
    format!("{}<script>{PICK}</script>{}", &page[..at], &page[at..])
}

/// Where the pick script goes in a page: after its `<head ...>` tag, else before its `<body`,
/// else after its `<html ...>` tag, else after its doctype, and at its start only for a fragment
/// with none of them. Never before the doctype: a page that starts with a script is laid out in
/// quirks mode, and no longer looks as it does when viewed. A comment's text, and a script's, a
/// style's, a title's, or a field's, is passed over: a tag named there is no tag.
fn place(page: &str) -> usize {
    // Lowercased byte for byte, so a place found in it is the same place in the page.
    let page = page.to_ascii_lowercase();
    // After the doctype, then after `<html ...>`: where the script goes without a head or a body.
    let mut fallback = 0;
    let mut at = 0;
    while let Some(open) = find(&page, at, "<") {
        if page[open..].starts_with("<!--") {
            at = find(&page, open + 4, "-->").map_or(page.len(), |end| end + 3);
            continue;
        }
        let name = name(&page[open + 1..]);
        if name.is_empty() {
            // A `<` that opens no tag, as in `1 < 2`.
            at = open + 1;
            continue;
        }
        let close = tag_end(&page, open + 1 + name.len());
        match name {
            "head" => return close,
            "body" => return open,
            "html" | "!doctype" => fallback = close,
            _ => {}
        }
        at = match TEXT_ONLY.contains(&name) {
            true => find(&page, close, &format!("</{name}")).unwrap_or(page.len()),
            false => close,
        };
    }
    fallback
}

/// Where `text` is in the page, from `from` on.
fn find(page: &str, from: usize, text: &str) -> Option<usize> {
    page[from..].find(text).map(|found| from + found)
}

/// The name of the tag that `rest` follows the `<` of, as `head`, `/head`, or `!doctype`: empty
/// when no tag opens there.
fn name(rest: &str) -> &str {
    let lead = usize::from(rest.starts_with(['!', '/']));
    let named = |byte: u8| byte.is_ascii_alphanumeric() || byte == b'-';
    let length = rest.bytes().skip(lead).position(|byte| !named(byte));
    let end = length.map_or(rest.len(), |length| lead + length);
    let starts = rest[lead..end].bytes().next();
    match starts.is_some_and(|byte| byte.is_ascii_alphabetic()) {
        true => &rest[..end],
        false => "",
    }
}

/// Where the tag whose attributes start at `from` ends, past its `>`: a `>` in a quoted value is
/// the value's. The page's end for a tag that never closes.
fn tag_end(page: &str, from: usize) -> usize {
    // A quote opens a value only right after its `=`.
    let (mut quote, mut value_next) = (None, false);
    for (at, byte) in page.bytes().enumerate().skip(from) {
        match (quote, byte) {
            (Some(open), _) if byte == open => quote = None,
            (Some(_), _) => {}
            (None, b'>') => return at + 1,
            (None, b'"' | b'\'') if value_next => (quote, value_next) = (Some(byte), false),
            (None, b'=') => value_next = true,
            (None, _) if byte.is_ascii_whitespace() => {}
            (None, _) => value_next = false,
        }
    }
    page.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Pages, each with `^` where the pick script goes.
    const PLACES: &[&str] = &[
        // In the head, right after its tag: whatever its case, and its attributes.
        "<!doctype html><html><head>^<title>UI</title></head><body><p>UI</p></body></html>",
        "<!DOCTYPE html>\n<HTML lang=\"en\">\n<HEAD data-a=\"1 > 0\" data-b='>'>^\n<META charset=\"utf-8\">",
        // A head that never closes is still the head.
        "<!doctype html><head>^<title>UI</title><body><p>UI</p>",
        "<!doctype html><head/>^<body><p>UI</p>",
        // Without a head: before the body, else after `<html>`, else after the doctype.
        "<!doctype html><html lang=\"en\">^<body class=\"a\"><p>UI</p></body></html>",
        "<!doctype html>^<body><p>UI</p>",
        "<!doctype html><html lang=\"en\">^<p>UI</p>",
        "\n<!doctype html>^<p>UI</p>",
        // A fragment has none of them, and no mode to lose: at its start.
        "^<p>UI</p>",
        "^",
        // A comment's text is no tag, and one that never ends hides the rest.
        "<!doctype html><!-- <head> and </head> é --><html><head>^</head></html>",
        "<!doctype html>^<!-- <head>",
        // Nor is a script's, a style's, a title's, or a field's.
        "<!doctype html><script>document.write(\"<head><body>\");</script>^<body><p>UI</p>",
        "<!doctype html><style>a::after { content: \"<body>\" }</style>^<BODY><p>UI</p>",
        "<!doctype html><title>The <head> tag</title><html>^<p>UI</p>",
        "<!doctype html>^<p>UI</p><textarea><body></textarea>",
        // A tag whose name only starts like one, and a `<` that opens none.
        "<!doctype html>^<header>1 < 2</header><bodyguard></bodyguard>",
    ];

    // A mockup looks the same picked as viewed: a script before the doctype puts the page in
    // quirks mode, where its layout differs, and comments are then made on another page. And a
    // page's own text, in a comment or a script, never takes the script in.
    #[test]
    fn the_pick_script_goes_after_the_doctype_at_the_first_safe_place() {
        let script = format!("<script>{PICK}</script>");
        let placed = |page: &&str| with_pick(&page.replacen('^', "", 1)).replacen(&script, "^", 1);
        let places = PLACES.iter().map(|page| (*page).to_owned());

        assert_eq!(
            PLACES.iter().map(placed).collect::<Vec<_>>(),
            places.collect::<Vec<_>>()
        );
    }
}
