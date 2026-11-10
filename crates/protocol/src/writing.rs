//! Writing: the human's writes to a repository's workflow files, and what shows and takes them
//! back. The records are a buffer and the write queue; the actions answer rounds, review specs
//! and plans, save and commit texts, and undo.
//!
//! Every record and action here names its repository, `repo`, as the list of repositories does.
//! An action that commits takes `write`, the name the write queue shows it under while its
//! commit lands.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::registry::{Action, Record};

/// Declares the action a type is the input of: its name, and what it answers.
macro_rules! action {
    ($input:ty, $name:literal, $output:ty) => {
        impl Action for $input {
            const NAME: &'static str = $name;
            type Input = Self;
            type Output = $output;
        }
    };
}

/// Which buffer: a Markdown file under `specs/`, by its path from the repository's top level.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BufferArgs {
    pub repo: String,
    pub path: String,
}

/// A buffer: any Markdown file under `specs/`, whole, frontmatter included, as the branch it is
/// written on has it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Buffer {
    pub path: String,
    pub text: String,
    /// The hash of `text`, which `buffer.save` takes back.
    pub hash: String,
    /// The branch the file is written on: its feature's or its change's, else the default one.
    pub branch: String,
}

impl Record for Buffer {
    const NAME: &'static str = "Buffer";
    type Args = BufferArgs;
    type Value = Self;
}

/// Which write queue: a repository's.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct WriteQueueArgs {
    pub repo: String,
}

/// A repository's write queue: its commits still landing, one after another, and the refused
/// ones, until dismissed.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct WriteQueue {
    /// In the order they were made.
    pub writes: Vec<QueuedWrite>,
}

impl Record for WriteQueue {
    const NAME: &'static str = "WriteQueue";
    type Args = WriteQueueArgs;
    type Value = Self;
}

/// A write of the queue: its name, where it is, and the feature and file it concerns.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct QueuedWrite {
    pub id: String,
    /// What it does, as the UI named it, or its commit's subject.
    pub label: String,
    /// The page it opens: empty when the UI named none.
    pub href: String,
    /// The feature or the change it concerns.
    pub folder: Option<String>,
    /// The file it concerns: a feature's file by its name, any other by its path.
    pub file: Option<String>,
    pub state: WriteState,
    /// Once refused, why.
    pub failure: Option<WriteFailure>,
    /// What git and the hooks printed: as it comes, then the refusal's whole message.
    pub output: Option<String>,
}

/// Where a queued write is.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum WriteState {
    /// Behind another write.
    Waiting,
    /// Its commit runs, with the hooks.
    Running,
    /// It did not land, and stays until dismissed.
    Refused,
}

/// Why a refused write did not land.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum WriteFailure {
    /// A hook refused its commit, and its files are back as they were.
    Hook,
    /// Anything else: its files are left written, uncommitted, listed on the Git page.
    Failed,
}

/// What the UI names a committing write with, in the write queue.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct WriteName {
    /// The page it opens.
    pub href: String,
    /// Its running text, as "Approving the spec of Recurring tasks".
    pub label: String,
}

/// What a write changed, as its answer gives it and `undo.apply` takes it back: the commit its
/// checkout was at, and each file on both sides.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct UndoChange {
    pub commit: Option<String>,
    pub files: Vec<UndoFile>,
}

/// A file of a change, by its path from the top level: its bytes before and after, in base64,
/// `null` on the side where it did not exist.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct UndoFile {
    pub path: String,
    pub before: Option<String>,
    pub after: Option<String>,
}

/// What an undoable write answers: the change it made, for the client's undo stack.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Recorded {
    pub change: UndoChange,
}

/// What a save answers: the hash of the text as written, which the next save takes.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Saved {
    pub hash: String,
}

/// Saves one answer of a feature's latest round, from the letters picked and a comment, over
/// the answer last read.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AnswerSave {
    pub repo: String,
    pub folder: String,
    pub question: String,
    pub letters: Vec<String>,
    pub comment: String,
    pub previous: String,
}

action!(AnswerSave, "answer.save", ());

/// Submits a feature's latest round, and commits it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields)]
pub struct AnswersSubmit {
    pub repo: String,
    pub folder: String,
    /// The round answered: refused when the latest is another.
    pub file: Option<String>,
    /// Whether the answers continue the implementation.
    #[serde(default)]
    pub resumes: bool,
    pub write: Option<WriteName>,
}

action!(AnswersSubmit, "answers.submit", ());

/// Saves the notes on a round's settled points, over the notes last read.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct NotesSave {
    pub repo: String,
    pub folder: String,
    pub notes: String,
    pub previous: String,
}

action!(NotesSave, "notes.save", ());

/// Commits again what did not land, its files left written: a submitted round, a review's
/// findings, or a verdict.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields)]
pub struct CommitRetry {
    pub repo: String,
    pub folder: String,
    pub file: String,
    pub write: Option<WriteName>,
}

action!(CommitRetry, "commit.retry", ());

/// Approves a spec or a plan, and commits it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields)]
pub struct ReviewApprove {
    pub repo: String,
    pub folder: String,
    pub file: String,
    pub summary: Option<String>,
    /// The spec's risk tier, when the human changes it.
    pub tier: Option<String>,
    /// Whether the plan is reviewed, when the human changes it.
    pub plan_review: Option<bool>,
    pub write: Option<WriteName>,
}

action!(ReviewApprove, "review.approve", ());

/// Comments on lines of a file as committed, on lines of a decision its spec changes, or on
/// the whole file without lines.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields)]
pub struct ReviewComment {
    pub repo: String,
    pub folder: String,
    pub file: String,
    pub start_line: Option<u32>,
    /// `startLine` alone when left out.
    pub end_line: Option<u32>,
    pub text: String,
    pub decision: Option<ReviewDecision>,
}

