//! Reading the features of branches: the current branch's from the working tree, and every other
//! feature branch's from the working tree that has it, else from its tip. A branch is an item only
//! with its folder or its record in its latest commit.

use std::collections::BTreeMap;

use super::{
    Feature, Kind, ReadFrom, Reader, Reading, Source, branch_folder, folder_branch, folder_path,
    read_feature, record_path,
};
use crate::git::{Branch, Git, ObjectId};

impl Reading<'_> {
    /// Whether a commit holds a feature's or a change's folder, or its record: a branch is an item
    /// only then, unlike a fix made outside the workflow, or a proposal never committed.
    fn is_item(&self, commit: ObjectId, kind: Kind, folder: &str) -> bool {
        let from = ReadFrom::Commit(commit);
        !self
            .reader
            .files(from, &folder_path(kind, folder))
            .is_empty()
            || self.reader.read(from, &record_path(folder)).is_some()
    }

    /// The current branch's feature, from the working tree, when its latest commit makes it one.
    /// Other folders on disk are no items: only branches are.
    pub(super) fn working_tree_features(
        &self,
        current_branch: Option<&str>,
    ) -> BTreeMap<(Kind, String), Feature> {
        let mut features = BTreeMap::new();
        let Some((kind, folder)) = current_branch.and_then(branch_folder) else {
            return features;
        };
        let key = (kind, folder.to_string());
        let Some(head) = self.git.head() else {
            return features;
        };
        if self.merged.keys.contains(&key) || !self.is_item(head, kind, folder) {
            return features;
        }
        let branch = Some(folder_branch(kind, folder));
        let mut feature = read_feature(
            &self.reader,
            kind,
            folder,
            branch,
            ReadFrom::Disk,
            Some(head),
        );
        feature.worktree = Some(self.shown(self.root));
        features.insert(key, feature);
        features
    }

    /// Adds the feature of every other feature branch, from its tip.
    pub(super) fn add_branch_features(
        &self,
        branches: &[Branch],
        features: &mut BTreeMap<(Kind, String), Feature>,
    ) {
        for branch in branches {
            let Some((kind, folder)) = branch_folder(&branch.name) else {
                continue;
            };
            let key = (kind, folder.to_string());
            if self.merged.keys.contains(&key) || features.contains_key(&key) {
                continue;
            }
            if let Some(feature) = self.branch_feature(branch, kind, folder) {
                features.insert(key, feature);
            }
        }
    }

    /// A branch's feature: from the working tree that has it, else from its tip, local first; none
    /// for a branch whose tip has neither its folder nor its record.
    fn branch_feature(&self, branch: &Branch, kind: Kind, folder: &str) -> Option<Feature> {
        let tip = branch.local.or(branch.remote)?;
        if !self.is_item(tip, kind, folder) {
            return None;
        }
        let opened = self
            .checked_out
            .get(&branch.name)
            .and_then(|path| Git::open(path).ok().map(|git| (path, git)));
        let mut feature = match &opened {
            Some((path, worktree_git)) => {
                let worktree_reader = Reader { git: worktree_git };
                let mut feature = read_feature(
                    &worktree_reader,
                    kind,
                    folder,
                    Some(branch.name.clone()),
                    ReadFrom::Disk,
                    worktree_git.head(),
                );
                feature.worktree = Some(self.shown(path));
                feature
            }
            None => {
                let mut feature = read_feature(
                    &self.reader,
                    kind,
                    folder,
                    Some(branch.name.clone()),
                    ReadFrom::Commit(tip),
                    Some(tip),
                );
                feature.source = if branch.local.is_some() {
                    Source::Local
                } else {
                    Source::Remote
                };
                feature
            }
        };
        feature.behind = match (branch.local, branch.remote) {
            (Some(local), Some(remote)) => Some(self.git.behind(local, remote)),
            _ => None,
        };
        Some(feature)
    }
}
