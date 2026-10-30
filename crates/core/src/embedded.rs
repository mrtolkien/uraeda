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

/// The proposal template, `assets/templates/specs/YYYY-MM-DD-feature-slug/proposal.md`.
pub const PROPOSAL: &str = "YYYY-MM-DD-feature-slug/proposal.md";

/// Whether a paragraph is a template's placeholder: bracketed, over one line or several.
pub fn is_placeholder(paragraph: &str) -> bool {
    let paragraph = paragraph.trim();
    paragraph.starts_with('[') && paragraph.ends_with(']')
}

/// Whether a line of markdown holds a template's placeholder as a span, like `[Project]` in
/// `# [Project] Constitution`: a bracketed span that is not a link (`[…](…)`, `[…][…]`, or a
/// shortcut reference to one of `labels`, the document's `[label]: …` definitions), an image, a
/// wikilink, a footnote, a callout (`[!…]`), or inside a code span.
pub fn has_placeholder_span(line: &str, labels: &[String]) -> bool {
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
pub fn reference_labels(text: &str) -> Vec<String> {
    text.lines()
        .filter_map(|line| {
            let rest = line.trim_start().strip_prefix('[')?;
            let (label, after) = rest.split_once(']')?;
            after.starts_with(':').then(|| label.to_string())
        })
        .collect()
}

/// The proposal template's paragraphs, frontmatter included, as blank lines separate them.
pub fn proposal_paragraphs() -> Vec<&'static str> {
    template(PROPOSAL)
        .unwrap_or_default()
        .split("\n\n")
        .map(str::trim)
        .filter(|paragraph| !paragraph.is_empty())
        .collect()
}

/// Each `##` heading of the proposal template with its placeholder, in order, without the
/// brackets, its lines joined: the guidance the editor shows in an empty section.
pub fn proposal_hints() -> Vec<(String, String)> {
    proposal_paragraphs()
        .windows(2)
        .filter_map(|pair| {
            let heading = pair[0].strip_prefix("## ")?;
            is_placeholder(pair[1]).then(|| {
                let hint = pair[1].trim()[1..pair[1].trim().len() - 1]
                    .split_whitespace()
                    .collect::<Vec<_>>()
                    .join(" ");
                (heading.to_string(), hint)
            })
        })
        .collect()
}