action!(ReviewComment, "review.comment", Recorded);

/// The decision a comment points into: its file's stem, and whether the lines are of a part the
/// branch removed.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReviewDecision {
    pub name: String,
    pub removed: bool,
}

/// Replaces the text of a pending comment.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReviewEdit {
    pub repo: String,
    pub folder: String,
    pub file: String,
    pub number: u32,
    pub text: String,
}

action!(ReviewEdit, "review.edit", Recorded);

/// Removes a pending comment.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRemove {
    pub repo: String,
    pub folder: String,
    pub file: String,
    pub number: u32,
}

action!(ReviewRemove, "review.remove", Recorded);

/// Requests changes on a spec or a plan, and commits it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields)]
pub struct ReviewRequestChanges {
    pub repo: String,
    pub folder: String,
    pub file: String,
    pub summary: Option<String>,
    pub write: Option<WriteName>,
}

action!(ReviewRequestChanges, "review.requestChanges", ());

/// Deletes the pending review of a file.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReviewStartOver {
    pub repo: String,
    pub folder: String,
    pub file: String,
}

action!(ReviewStartOver, "review.startOver", Recorded);

/// Adds a comment on the settled point starting with `subject`, at the end of the notes.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettledComment {
    pub repo: String,
    pub folder: String,
    pub subject: String,
    pub text: String,
}

action!(SettledComment, "settled.comment", ());

/// Writes comment `number` on the settled point `subject` over its text last read.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettledEdit {
    pub repo: String,
    pub folder: String,
    pub number: u32,
    pub subject: String,
    pub text: String,
    pub previous: String,
}

action!(SettledEdit, "settled.edit", ());

/// Removes comment `number` on the settled point `subject`, over its text last read.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettledRemove {
    pub repo: String,
    pub folder: String,
    pub number: u32,
    pub subject: String,
    pub previous: String,
}

action!(SettledRemove, "settled.remove", Recorded);

/// Saves one answer of a round of the default branch, `inbox-triage` or `decisions-check`, over
/// the answer last read, in the round read with the hash `base`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct DefaultRoundAnswer {
    pub repo: String,
    pub id: String,
    pub question: String,
    pub letters: Vec<String>,
    pub comment: String,
    pub previous: String,
    /// The hash of the round as the page read or wrote it last.
    pub base: String,
}

action!(DefaultRoundAnswer, "defaultRound.answer", Saved);

/// Saves the notes of a round of the default branch, as an answer is.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct DefaultRoundNotes {
    pub repo: String,
    pub id: String,
    pub notes: String,
    pub previous: String,
    pub base: String,
}

action!(DefaultRoundNotes, "defaultRound.notes", Saved);

/// Submits a round of the default branch, read with the hash `previous`, and commits it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields)]
pub struct DefaultRoundSubmit {
    pub repo: String,
    pub id: String,
    pub previous: String,
    pub write: Option<WriteName>,
}

action!(DefaultRoundSubmit, "defaultRound.submit", ());

/// Commits an answered round of the default branch again.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields)]
pub struct DefaultRoundRetry {
    pub repo: String,
    pub id: String,
    pub write: Option<WriteName>,
}

action!(DefaultRoundRetry, "defaultRound.retry", ());

/// Dismisses the inbox's triage, read with the hash `previous`: deletes it, and commits the
/// deletion alone.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields)]
pub struct DefaultRoundDismiss {
    pub repo: String,
    pub previous: String,
    pub write: Option<WriteName>,
}

action!(DefaultRoundDismiss, "defaultRound.dismiss", ());

/// Saves a proposal file, a note file, or a feature's proposal as typed, over the text read
/// with `hash`, without committing.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TextSave {
    pub repo: String,
    pub path: String,
    pub text: String,
    pub hash: String,
}

action!(TextSave, "text.save", Saved);

/// Sets a proposal's discovery level, over the text read with `hash`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TextDiscovery {
    pub repo: String,
    pub path: String,
    pub level: String,
    pub hash: String,
}

action!(TextDiscovery, "text.discovery", Saved);

/// Commits a proposal file or a note file, with the lists that changed.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields)]
pub struct TextCommit {
    pub repo: String,
    pub path: String,
    pub write: Option<WriteName>,
}

action!(TextCommit, "text.commit", ());

/// Saves a buffer as typed on its branch, over the text read with `hash`, without committing.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BufferSave {
    pub repo: String,
    pub path: String,
    pub text: String,
    pub hash: String,
}

action!(BufferSave, "buffer.save", Saved);

/// Writes a change back, for an undo, or forward, for a redo, once every file holds the other
/// side: `subject` names the action in the refusal of a file that changed since.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct UndoApply {
    pub repo: String,
    pub change: UndoChange,
    pub direction: UndoDirection,
    pub subject: String,
}

action!(UndoApply, "undo.apply", UndoApplied);

/// Which way a change is written.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum UndoDirection {
    Undo,
    Redo,
}

/// What `undo.apply` answers: the commit the files' checkout is at now.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct UndoApplied {
    pub commit: Option<String>,
}

/// Whether a commit since a change holds any of its files otherwise: its undo then asks first.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct UndoCommitted {
    pub repo: String,
    pub change: UndoChange,
}

action!(UndoCommitted, "undo.committed", bool);

/// Takes a refused write out of the write queue.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct WritesDismiss {
    pub repo: String,
    pub id: String,
}

action!(WritesDismiss, "writes.dismiss", ());
