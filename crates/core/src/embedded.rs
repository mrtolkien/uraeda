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
