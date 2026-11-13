//! The inbox, `INBOX.md` read for editing, and the actions that write its notes and move them
//! into the priorities and the proposal files. Each is written on the default branch, over the
//! hash it was read at.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::document::Span;
use super::priorities::NestedItem;
use super::undo::{FileWritten, ListWritten, NoteMoved};
use crate::registry::Record;
use crate::shared::RepositoryArgs;

impl Record for Inbox {
    const NAME: &'static str = "Inbox";
    type Args = RepositoryArgs;
    type Value = Self;
}

/// `INBOX.md` read for editing.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Inbox {
    /// The SHA-256 of the text, to refuse edits over a change made elsewhere.
    pub hash: String,
    /// The categories that hold notes, the notes without one first, then in file order. Notes
    /// under two headings of the same name are in one category.
    pub categories: Vec<InboxCategory>,
    /// Every category's name, once, in file order, empty ones included: what the add form offers.
    pub names: Vec<String>,
    /// How many notes it holds.
    pub count: u32,
    /// How many changes wait for a commit.
    pub changes: u32,
    /// The status of `INBOX-TRIAGE.md`, when there is one.
    pub triage: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InboxCategory {
    /// `None` for the notes before the first category.
    pub name: Option<String>,
    pub notes: Vec<InboxNote>,
}

/// A note of `INBOX.md`, for editing.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InboxNote {
    /// `note-3`: its place in the file, from 1.
    pub id: String,
    /// Its address: the slug of its text, made unique.
    pub key: String,
    /// The markdown of its text, after its marker and marks, on one line.
    pub text: String,
    pub spans: Vec<Span>,
    pub agent: bool,
    /// The slug of the feature or change it is about.
    pub about: Option<String>,
    /// The path of its note file, the file of `specs/notes/` its whole text links to, from the
    /// repository's top level.
    pub file: Option<String>,
    /// The markdown of that link's text, unescaped: a note added as a file as it was typed, which
    /// an add whose answer was lost finds it by.
    pub file_title: Option<String>,
    /// The images its note file links, in order, from the repository's top level: filled in from
    /// the file, where it is read. Empty for a note with no file.
    pub images: Vec<String>,
    pub start_line: u32,
    pub end_line: u32,
    /// Its lines as written, sub-items included.
    pub lines: Vec<String>,
    /// Its nested lines, as written.
    pub nested: Vec<String>,
    /// The text of each nested item, without its marker.
    pub nested_spans: Vec<Vec<Span>>,
    /// Its nested items at any depth, in the order of the file: what its outline shows, and what an
    /// edit of one names by its index.
    pub children: Vec<NestedItem>,
}

/// Adds a note, at the end of its category.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct InboxAdd {
    /// The repository's name in the list.
    pub repo: String,
    /// The note, as markdown.
    pub text: String,
    /// Its category: none for the notes without one.
    pub category: Option<String>,
    /// The folder of the feature or the change it is about: the note is marked with its slug.
    pub about: Option<String>,
    /// The inbox's hash as read.
    pub hash: String,
}

action!(InboxAdd, "inbox.add", ListWritten);

/// Adds a category at the end of the inbox.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InboxAddCategory {
    /// The repository's name in the list.
    pub repo: String,
    /// The category's name.
    pub name: String,
    /// The inbox's hash as read.
    pub hash: String,
}

action!(InboxAddCategory, "inbox.addCategory", ListWritten);

/// Moves a note to the end of a category.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct InboxMoveCategory {
    /// The repository's name in the list.
    pub repo: String,
    /// The note's id, like `note-3`.
    pub note: String,
    /// The category: none for the notes without one.
    pub category: Option<String>,
    /// The inbox's hash as read.
    pub hash: String,
}

action!(InboxMoveCategory, "inbox.category", ListWritten);

/// Replaces a note's text. It is not undone: the field's own undo is.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InboxEdit {
    /// The repository's name in the list.
    pub repo: String,
    /// The note's id, like `note-3`.
    pub note: String,
    /// Its new text, as markdown.
    pub text: String,
    /// The inbox's hash as read.
    pub hash: String,
}

action!(InboxEdit, "inbox.edit", ListWritten);

/// Edits a note's outline: the note, or with `at`, its nested item at `at` in the order of the
/// file.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct InboxOutline {
    /// The repository's name in the list.
    pub repo: String,
    /// The note's id, like `note-3`.
    pub note: String,
    /// The nested item, by its index among the note's nested items: none for the note.
    pub at: Option<u32>,
    /// `edit`, `insert-below`, `insert-above`, `append-child`, `remove`, `indent`, `outdent`,
    /// `up`, or `down`.
    pub kind: String,
    /// The line the kinds that write one write.
    pub text: Option<String>,
    /// The inbox's hash as read.
    pub hash: String,
}

action!(InboxOutline, "inbox.outline", ListWritten);

