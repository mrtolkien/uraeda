//! A workflow file of a feature, with its document, its items, and its review; a proposal file
//! in its editor; and the proposal template's guidance.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::ItemArgs;
use super::decisions::{Candidate, DecisionChange, Run};
use super::document::{Document, LineRange, MockupEmbed, StoryLink};
use super::items::{Items, ReviewItems};
use crate::registry::Record;
use crate::shared::ProposalView;

/// A workflow file, by `<folder>/<name>`, as `2026-10-11-web-ui/spec.md`; or a round of the
/// default branch, by `inbox-triage` or `decisions-check`. Its value is `null` when its feature
/// has no such file, when no feature has that folder, and before an agent writes the round.
pub struct WorkflowFile;

impl Record for WorkflowFile {
    const NAME: &'static str = "WorkflowFile";
    type Args = ItemArgs;
    type Value = Option<FileView>;
}

/// A proposal file, a note file, or a feature's or a change's proposal, in its editor, by its
/// path from the top level.
pub struct ProposalFile;

impl Record for ProposalFile {
    const NAME: &'static str = "ProposalFile";
    type Args = ItemArgs;
    type Value = ProposalFileView;
}

/// The proposal template's guidance, by heading, which the editor shows in empty sections. It
/// never changes while the server runs.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProposalHints {
    /// Each section of the template, in its order.
    pub hints: Vec<ProposalHint>,
}

impl Record for ProposalHints {
    const NAME: &'static str = "ProposalHints";
    type Args = ();
    type Value = Self;
}

/// A workflow file: the version on disk, the version committed at its branch's tip when it
/// differs, and its pending review.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FileView {
    /// `<folder>/<name>`.
    pub id: String,
    pub folder: String,
    pub name: String,
    /// From the repository's top level.
    pub path: String,
    pub kind: String,
    pub status: Option<String>,
    pub current: VersionView,
    /// The short hash of the branch's tip.
    pub tip: Option<String>,
    /// The version at the tip, when it differs from `current`.
    pub committed: Option<VersionView>,
    /// The items of its review file, `spec-review.md` for `spec.md`, when there is one.
    pub review: Option<Items>,
    /// Whether the pending review comments on an older version of the file than its tip's.
    pub review_stale: bool,
    /// Whether images can be attached to it: a feature's or a change's file can, the inbox's
    /// triage, committed alone, cannot.
    pub takes_images: bool,
    /// Whether its round can be answered to continue the implementation: the feature is being
    /// built, see `steps::building`.
    pub resumable: bool,
    /// For `spec.md`, the decisions its branch changed, and those its `## Decisions` lists: the
    /// listed ones first, in the items' order, then the others by name. Empty for other files.
    pub decision_changes: Vec<DecisionChange>,
    /// For the decisions check, each option's candidate decision against the active one, by
    /// question and option. Empty for other files.
    pub candidates: Vec<Candidate>,
    /// For `spec.md` at revision 2 or later, the review that requested the revision, as it stood
    /// when the revision was first committed: the one `## Your review` answers, whatever the review
    /// file holds now. `None` when that review did not request changes.
    pub answered: Option<ReviewItems>,
    /// For `spec.md`, what changed since the version that `answered` reviewed, the spec at its
    /// commit against the one the page shows: the committed one while it waits for review. `None`
    /// when `answered` is.
    pub since_review: Option<SinceReview>,
}

/// A file's document and items, at one version.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct VersionView {
    pub text: String,
    pub document: Document,
    pub items: Items,
    /// The stories its paragraphs embed.
    pub stories: Vec<StoryLink>,
    /// The HTML mockups its paragraphs embed.
    pub mockups: Vec<MockupEmbed>,
}

/// A spec's change since the version reviewed by the review its revision answers.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SinceReview {
    /// The reviewed revision.
    pub revision: u32,
    /// Whether the review's commit resolves and holds the spec; `parts` is empty when not.
    pub found: bool,
    /// The parts changed, added, or removed, in the order of the version shown, a removed part
    /// at the place it held. Kept parts are left out.
    pub parts: Vec<SinceChange>,
}

/// A part of a spec that changed since its review.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SinceChange {
    /// `changed`, `added`, or `removed`.
    pub kind: String,
    /// The text of the nearest heading above the part, on its side: the reviewed one's for a
    /// removed part.
    pub heading: String,
    /// Its lines in the reviewed version, from the file's first line.
    pub before: Option<LineRange>,
    /// Its lines in the version shown, from the file's first line.
    pub after: Option<LineRange>,
    /// Its words, as a decision's part gives them.
    pub runs: Vec<Run>,
}

/// A proposal file, a postponed folder's proposal, a note file, or a feature's or a change's
/// proposal, for its editor.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProposalFileView {
    /// From the repository's top level.
    pub path: String,
    pub title: String,
    pub text: String,
    pub hash: String,
    pub document: Document,
    /// The stories its paragraphs embed.
    pub stories: Vec<StoryLink>,
    /// The HTML mockups its paragraphs embed.
    pub mockups: Vec<MockupEmbed>,
    /// Whether its current text is committed.
    pub committed: bool,
    /// The proposal of `PRIORITIES.md` linking it.
    pub proposal: Option<ProposalView>,
    /// How many changes of `PRIORITIES.md` are not committed, which its commit takes along.
    pub priority_changes: u32,
    /// `proposal-file` for a file of `specs/proposals/`, `note-file` for a file of `specs/notes/`,
    /// or `proposal` for a feature's or a change's.
    pub kind: String,
    /// The feature's or the change's folder, for a proposal.
    pub folder: Option<String>,
    /// The slug Start gives a proposal file's feature unless another is typed.
    pub slug: Option<String>,
    /// The effort its `discovery` field asks for, `high` by default.
    pub discovery: Option<String>,
    /// The discovery efforts it may ask for, from the least research to the most.
    pub discovery_levels: Vec<String>,
    /// Whether it holds more than its title and What: text in any other part of it.
    pub written: bool,
    /// The headings of its `##` sections that hold no text yet.
    pub empty_sections: Vec<String>,
}

/// A section of the proposal template, with the guidance the editor shows while it is empty.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProposalHint {
    pub heading: String,
    pub hint: String,
}
