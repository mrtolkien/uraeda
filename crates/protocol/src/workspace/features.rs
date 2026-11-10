//! A repository's workspace: its features and changes in flight, each with its step and its
//! status, its priorities, and what it lacks to be set up. And the slug of a typed start.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::registry::Record;
use crate::shared::{FeatureStatus, FeatureView, ProposalView, RepositoryArgs};

/// A repository's workspace, as the sidebar and home read it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    /// The main checkout, absolute.
    pub root: String,
    /// The default branch, like `main`.
    pub default_branch: Option<String>,
    /// The branch the main checkout has checked out.
    pub current_branch: Option<String>,
    /// Its features and changes.
    pub features: Vec<WorkspaceFeature>,
    /// The proposals of `PRIORITIES.md`, in the file's order.
    pub priorities: Vec<ProposalView>,
    /// The hash of `PRIORITIES.md` as read, for expanding a proposal by its id.
    pub priorities_hash: String,
    /// The proposal files and postponed folders, from the top level.
    pub proposals: Vec<String>,
    /// The repository's path when it has no `specs/` folder: nothing else is read.
    pub no_specs: Option<String>,
    /// What the project lacks to be set up, in the setup's order: every item while a required one
    /// is not written, and none once it is set up.
    pub setup: Vec<SetupItem>,
    /// Whether the main checkout has an active preview decision.
    pub preview: bool,
}

impl Record for Workspace {
    const NAME: &'static str = "Workspace";
    type Args = RepositoryArgs;
    type Value = Self;
}

/// A feature or a change of a workspace: the core's view of it, with its name in the sidebar and
/// its status.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFeature {
    /// Its folder, which names it in a change.
    pub id: String,
    /// The name the human gave it in the sidebar. No workflow rule reads it.
    pub label: Option<String>,
    /// Whether it needs the human, works, or waits.
    pub status: FeatureStatus,
    /// What the core reads of it.
    #[serde(flatten)]
    pub feature: FeatureView,
}

/// An item of the setup.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SetupItem {
    /// `specs`, `constitution`, `code-quality`, `testing`, or `preview`.
    pub key: String,
    /// What the human reads, like `Code-quality decision`.
    pub name: String,
    /// `missing`, `template` for a constitution still holding a placeholder, or `written`.
    pub state: String,
    /// Whether the project is set up only once it is written: the preview decision is not.
    pub required: bool,
}

/// The text typed for a start.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SlugProposalArgs {
    /// The change, as typed.
    pub text: String,
}

/// The slug the core proposes for a typed start, and the research efforts a feature may ask
/// for: the start dialog shows them. It is read once, and never changes.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SlugProposal {
    /// The slug proposed.
    pub slug: String,
    /// The research efforts, the lightest first.
    pub discovery_levels: Vec<String>,
}

impl Record for SlugProposal {
    const NAME: &'static str = "SlugProposal";
    type Args = SlugProposalArgs;
    type Value = Self;
}