/// Moves a note before the note at `index` of a category, or to its end.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct InboxPlace {
    /// The repository's name in the list.
    pub repo: String,
    /// The note's id, like `note-3`.
    pub note: String,
    /// The category: none for the notes without one.
    pub category: Option<String>,
    /// Its place there, from 0.
    pub index: u32,
    /// The inbox's hash as read.
    pub hash: String,
}

action!(InboxPlace, "inbox.place", ListWritten);

/// Drops a note, or with `at` its nested item, its own items with it: under the note `under`, or
/// with `underAt` under its nested item, or else into `category`, at `index` there.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct InboxDrop {
    /// The repository's name in the list.
    pub repo: String,
    /// The note's id, like `note-3`.
    pub note: String,
    /// The nested item dragged, by its index: none for the note.
    pub at: Option<u32>,
    /// Its place where it lands, counted once it left.
    pub index: u32,
    /// The category it lands in: none for the notes without one.
    pub category: Option<String>,
    /// The note it lands under.
    pub under: Option<String>,
    /// That note's nested item it lands under.
    pub under_at: Option<u32>,
    /// The inbox's hash as read.
    pub hash: String,
}

action!(InboxDrop, "inbox.drop", ListWritten);

/// Removes a note, its nested lines and its note file with it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InboxRemove {
    /// The repository's name in the list.
    pub repo: String,
    /// The note's id, like `note-3`.
    pub note: String,
    /// The inbox's hash as read.
    pub hash: String,
}

action!(InboxRemove, "inbox.remove", ListWritten);

/// Deletes a category.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InboxRemoveCategory {
    /// The repository's name in the list.
    pub repo: String,
    /// The category's name.
    pub name: String,
    /// Whether its notes stay, without a category, or go with it.
    pub keep_notes: bool,
    /// The inbox's hash as read.
    pub hash: String,
}

action!(InboxRemoveCategory, "inbox.removeCategory", ListWritten);

/// Takes an image out of a note file or a proposal file: the lines linking it go, and its file
/// stays until the next commit.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InboxRemoveImage {
    /// The repository's name in the list.
    pub repo: String,
    /// The note file or the proposal file, from the top level.
    pub file: String,
    /// The image, from the top level.
    pub image: String,
    /// The file's hash as read.
    pub hash: String,
}

action!(InboxRemoveImage, "inbox.removeImage", ListWritten);

/// Renames a category, every heading of its name.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InboxRenameCategory {
    /// The repository's name in the list.
    pub repo: String,
    /// Its name now.
    pub from: String,
    /// Its new name.
    pub to: String,
    /// The inbox's hash as read.
    pub hash: String,
}

action!(InboxRenameCategory, "inbox.renameCategory", ListWritten);

/// Moves a note to the end of a section of the priorities, as a line.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InboxToProposal {
    /// The repository's name in the list.
    pub repo: String,
    /// The note's id, like `note-3`.
    pub note: String,
    /// The section's id: `now`, `next`, `later`, or `blocked`.
    pub section: String,
    /// The inbox's hash as read.
    pub hash: String,
    /// The priorities' hash as read.
    pub priorities_hash: String,
}

action!(InboxToProposal, "inbox.toProposal", NoteMoved);

/// Moves a note under a proposal of the priorities, as a nested line.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InboxUnderProposal {
    /// The repository's name in the list.
    pub repo: String,
    /// The note's id, like `note-3`.
    pub note: String,
    /// The proposal's id, like `now-2`.
    pub proposal: String,
    /// The inbox's hash as read.
    pub hash: String,
    /// The priorities' hash as read.
    pub priorities_hash: String,
}

action!(InboxUnderProposal, "inbox.underProposal", NoteMoved);

/// Moves a note to the end of a section of the priorities, as a proposal file its line links.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InboxToProposalFile {
    /// The repository's name in the list.
    pub repo: String,
    /// The note's id, like `note-3`.
    pub note: String,
    /// The section's id: `now`, `next`, `later`, or `blocked`.
    pub section: String,
    /// The inbox's hash as read.
    pub hash: String,
    /// The priorities' hash as read.
    pub priorities_hash: String,
}

action!(InboxToProposalFile, "inbox.toProposalFile", FileWritten);

/// Moves a note into a proposal file: a single file made a folder for a note file's images
/// moves, and the answer says where it is.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InboxIntoProposal {
    /// The repository's name in the list.
    pub repo: String,
    /// The note's id, like `note-3`.
    pub note: String,
    /// The proposal file, from the top level.
    pub file: String,
    /// The inbox's hash as read.
    pub hash: String,
}

action!(InboxIntoProposal, "inbox.intoProposal", FileWritten);

/// Moves a note with a note file into a line of the priorities without a file: the line gets its
/// proposal file first.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InboxIntoProposalLine {
    /// The repository's name in the list.
    pub repo: String,
    /// The note's id, like `note-3`.
    pub note: String,
    /// The proposal's id, like `now-2`.
    pub proposal: String,
    /// The inbox's hash as read.
    pub hash: String,
    /// The priorities' hash as read.
    pub priorities_hash: String,
}

action!(InboxIntoProposalLine, "inbox.intoProposalLine", FileWritten);
