//! The features and the changes of a repository, and the lists they start from: a feature and its
//! workflow files, the proposal files, the priorities, the inbox, the ledger of decisions, a
//! feature's history and its branch's changes, and the workflow's messages. And the actions that
//! write the lists, start a feature or a change, and move one through its life.
//!
//! - A record of a repository takes `{ repo }`, the repository's name in the list. A record of
//!   one thing of a repository takes `{ repo, id }`: a feature's folder, a file's
//!   `<folder>/<name>`, a proposal file's path.
//! - A type that is the core's view keeps the core's name: `FileView`, `Document`, `Inbox`.
//! - An action answers what no record shows: the change to undo, a hash to write over, a path
//!   to open. The records show the rest.

/// An action whose input is its own type: its name, and what it answers.
macro_rules! action {
    ($input:ident, $name:literal, $output:ty) => {
        impl crate::registry::Action for $input {
            const NAME: &'static str = $name;
            type Input = Self;
            type Output = $output;
        }
    };
}

mod branch;
mod decisions;
mod document;
mod duplicates;
mod feature;
mod files;
mod history;
mod inbox;
mod items;
mod messages;
mod priorities;
mod spec_items;
mod starts;
mod undo;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub use branch::{AllBranchChanges, BranchChanges, BranchChangesView, ChangedFile, FeatureChanges};
pub use decisions::{
    BranchDecision, Candidate, Constitution, Decision, DecisionChange, FieldChange, Ledger,
    PartChange, Principle, Run, SectionChange,
};
pub use document::{
    Block, BlockKind, CalloutKind, Document, ItemMarker, LineRange, MockupEmbed, Span, SpanImage,
    SpanLink, StoryLink, StoryTarget,
};
pub use feature::{
    Dropped, Feature, FeatureDrop, FeatureFixLinks, FeaturePromote, FeatureSetRunOptions,
    ItemSettings, NewPick, PromotedView, RunOptionsPair,
};
pub use files::{
    FileView, ProposalFile, ProposalFileView, ProposalHint, ProposalHints, SinceChange,
    SinceReview, VersionView, WorkflowFile,
};
pub use history::{History, HistoryView, LinesView, StageView};
pub use inbox::{
    Inbox, InboxAdd, InboxAddCategory, InboxCategory, InboxDrop, InboxEdit, InboxIntoProposal,
    InboxIntoProposalLine, InboxMoveCategory, InboxNote, InboxOutline, InboxPlace, InboxRemove,
    InboxRemoveCategory, InboxRemoveImage, InboxRenameCategory, InboxToProposal,
    InboxToProposalFile, InboxUnderProposal,
};
pub use items::{
    Choice, CommentItem, ContextPart, Items, PlanItems, PlanLead, QuestionItem, ReviewItems,
    RoundItems, RoundVerdict, Ruling, SettledComment, SettledGroup, SettledKind, SettledPoint,
    StepItem, TaskItem, VerdictKind,
};
pub use messages::{RecommendedMessage, Trigger, WorkflowMessage, WorkflowMessageArgs};
pub use priorities::{
    LinkedFile, MergedFeature, NestedItem, Priorities, PrioritiesCommit, PrioritiesDiscard,
    ProposalItem, ProposalsAdd, ProposalsDrop, ProposalsEdit, ProposalsExpand, ProposalsMove,
    ProposalsOutline, ProposalsRemove, RunningFeature, SectionItems,
};
pub use spec_items::{
    Criterion, DataModelItems, DataSection, DataTable, EdgeCase, ListedDecision, MockupLink,
    ReviewAnswer, RowChange, RowChangeKind, Scenario, ScenarioStep, SpecItems, SpecPart,
    SpecPrinciple, Story, TierChoice,
};
pub use starts::{
    ChangeFromNote, ChangeStart, ChangeStartProposal, ChangeStarted, ChatImage, FeatureStart,
    FeatureStartText, StartKind, StartPlan,
};
pub use undo::{FileWritten, ListWritten, NoteMoved, RecordedChange, RecordedFile};

/// The types the workspace's domain declares too, kept out of the crate's own names until the
/// two are one.
// JOIN(wave 6): gone with `features/duplicates.rs`.
pub mod feature_duplicates {
    pub use super::duplicates::*;
}

/// Which repository.
// JOIN(wave 6): `WorkspaceArgs` of the workspace's domain (task 7) is the same.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryArgs {
    /// The repository's name in the list.
    pub repo: String,
}

/// Which thing of a repository: a feature, a workflow file, a proposal file.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ItemArgs {
    /// The repository's name in the list.
    pub repo: String,
    /// What names the thing there: a feature's folder, a file's `<folder>/<name>`, a proposal
    /// file's path from the top level.
    pub id: String,
}
