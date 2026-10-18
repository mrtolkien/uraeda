//! Parsers and edits for each kind of workflow file. Edits keep every byte they do not change,
//! Windows line endings included.

pub mod clarifications;
pub mod document;
pub mod frontmatter;
pub mod inbox;
pub mod items;
pub(crate) mod lines;
pub mod markdown;
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
pub mod stories;

/// Runs an edit on the text with `\n` line endings, and gives the result the text's own endings.
pub(crate) fn with_unix_newlines<T>(
    text: &str,
    edit: impl FnOnce(&str) -> Result<String, T>,
) -> Result<String, T> {
    if text.contains("\r\n") {
        edit(&text.replace("\r\n", "\n")).map(|edited| edited.replace('\n', "\r\n"))
    } else {
        edit(text)
    }
}

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
