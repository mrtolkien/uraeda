//! Parsers and edits for each kind of workflow file. Edits keep every byte they do not change,
//! Windows line endings included.

// The readers of a text alone are a crate of their own, which the app's web build takes too.
pub use uraeda_text::{document, markdown, stories};

pub mod clarifications;
pub mod frontmatter;
pub mod image_links;
pub mod inbox;
pub mod items;
pub(crate) mod lines;
pub mod nested;
pub mod outline;
pub mod plan;
pub mod preview;
pub mod priorities;
pub mod proposal;
pub mod record;
pub mod retarget;
pub mod review;
pub mod rulings;
pub mod spec;

pub(crate) use uraeda_text::markdown::with_unix_newlines;

/// Whether a line opens or closes a fenced code block.
pub(crate) fn is_fence(line: &str) -> bool {
    let line = line.trim_start();
    line.starts_with("```") || line.starts_with("~~~")
}

/// The lines of a text outside fenced code blocks, with their 1-based numbers.
pub(crate) fn lines_outside_code(text: &str) -> impl Iterator<Item = (usize, &str)> {
    let mut in_code = false;
    text.lines().enumerate().filter_map(move |(index, line)| {
        if is_fence(line) {
            in_code = !in_code;
            return None;
        }
        (!in_code).then_some((index + 1, line))
    })
}
