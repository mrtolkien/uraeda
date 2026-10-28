//! The proposals of `PRIORITIES.md`, by section, and the edits expanding and starting make.

use super::lines::{self, Item};

mod context;
mod edits;
mod outline;

pub use super::nested::{NestedItem, OutlineEdit};
pub use context::{SectionContext, contexts};
pub use outline::{Drop, append_under, drop_item, outline, remove_under};

pub use edits::{
    add, add_started, edit, insert_proposal, link, move_proposal, move_to_started, remove,
    remove_added, remove_linked, remove_written,
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

    /// A section's kebab-case name, as proposal ids use it.
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
pub struct Proposal {
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

/// Every proposal of `PRIORITIES.md`, in order.
pub fn parse(text: &str) -> Vec<Proposal> {
    let lines: Vec<&str> = text.lines().collect();
    // Each heading counts, by its line, so a proposal's position restarts under a repeated heading.
    let found = lines::items(text, |number, line| {
        Section::from_heading(line).map(|section| (section, number))
    });
    let mut proposals: Vec<Proposal> = Vec::new();
    let mut previous = None;
    for ((section, heading), item) in found {
        let position = if previous == Some(heading) {
            proposals.last().map_or(0, |e| e.position) + 1
        } else {
            1
        };
        previous = Some(heading);
        let markdown = lines::item_text(&lines, &item).join("\n");
        let (text, link) = lines::plain(&markdown);
        proposals.push(Proposal {
            section,
            position,
            text,
            link,
            line: item.line,
            item,
        });
    }
    proposals
}

impl Proposal {
    /// Its nested lines in `text`, the text it was parsed from, without the indent they share:
    /// what its file takes when it is expanded.
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

/// A proposal of `PRIORITIES.md`, for editing: its markdown, its spans, and its nested lines.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalItem {
    /// `next-2`: its section and its position in it, from 1.
    pub id: String,
    /// Its address, stable while its text or file stays: see [`keys`].
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
    /// Its nested items at any depth, in the order of the file: what its outline shows, and what
    /// an edit of one names by its index.
    pub children: Vec<NestedItem>,
    /// The proposal file it links, when it exists: set by the workspace, see
    /// [`Workspace::join_priorities`](crate::workspace::Workspace::join_priorities).
    pub file: Option<crate::workspace::LinkedFile>,
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
    /// The text of the first callout under the first of its headings that has one, before its
    /// first proposal: what the section holds.
    pub context: Option<String>,
    pub proposals: Vec<ProposalItem>,
}

/// `PRIORITIES.md` read for editing.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Priorities {
    /// The SHA-256 of the text, to refuse edits over a change made elsewhere.
    pub hash: String,
    pub sections: Vec<SectionItems>,
    /// How many proposals were added, moved, edited, or removed since the last commit.
    pub changes: u32,
    /// The changes the commit would hold, each as a line: what a commit page shows.
    pub change_lines: Vec<String>,
}

/// Each proposal's key, in order: the slug of its linked file's name when it links a file of
/// `specs/proposals/`, otherwise the slug of its text, links replaced by their text, or `line` when
/// that slug is empty. A key already taken by an earlier proposal gets `-2`, `-3`, ...
pub fn keys(proposals: &[Proposal]) -> Vec<String> {
    let slugs = proposals.iter().map(|proposal| {
        let file = proposal
            .link
            .as_deref()
            .and_then(|link| crate::workspace::resolve("specs", link))
            .and_then(|path| {
                let name = path.strip_prefix("specs/proposals/")?;
                Some(crate::slug::from_text(
                    name.strip_suffix(".md").unwrap_or(name),
                ))
            })
            .filter(|slug| !slug.is_empty());
        file.unwrap_or_else(|| crate::slug::from_text(&proposal.text))
    });
    lines::unique_keys(slugs.collect())
}

fn proposal_id(proposal: &Proposal) -> String {
    format!("{}-{}", proposal.section.id(), proposal.position)
}

/// The sections of `PRIORITIES.md`, in order, with their proposals. `committed` is the text at the
/// last commit, to count the changes.
pub fn read(text: &str, committed: Option<&str>) -> Priorities {
    let unix = text.replace("\r\n", "\n");
    let lines: Vec<&str> = unix.split('\n').collect();
    let proposals = parse(&unix);
    let keys = keys(&proposals);
    let contexts = contexts(&unix);
    let sections = Section::ALL
        .into_iter()
        .map(|section| SectionItems {
            section: section.id().to_string(),
            title: section.title().to_string(),
            context: contexts
                .iter()
                .filter(|context| context.section == section)
                .find_map(|context| context.text.clone()),
            proposals: proposals
                .iter()
                .zip(&keys)
                .filter(|(proposal, _)| proposal.section == section)
                .map(|(proposal, key)| {
                    let markdown = lines::item_text(&lines, &proposal.item).join(" ");
                    let doc = super::document::parse(&markdown, "specs");
                    ProposalItem {
                        id: proposal_id(proposal),
                        key: key.clone(),
                        spans: doc
                            .blocks
                            .first()
                            .map(|b| b.spans.clone())
                            .unwrap_or_default(),
                        text: markdown,
                        start_line: proposal.line as u32,
                        end_line: proposal.item.end as u32,
                        lines: lines[proposal.line - 1..proposal.item.end]
                            .iter()
                            .map(|l| l.to_string())
                            .collect(),
                        nested: lines[proposal.item.text_end..proposal.item.end]
                            .iter()
                            .map(|l| l.to_string())
                            .collect(),
                        nested_spans: lines::nested_spans(
                            &lines[proposal.item.text_end..proposal.item.end],
                        ),
                        children: super::nested::nested_items(
                            key,
                            &lines[proposal.item.text_end..proposal.item.end],
                        ),
                        file: None,
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
        change_lines: Vec::new(),
    }
}

fn signature(text: &str) -> Vec<lines::Signed<Section>> {
    let unix = text.replace("\r\n", "\n");
    let lines: Vec<&str> = unix.split('\n').collect();
    parse(&unix)
        .into_iter()
        .map(|proposal| lines::Signed {
            section: proposal.section,
            markdown: lines::signed_markdown(&lines, &proposal.item),
            text: proposal.text,
        })
        .collect()
}

/// A change to one proposal between two texts, each proposal named by its text without markdown.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ProposalChange {
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
pub fn diff(before: &str, after: &str) -> Vec<ProposalChange> {
    use lines::Change;
    lines::diff(&signature(before), &signature(after))
        .into_iter()
        .map(|change| match change {
            Change::Added { section, text } => ProposalChange::Added { section, text },
            Change::Removed { section, text } => ProposalChange::Removed { section, text },
            Change::Moved { from, to, text } => ProposalChange::Moved { from, to, text },
            Change::Edited {
                section,
                before,
                after,
            } => ProposalChange::Edited {
                section,
                before,
                after,
            },
        })
        .collect()
}

/// How many proposals were added, moved, edited, or removed between two texts, as [`diff`] finds
/// them.
pub fn changes(before: &str, after: &str) -> u32 {
    diff(before, after).len() as u32
}
