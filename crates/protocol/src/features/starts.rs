//! Starting a feature or a change: from a proposal file, a typed text, or a note of the inbox.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::shared::{ChatImage, RunOptions, WriteName};

/// What a start makes.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum StartKind {
    /// A feature, through the whole workflow.
    Feature,
    /// A change, built at once.
    Change,
}

/// A feature whose start is planned and queued: what its session page opens with. The start
/// lands behind this answer, as a write of the queue, where its steps and a refusal show.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct StartPlan {
    /// Its folder.
    pub folder: String,
    /// Its name, its line in the priorities.
    pub title: String,
    /// The workflow's message of its first step, which its session's composer holds.
    pub message: String,
}

/// A change started.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChangeStarted {
    /// Its folder.
    pub folder: String,
    /// The session its first run was sent to: none when no run was sent, and its page offers
    /// the message unsent.
    pub session: Option<String>,
}

/// Starts a proposal file as a feature, or as a change, in its own worktree. It answers once the
/// start is planned: the write queue shows it land.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct FeatureStart {
    /// The repository's name in the list.
    pub repo: String,
    /// The proposal file, from the top level.
    pub proposal: String,
    /// Its slug: the one the core proposes when none is given.
    pub slug: Option<String>,
    /// A feature when none is given.
    pub kind: Option<StartKind>,
    /// The name the write queue shows the start under while it lands.
    pub write: Option<WriteName>,
}

action!(FeatureStart, "feature.start", StartPlan);

/// Starts a feature typed as a text: its first written line is its title.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct FeatureStartText {
    /// The repository's name in the list.
    pub repo: String,
    /// The text, as typed.
    pub text: String,
    /// Its slug.
    pub slug: String,
    /// Its images, as their upload answered them.
    pub images: Option<Vec<ChatImage>>,
    /// The text of the line of **Now** it was filled from, which its link replaces.
    pub line: Option<String>,
    /// The research effort its proposal asks for.
    pub discovery: Option<String>,
    /// Its own run options, only what differs from the settings'.
    pub options: Option<RunOptions>,
    /// The name the write queue shows the start under while it lands.
    pub write: Option<WriteName>,
}

action!(FeatureStartText, "feature.startText", StartPlan);

/// Starts a change typed as a text, then sends its first run.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct ChangeStart {
    /// The repository's name in the list.
    pub repo: String,
    /// The text, as typed.
    pub text: String,
    /// Its slug: the one the core proposes when none is given.
    pub slug: Option<String>,
    /// Its images, as their upload answered them.
    pub images: Option<Vec<ChatImage>>,
    /// The text of the line of **Now** it was filled from, which its link replaces.
    pub line: Option<String>,
    /// Its own run options, only what differs from the settings'.
    pub options: Option<RunOptions>,
}

action!(ChangeStart, "change.start", ChangeStarted);

/// Starts a change from a note of the inbox, with its note file's text and images, then takes
/// the note out of the inbox.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct ChangeFromNote {
    /// The repository's name in the list.
    pub repo: String,
    /// The note's id, like `note-3`.
    pub note: String,
    /// The inbox's hash as read.
    pub hash: String,
    /// Its slug: the one the core proposes when none is given.
    pub slug: Option<String>,
}

action!(ChangeFromNote, "change.fromNote", ChangeStarted);

/// Starts a proposal file as a change, then sends its first run.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct ChangeStartProposal {
    /// The repository's name in the list.
    pub repo: String,
    /// The proposal file, from the top level.
    pub proposal: String,
    /// Its slug: the one the core proposes when none is given.
    pub slug: Option<String>,
}

action!(ChangeStartProposal, "change.startProposal", ChangeStarted);
