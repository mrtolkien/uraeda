//! A file's outline: its headings, each named as the workflow item it holds, for editors' symbols.

use serde::Serialize;

use super::markdown::Document;
use super::{clarifications, items, review, spec};
use crate::workspace::FileKind;

/// What a heading of a workflow file holds.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum OutlineKind {
    Heading,
    /// A round's question or follow-up, `## Q2: ...` or `### Q2.B: ...`.
    Question,
    /// A spec's user story, `### US1: ...`.
    Story,
    /// A plan's task, `## Task 3: ...`.
    Task,
    /// A review's comment, `## C1: ...`.
    Comment,
}

/// A heading of a file, in file order.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlineEntry {
    pub kind: OutlineKind,
    /// The item's id, `Q2.B`, `US1`, `Task 3`, `C1`, or the heading's text.
    pub name: String,
    /// The rest of an item's heading after its id; `None` for a plain heading.
    pub detail: Option<String>,
    pub level: u8,
    /// The heading's line, 1-based.
    pub line: usize,
    /// The section's last line, 1-based: before the next heading of the same level or above, or
    /// the file's last line.
    pub end_line: usize,
}

/// The outline of the file named `name` holding `text`: every heading, the items of its kind named
/// by their ids.
pub fn outline(name: &str, text: &str) -> Vec<OutlineEntry> {
    let kind = FileKind::of(name).map(|(kind, _)| kind);
    let document = Document::parse(text);
    let headings = &document.headings;
    headings
        .iter()
        .enumerate()
        .map(|(index, heading)| {
            let end_line = headings[index + 1..]
                .iter()
                .find(|next| next.level <= heading.level)
                .map_or(document.line_count, |next| next.line - 1)
                .max(heading.line);
            let (kind, name, detail) = item(kind, heading.level, &heading.text).map_or_else(
                || (OutlineKind::Heading, heading.text.clone(), None),
                |(kind, name, detail)| (kind, name, Some(detail)),
            );
            OutlineEntry {
                kind,
                name,
                detail,
                level: heading.level,
                line: heading.line,
                end_line,
            }
        })
        .collect()
}

/// The item a heading holds, by its file's kind: its kind, id, and the rest of its heading.
fn item(kind: Option<FileKind>, level: u8, text: &str) -> Option<(OutlineKind, String, String)> {
    match (kind?, level) {
        (FileKind::Clarifications, _) => clarifications::question_heading(u32::from(level), text)
            .map(|(id, _, title)| (OutlineKind::Question, id, title)),
        (FileKind::Spec, 3) => {
            let (id, rest) = text.split_once(':')?;
            spec::story_heading(text)?;
            Some((OutlineKind::Story, id.to_string(), rest.trim().to_string()))
        }
        (FileKind::Plan, 2) => items::task_heading(text)
            .map(|(number, title)| (OutlineKind::Task, format!("Task {number}"), title)),
        (FileKind::Review, 2) => review::comment_heading(text).map(|(number, anchor)| {
            (
                OutlineKind::Comment,
                format!("C{number}"),
                anchor.to_string(),
            )
        }),
        _ => None,
    }
}
