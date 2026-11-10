//! What a feature's branch changed outside its own folder: its files, for its page, and every
//! feature's counts, for the sidebar's cards.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::{ItemArgs, RepositoryArgs};
use crate::registry::Record;

/// A feature's branch changes, by its folder.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BranchChanges {
    /// The changes: none when the feature has no branch, is merged, or is no feature, when the
    /// default branch is unknown, and when they could not be read.
    pub changes: Option<BranchChangesView>,
    /// Whether they could not be read: git missing, or the diff failing.
    pub failed: bool,
}

impl Record for BranchChanges {
    const NAME: &'static str = "BranchChanges";
    type Args = ItemArgs;
    type Value = Self;
}

/// Every feature's branch changes, without their files, read at once for the sidebar's cards.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AllBranchChanges {
    /// Each feature that has changes.
    pub features: Vec<FeatureChanges>,
    /// Whether they could not be read.
    pub failed: bool,
}

impl Record for AllBranchChanges {
    const NAME: &'static str = "AllBranchChanges";
    type Args = RepositoryArgs;
    type Value = Self;
}

/// A feature's count of changed files and of lines, as a card shows them.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FeatureChanges {
    /// The feature's folder, which names it in a change.
    pub id: String,
    /// Every changed file outside the feature's folder.
    pub count: u32,
    /// The lines added.
    pub added: u32,
    /// The lines removed.
    pub removed: u32,
}

/// The changes of a feature's branch, outside the feature's own folder.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BranchChangesView {
    /// The first 50 files, sorted by path, outside `specs/<folder>/`.
    pub files: Vec<ChangedFile>,
    /// Every changed file outside the feature's folder, listed or not.
    pub count: u32,
    pub added: u32,
    pub removed: u32,
}

/// A file changed on a feature's branch, from the default branch's merge base to its tip.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFile {
    /// From the repository's top level; the new path of a renamed file.
    pub path: String,
    /// Lines added and removed; `None` for a binary file.
    pub added: Option<u32>,
    pub removed: Option<u32>,
}
