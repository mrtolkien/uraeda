//! The entries of `PRIORITIES.md`, by section, and the edits drafting and starting make.

use super::lines::{self, Item};

mod edits;

pub use edits::{
    add, add_started, edit, insert_entry, link, move_entry, move_to_started, remove, remove_written,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, serde::Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Section {
    Now,
    Next,
    Later,
    Blocked,
}

impl Section {
    const ALL: [Section; 4] = [
        Section::Now,
        Section::Next,
        Section::Later,
        Section::Blocked,
    ];

    pub fn title(&self) -> &'static str {
        match self {
            Section::Now => "Now",
            Section::Next => "Next",
            Section::Later => "Later",
            Section::Blocked => "Blocked",
        }
    }

    /// A section's kebab-case name, as entry ids use it.
    pub fn id(&self) -> &'static str {
        match self {
            Section::Now => "now",
            Section::Next => "next",
            Section::Later => "later",
            Section::Blocked => "blocked",
        }
    }

    pub fn from_id(id: &str) -> Option<Section> {
        Section::ALL.into_iter().find(|section| section.id() == id)
    }

    fn from_heading(line: &str) -> Option<Section> {
        let title = line.strip_prefix("## ")?.trim();
        Section::ALL
            .into_iter()
            .find(|section| section.title().eq_ignore_ascii_case(title))
    }
}

/// A top-level item of a section.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Entry {
    pub section: Section,
    /// From 1, in its section.
    pub position: usize,
    /// Its text without markdown, links replaced by their text.
    pub text: String,
    /// Its first link's target.
    pub link: Option<String>,
    /// Its first line.
    pub line: usize,
    /// Its lines.
    item: Item,
}

/// Every entry of `PRIORITIES.md`, in order.
pub fn parse(text: &str) -> Vec<Entry> {
    let lines: Vec<&str> = text.lines().collect();
    // Each heading counts, by its line, so an entry's position restarts under a repeated heading.
    let found = lines::items(text, |number, line| {
        Section::from_heading(line).map(|section| (section, number))
    });
    let mut entries: Vec<Entry> = Vec::new();
    let mut previous = None;
    for ((section, heading), item) in found {
        let position = if previous == Some(heading) {
            entries.last().map_or(0, |e| e.position) + 1
        } else {
            1
        };
        previous = Some(heading);
        let markdown = lines::item_text(&lines, &item).join("\n");
        let (text, link) = lines::plain(&markdown);
        entries.push(Entry {
            section,
            position,
            text,
            link,
            line: item.line,
            item,
        });
    }
    entries
}

impl Entry {
    /// Its nested lines in `text`, the text it was parsed from, without the indent they share:
    /// what a draft of it takes.
    pub fn nested(&self, text: &str) -> Vec<String> {
        let lines: Vec<String> = text
            .lines()
            .skip(self.item.text_end)
            .take(self.item.end - self.item.text_end)
            .map(String::from)
            .collect();
        lines::dedented(&lines)
    }
}

/// An entry of `PRIORITIES.md`, for editing: its markdown, its spans, and its nested lines.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryItem {
    /// `next-2`: its section and its position in it, from 1.
    pub id: String,
    /// Its address, stable while its text or draft stays: see [`keys`].
    pub key: String,
    /// The markdown of its text, after its marker, on one line.
    pub text: String,
    pub spans: Vec<super::document::Span>,
    pub start_line: u32,
    pub end_line: u32,
    /// Its lines as written, its marker, wrapped text, and nested lines included: what an Undo of
    /// its removal writes back.
    pub lines: Vec<String>,
    /// Its nested lines, as written.
    pub nested: Vec<String>,
    /// The text of each nested item, without its marker.
    pub nested_spans: Vec<Vec<super::document::Span>>,
    /// The draft or backlog file it links, when it exists: set by the workspace, see
    /// [`Workspace::join_priorities`](crate::workspace::Workspace::join_priorities).
    pub draft: Option<crate::workspace::LinkedFile>,
    /// The feature or change it links, while it runs: set by the workspace.
    pub running: Option<crate::workspace::RunningFeature>,
}

#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SectionItems {
    /// `now`, `next`, `later`, or `blocked`.
    pub section: String,
    pub title: String,
    pub entries: Vec<EntryItem>,
}

/// `PRIORITIES.md` read for editing.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Priorities {
    /// The SHA-256 of the text, to refuse edits over a change made elsewhere.
    pub hash: String,
    pub sections: Vec<SectionItems>,
    /// How many entries were added, moved, edited, or removed since the last commit.
    pub changes: u32,
}

