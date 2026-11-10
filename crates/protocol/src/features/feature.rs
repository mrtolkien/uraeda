//! A feature or a change: what the core reads of it, its status, and its own run options. And
//! the actions that move it through its life.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::ItemArgs;
use crate::registry::Record;
use crate::shared::{FeatureStatus, FeatureView, RunOptions, WriteName};

/// A feature or a change, by its folder. Its value is `null` when no feature has that folder.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Feature {
    /// The name the human gave it in the sidebar. No workflow rule reads it.
    pub label: Option<String>,
    /// Whether it needs the human, works, or waits.
    pub status: FeatureStatus,
    /// Whether its worktree, or else the main checkout, has an active preview decision.
    pub preview: bool,
    /// Its run options.
    pub run_options: RunOptionsPair,
    /// Its latest session, the one its runs go to: none before its first message.
    pub session: Option<String>,
    /// Its sessions, the latest started first, without the archived ones.
    pub sessions: Vec<String>,
    /// The runtime of its latest session, which its runs go to: none before its first message.
    pub runtime: Option<String>,
    /// What a session of it made without a pick runs on: none at a step no agent runs.
    pub new_pick: Option<NewPick>,
    /// What the core reads of it.
    #[serde(flatten)]
    pub feature: FeatureView,
}

impl Record for Feature {
    const NAME: &'static str = "Feature";
    type Args = ItemArgs;
    type Value = Option<Self>;
}

/// A feature's run options: its own, and what its next run starts on.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RunOptionsPair {
    /// Only what the feature changed, which `feature.setRunOptions` keeps.
    pub own: RunOptions,
    /// The core's merge of them over the settings' run options.
    pub merged: RunOptions,
}

/// What a new session of a feature runs on, when the human picks nothing.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct NewPick {
    /// The agent's runtime.
    pub runtime: String,
    /// The model: none for the agent's default.
    pub model: Option<String>,
    /// The effort: none for the agent's default.
    pub effort: Option<String>,
}

/// A feature or a change dropped.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Dropped {
    /// Its branch, which stays.
    pub branch: String,
    /// Why its worktree stays, when it does.
    pub worktree_left: Option<String>,
    /// Whether its proposal's removal from the priorities was committed: when not, it stays
    /// written for the commit bar.
    pub committed: bool,
}

/// A change made a feature, in place.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct PromotedView {
    pub folder: String,
    /// The feature's branch, the folder's name.
    pub branch: String,
    /// The decisions the change applied, proposed again for the feature's spec.
    pub decisions: Vec<String>,
}

/// Keeps a feature's own run options, only what differs from the settings': they apply from its
/// next run.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FeatureSetRunOptions {
    /// The repository's name in the list.
    pub repo: String,
    /// The feature's or the change's folder.
    pub folder: String,
    /// Its options: none set removes them.
    pub options: RunOptions,
}

action!(FeatureSetRunOptions, "feature.setRunOptions", ());

/// Repairs the links of a done feature's record whose file moved or was deleted since, in the
/// default branch's checkout, without committing.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FeatureFixLinks {
    /// The repository's name in the list.
    pub repo: String,
    /// The feature's or the change's folder.
    pub folder: String,
}

action!(FeatureFixLinks, "feature.fixLinks", ());

/// Drops a started feature or change: its proposal leaves the priorities, its worktree is removed
/// unless it has uncommitted changes, and its branch stays.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct FeatureDrop {
    /// The repository's name in the list.
    pub repo: String,
    /// The feature's or the change's folder.
    pub folder: String,
    /// The name the write queue shows its commit under while it lands.
    pub write: Option<WriteName>,
}

action!(FeatureDrop, "feature.drop", Dropped);

/// Makes a change a feature, in place: its branch loses its `change/` prefix, its folder moves to
/// `specs/`, and **Now** links it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct FeaturePromote {
    /// The repository's name in the list.
    pub repo: String,
    /// The feature's or the change's folder.
    pub folder: String,
    /// The name the write queue shows the move under while it lands.
    pub write: Option<WriteName>,
}

action!(FeaturePromote, "feature.promote", PromotedView);

/// Sets the name a feature or a change shows in the sidebar. No workflow rule reads it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct ItemSettings {
    /// The repository's name in the list.
    pub repo: String,
    /// The feature's or the change's folder.
    pub folder: String,
    /// The name: none, or an empty one, removes it.
    pub label: Option<String>,
}

action!(ItemSettings, "item.settings", ());
