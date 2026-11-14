//! Reading the features in progress, as [`in_progress`] finds them: each from the disk of the
//! worktree that holds it.

use std::collections::BTreeMap;

use super::{Feature, Kind, ReadFrom, Reader, Reading, in_progress, read_feature};
use crate::git::{Branch, Git};

impl Reading<'_> {
    /// Every feature and change in progress, read from its worktree's disk.
    pub(super) fn worktree_features(
        &self,
        branches: &[Branch],
    ) -> BTreeMap<(Kind, String), Feature> {
        let mut features = BTreeMap::new();
        for item in in_progress(self.git) {
            let key = (item.kind, item.folder.clone());
            if self.only.is_some_and(|only| only != item.folder) || self.merged.keys.contains(&key)
            {
                continue;
            }
            let Ok(worktree_git) = Git::open(&item.worktree) else {
                continue;
            };
            let reader = Reader { git: &worktree_git };
            let mut feature = read_feature(
                &reader,
                item.kind,
                &item.folder,
                Some(item.branch.clone()),
                ReadFrom::Disk,
                worktree_git.head(),
            );
            feature.worktree = Some(self.shown(&item.worktree));
            let branch = branches.iter().find(|branch| branch.name == item.branch);
            feature.behind = match branch.map(|branch| (branch.local, branch.remote)) {
                Some((Some(local), Some(remote))) => Some(self.git.behind(local, remote)),
                _ => None,
            };
            features.insert(key, feature);
        }
        features
    }
}