/// Each entry's key, in order: the slug of its linked draft's file name when it links a file of
/// `specs/drafts/`, otherwise the slug of its text, links replaced by their text, or `line` when
/// that slug is empty. A key already taken by an earlier entry gets `-2`, `-3`, ...
pub fn keys(entries: &[Entry]) -> Vec<String> {
    let slugs = entries.iter().map(|entry| {
        let draft = entry
            .link
            .as_deref()
            .and_then(|link| crate::workspace::resolve("specs", link))
            .and_then(|path| {
                let name = path.strip_prefix("specs/drafts/")?;
                Some(crate::slug::from_text(
                    name.strip_suffix(".md").unwrap_or(name),
                ))
            })
            .filter(|slug| !slug.is_empty());
        draft.unwrap_or_else(|| crate::slug::from_text(&entry.text))
    });
    lines::unique_keys(slugs.collect())
}

fn entry_id(entry: &Entry) -> String {
    format!("{}-{}", entry.section.id(), entry.position)
}

/// The sections of `PRIORITIES.md`, in order, with their entries. `committed` is the text at the
/// last commit, to count the changes.
pub fn read(text: &str, committed: Option<&str>) -> Priorities {
    let unix = text.replace("\r\n", "\n");
    let lines: Vec<&str> = unix.split('\n').collect();
    let entries = parse(&unix);
    let keys = keys(&entries);
    let sections = Section::ALL
        .into_iter()
        .map(|section| SectionItems {
            section: section.id().to_string(),
            title: section.title().to_string(),
            entries: entries
                .iter()
                .zip(&keys)
                .filter(|(entry, _)| entry.section == section)
                .map(|(entry, key)| {
                    let markdown = lines::item_text(&lines, &entry.item).join(" ");
                    let doc = super::document::parse(&markdown, "specs");
                    EntryItem {
                        id: entry_id(entry),
                        key: key.clone(),
                        spans: doc
                            .blocks
                            .first()
                            .map(|b| b.spans.clone())
                            .unwrap_or_default(),
                        text: markdown,
                        start_line: entry.line as u32,
                        end_line: entry.item.end as u32,
                        lines: lines[entry.line - 1..entry.item.end]
                            .iter()
                            .map(|l| l.to_string())
                            .collect(),
                        nested: lines[entry.item.text_end..entry.item.end]
                            .iter()
                            .map(|l| l.to_string())
                            .collect(),
                        nested_spans: lines::nested_spans(
                            &lines[entry.item.text_end..entry.item.end],
                        ),
                        draft: None,
                        running: None,
                    }
                })
                .collect(),
        })
        .collect();
    Priorities {
        hash: super::document::hash(text),
        sections,
        changes: committed.map_or(0, |committed| changes(committed, text)),
    }
}

fn signature(text: &str) -> Vec<lines::Signed<Section>> {
    let unix = text.replace("\r\n", "\n");
    let lines: Vec<&str> = unix.split('\n').collect();
    parse(&unix)
        .into_iter()
        .map(|entry| lines::Signed {
            section: entry.section,
            markdown: lines::signed_markdown(&lines, &entry.item),
            text: entry.text,
        })
        .collect()
}

/// A change to one entry between two texts, each entry named by its text without markdown.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EntryChange {
    Added {
        section: Section,
        text: String,
    },
    Removed {
        section: Section,
        text: String,
    },
    /// To another section, or to another place in the same one.
    Moved {
        from: Section,
        to: Section,
        text: String,
    },
    Edited {
        section: Section,
        before: String,
        after: String,
    },
}

/// The changes between two texts, in the order of `after`, as [`lines::diff`] finds them.
pub fn diff(before: &str, after: &str) -> Vec<EntryChange> {
    use lines::Change;
    lines::diff(&signature(before), &signature(after))
        .into_iter()
        .map(|change| match change {
            Change::Added { section, text } => EntryChange::Added { section, text },
            Change::Removed { section, text } => EntryChange::Removed { section, text },
            Change::Moved { from, to, text } => EntryChange::Moved { from, to, text },
            Change::Edited {
                section,
                before,
                after,
            } => EntryChange::Edited {
                section,
                before,
                after,
            },
        })
        .collect()
}

/// How many entries were added, moved, edited, or removed between two texts, as [`diff`] finds
/// them.
pub fn changes(before: &str, after: &str) -> u32 {
    diff(before, after).len() as u32
}
