//! The changes between two texts of `INBOX.md`, note by note.

use super::super::lines;
use super::{parse, scan};

/// A change to one note between two texts, each note named by its text without marks or
/// markdown, and each category by its name, `None` for no category.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum NoteChange {
    Added {
        category: Option<String>,
        text: String,
    },
    Removed {
        category: Option<String>,
        text: String,
    },
    /// To another category, or to another place in the same one, its text maybe edited.
    Moved {
        from: Option<String>,
        to: Option<String>,
        text: String,
    },
    Edited {
        category: Option<String>,
        before: String,
        after: String,
    },
}

fn signature(text: &str) -> Vec<lines::Signed<Option<String>>> {
    let unix = text.replace("\r\n", "\n");
    let lines: Vec<&str> = unix.split('\n').collect();
    parse(&unix)
        .into_iter()
        .zip(scan(&unix))
        .map(|(note, (_, item))| lines::Signed {
            section: note.category,
            markdown: lines::signed_markdown(&lines, &item),
            text: note.text,
        })
        .collect()
}

/// The changes between two texts, in the order of `after`, as the priorities' diff finds them: a
/// move keeps the note's markdown, marks included, and an edit keeps its place. A note edited, then
/// moved, is a removal and an addition.
pub fn diff(before: &str, after: &str) -> Vec<NoteChange> {
    use lines::Change;
    lines::diff(&signature(before), &signature(after))
        .into_iter()
        .map(|change| match change {
            Change::Added { section, text } => NoteChange::Added {
                category: section,
                text,
            },
            Change::Removed { section, text } => NoteChange::Removed {
                category: section,
                text,
            },
            Change::Moved { from, to, text } => NoteChange::Moved { from, to, text },
            Change::Edited {
                section,
                before,
                after,
            } => NoteChange::Edited {
                category: section,
                before,
                after,
            },
        })
        .collect()
}
