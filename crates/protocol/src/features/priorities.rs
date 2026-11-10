//! The priorities, `PRIORITIES.md` read for editing, and the actions that write its lines.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::RepositoryArgs;
use super::document::Span;
use super::duplicates::{PullRequestView, StepView};
use super::undo::{FileWritten, ListWritten};
use crate::registry::Record;

impl Record for Priorities {
    const NAME: &'static str = "Priorities";
    type Args = RepositoryArgs;
    type Value = Self;
}

/// `PRIORITIES.md` read for editing.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Priorities {
    /// The SHA-256 of the text, to refuse edits over a change made elsewhere.
    pub hash: String,
    pub sections: Vec<SectionItems>,
    /// How many proposals were added, moved, edited, or removed since the last commit.
    pub changes: u32,
    /// The changes the commit would hold, each as a line: what the Git page shows.
    pub change_lines: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
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

/// A proposal of `PRIORITIES.md`, for editing: its markdown, its spans, and its nested lines.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProposalItem {
    /// `next-2`: its section and its position in it, from 1.
    pub id: String,
    /// Its address, stable while its text or file stays: see the core's `keys`.
    pub key: String,
    /// The markdown of its text, after its marker, on one line.
    pub text: String,
    pub spans: Vec<Span>,
    pub start_line: u32,
    pub end_line: u32,
    /// Its lines as written, its marker, wrapped text, and nested lines included.
    pub lines: Vec<String>,
    /// Its nested lines, as written.
    pub nested: Vec<String>,
    /// The text of each nested item, without its marker.
    pub nested_spans: Vec<Vec<Span>>,
    /// Its nested items at any depth, in the order of the file: what its outline shows, and what
    /// an edit of one names by its index.
    pub children: Vec<NestedItem>,
    /// The proposal file it links, when it exists: set by the workspace, see
    /// `Workspace::join_priorities`.
    pub file: Option<LinkedFile>,
    /// The feature or change it links, while it runs: set by the workspace.
    pub running: Option<RunningFeature>,
    /// The feature or change it links, once merged: set by the workspace.
    pub merged: Option<MergedFeature>,
}

/// An item nested under a list's item, for editing: its address, its depth, and its text.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct NestedItem {
    /// Its address, `<item's key>/<slug of its text>`, unique under its item as the items' keys
    /// are: stable while its text stays.
    pub key: String,
    /// 1 for the item's own items, 2 for theirs, ...
    pub depth: u32,
    /// The markdown of its text, after its marker, on one line.
    pub text: String,
    pub spans: Vec<Span>,
}

/// The proposal file a proposal of the priorities links, as it is on the default branch.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct LinkedFile {
    /// From the top level: `specs/proposals/x.md`, `specs/proposals/y/proposal.md`.
    pub path: String,
}

/// The feature or change a proposal of the priorities links, while its step is not `done`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RunningFeature {
    pub folder: String,
    /// Whether it is a change.
    pub change: bool,
    pub step: StepView,
}

/// The feature or change a proposal of the priorities links, once its step is `done`: merged, its
/// line left for `ura clean` to remove.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct MergedFeature {
    pub folder: String,
    /// Whether it is a change.
    pub change: bool,
    /// Its pull request, from its record's `pull-request`.
    pub pull_request: Option<PullRequestView>,
}

/// Adds a line at the end of a section.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProposalsAdd {
    /// The repository's name in the list.
    pub repo: String,
    /// The section's id: `now`, `next`, `later`, or `blocked`.
    pub section: String,
    /// The line, as markdown.
    pub text: String,
    /// The priorities' hash as read.
    pub hash: String,
}

action!(ProposalsAdd, "proposals.add", ListWritten);

/// Replaces a proposal's text.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProposalsEdit {
    /// The repository's name in the list.
    pub repo: String,
    /// The proposal's id, like `next-2`.
    pub proposal: String,
    /// Its new text, as markdown.
    pub text: String,
    /// The priorities' hash as read.
    pub hash: String,
}

action!(ProposalsEdit, "proposals.edit", ListWritten);

/// Expands a proposal into a proposal file, which its line then links.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProposalsExpand {
    /// The repository's name in the list.
    pub repo: String,
    /// The proposal's id, like `next-2`.
    pub proposal: String,
    /// The priorities' hash as read.
    pub hash: String,
}

action!(ProposalsExpand, "proposals.expand", FileWritten);

/// Moves a proposal before the line at `index` of a section, or to its end.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProposalsMove {
    /// The repository's name in the list.
    pub repo: String,
    /// The proposal's id, like `next-2`.
    pub proposal: String,
    /// The section it goes to.
    pub section: String,
    /// Its place there, from 0.
    pub index: u32,
    /// The priorities' hash as read.
    pub hash: String,
}

action!(ProposalsMove, "proposals.move", ListWritten);

/// Edits a proposal's outline: the line, or with `at`, its nested item at `at` in the order of
/// the file.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct ProposalsOutline {
    /// The repository's name in the list.
    pub repo: String,
    /// The proposal's id, like `next-2`.
    pub proposal: String,
    /// The nested item, by its index among the proposal's nested items: none for the line.
    pub at: Option<u32>,
    /// `edit`, `insert-below`, `insert-above`, `append-child`, `remove`, `indent`, `outdent`,
    /// `up`, or `down`.
    pub kind: String,
    /// The line the kinds that write one write.
    pub text: Option<String>,
    /// The priorities' hash as read.
    pub hash: String,
}

action!(ProposalsOutline, "proposals.outline", ListWritten);

/// Drops a proposal, or with `at` its nested item, its own items with it: under the proposal
/// `under`, or with `underAt` under its nested item, or else into `section`, at `index` there.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct ProposalsDrop {
    /// The repository's name in the list.
    pub repo: String,
    /// The proposal's id, like `next-2`.
    pub proposal: String,
    /// The nested item dragged, by its index: none for the proposal.
    pub at: Option<u32>,
    /// Its place where it lands, counted once it left.
    pub index: u32,
    /// The section it lands in.
    pub section: Option<String>,
    /// The proposal it lands under.
    pub under: Option<String>,
    /// That proposal's nested item it lands under.
    pub under_at: Option<u32>,
    /// The priorities' hash as read.
    pub hash: String,
}

action!(ProposalsDrop, "proposals.drop", ListWritten);

/// Removes a proposal and its nested lines.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProposalsRemove {
    /// The repository's name in the list.
    pub repo: String,
    /// The proposal's id, like `next-2`.
    pub proposal: String,
    /// The priorities' hash as read.
    pub hash: String,
}

action!(ProposalsRemove, "proposals.remove", ListWritten);

/// Commits the priorities alone.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct PrioritiesCommit {
    /// The repository's name in the list.
    pub repo: String,
}

action!(PrioritiesCommit, "priorities.commit", ListWritten);

/// Restores the committed priorities.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct PrioritiesDiscard {
    /// The repository's name in the list.
    pub repo: String,
}

action!(PrioritiesDiscard, "priorities.discard", ListWritten);
