//! The Uraeda skill, embedded in the binary at build time: its templates, for `check` and `init`,
//! and the whole skill, for `init` and `install` (see `specs/decisions/cli.md`).

use include_dir::{Dir, include_dir};

/// `skills/uraeda/`, as it was when the binary was built.
pub static SKILL: Dir<'static> = include_dir!("$CARGO_MANIFEST_DIR/../../skills/uraeda");

/// A template's text, by its path under `assets/templates/specs/`.
pub fn template(path: &str) -> Option<&'static str> {
    SKILL
        .get_file(format!("assets/templates/specs/{path}"))?
        .contents_utf8()
}

/// Whether a line of markdown holds a template's placeholder as a span, like `[Project]` in
/// `# [Project] Constitution`: a bracketed span that is not a link (`[…](…)`, `[…][…]`, or a
/// shortcut reference to one of `labels`, the document's `[label]: …` definitions), an image, a
/// wikilink, a footnote, a callout (`[!…]`), or inside a code span.
pub(crate) fn has_placeholder_span(line: &str, labels: &[String]) -> bool {
    let bytes = line.as_bytes();
    let mut at = 0;
    let mut code = false;
    while at < bytes.len() {
        match bytes[at] {
            b'`' => code = !code,
            b'\\' => at += 1,
            b'[' if !code => {
                if let Some(close) = closing(bytes, at) {
                    if is_placeholder_span(line, at, close, labels) {
                        return true;
                    }
                    at = close;
                }
            }
            _ => {}
        }
        at += 1;
    }
    false
}

/// The index of the `]` closing the `[` at `open`, counting nested brackets, escaped ones aside.
fn closing(bytes: &[u8], open: usize) -> Option<usize> {
    let mut depth = 0;
    let mut at = open;
    while at < bytes.len() {
        match bytes[at] {
            b'\\' => at += 1,
            b'[' => depth += 1,
            b']' => depth -= 1,
            _ => {}
        }
        if depth == 0 {
            return Some(at);
        }
        at += 1;
    }
    None
}

/// Whether the span from `open` to `close` is a placeholder, and none of the other uses of
/// brackets.
fn is_placeholder_span(line: &str, open: usize, close: usize, labels: &[String]) -> bool {
    let bytes = line.as_bytes();
    let inner = &line[open + 1..close];
    let image = open > 0 && bytes[open - 1] == b'!';
    let marked = inner.starts_with(['!', '^', '[']);
    let link = matches!(bytes.get(close + 1), Some(b'(' | b'['));
    let reference = labels.iter().any(|label| label.eq_ignore_ascii_case(inner));
    !(inner.trim().is_empty() || image || marked || link || reference)
}

/// The labels of a document's reference definitions, `[label]: url`, each on a line of its own.
pub(crate) fn reference_labels(text: &str) -> Vec<String> {
    text.lines()
        .filter_map(|line| {
            let rest = line.trim_start().strip_prefix('[')?;
            let (label, after) = rest.split_once(']')?;
            after.starts_with(':').then(|| label.to_string())
        })
        .collect()
}
