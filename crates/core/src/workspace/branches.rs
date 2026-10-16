//! Reading the features of branches: the current branch's from the working tree, and every other
//! feature branch's from the working tree that has it, else from its tip.

use std::collections::BTreeMap;

use super::{
    Feature, Kind, ReadFrom, Reader, Reading, Source, branch_folder, folder_branch, folder_path,
    read_feature, record_path,
};
use crate::git::{Branch, Git};

impl Reading<'_> {
    /// The working tree's features: the current branch's, and folders not yet committed.
    pub(super) fn working_tree_features(
        &self,
        current_branch: Option<&str>,
    ) -> BTreeMap<(Kind, String), Feature> {
        let current_folder = current_branch.and_then(branch_folder);
        let mut on_disk = self.reader.folders(ReadFrom::Disk);
        if let Some((kind, folder)) = current_folder {
            on_disk.insert((kind, folder.to_string()));
        }
        let head = self.git.head();
        let mut features = BTreeMap::new();
        for (kind, folder) in on_disk {
            if self.merged.keys.contains(&(kind, folder.clone())) {
                continue;
            }
            let branch = current_folder
                .filter(|(k, f)| *k == kind && *f == folder)
                .map(|_| folder_branch(kind, &folder));
            let on_branch = branch.is_some();
            let mut feature =
                read_feature(&self.reader, kind, &folder, branch, ReadFrom::Disk, head);
            if on_branch {
                feature.worktree = Some(self.shown(self.root));
            }
            features.insert((kind, folder), feature);
        }
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
                // Neither its folder nor its record, like a fix made outside the workflow:
                // not a feature.
                let from = ReadFrom::Commit(tip);
                if self
                    .reader
                    .files(from, &folder_path(kind, folder))
                    .is_empty()
                    && self.reader.read(from, &record_path(folder)).is_none()
                {
                    return None;
                }
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
