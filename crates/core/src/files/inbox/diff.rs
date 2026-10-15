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

/// Whether two texts share at least half their words, counted on both sides: an edit, rather
/// than another note.
fn similar(a: &str, b: &str) -> bool {
    let words = |text: &str| -> std::collections::HashSet<String> {
        text.split(|c: char| !c.is_alphanumeric())
            .filter(|w| !w.is_empty())
            .map(str::to_lowercase)
            .collect()
    };
    let (a, b) = (words(a), words(b));
    let common = a.intersection(&b).count();
    !a.is_empty() && !b.is_empty() && 4 * common >= a.len() + b.len()
}

/// The changes between two texts, in the order of `after`, as the priorities' diff finds them.
/// Then a removed note and an added one with a similar text are one move with the new text, so
/// a note edited, then moved, is one change.
pub fn diff(before: &str, after: &str) -> Vec<NoteChange> {
    use lines::Change;
    let mut changes: Vec<NoteChange> = lines::diff(&signature(before), &signature(after))
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
        .collect();
    let mut index = 0;
    while index < changes.len() {
        let NoteChange::Removed { category, text } = &changes[index] else {
            index += 1;
            continue;
        };
        let pair = changes.iter().position(
            |change| matches!(change, NoteChange::Added { text: added, .. } if similar(text, added)),
        );
        let Some(pair) = pair else {
            index += 1;
            continue;
        };
        let from = category.clone();
        if let NoteChange::Added { category, text } = changes[pair].clone() {
            changes[pair] = NoteChange::Moved {
                from,
                to: category,
                text,
            };
        }
        changes.remove(index);
    }
    changes
}
