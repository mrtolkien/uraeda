//! What the default branch merged, local or on `origin`: the records of `specs/done/` and the
//! feature and change folders of each tip whose branch is gone. A started feature's folder is on
//! the default branch from its start, and is its branch's while the branch is there. Each is read
//! as a feature done, with the branch and the worktree it left.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;

use super::{
    Feature, Kind, ReadFrom, Reader, Reading, Source, folder_branch, folder_path, folder_slug,
    read_feature, record_kind, record_path,
};
use crate::git::{Branch, ObjectId};
use crate::steps::Step;

impl Reader<'_> {
    /// The records of `specs/done/`, by kind and folder, with their texts.
    fn records(&self, from: ReadFrom) -> BTreeMap<(Kind, String), String> {
        let mut records = BTreeMap::new();
        for name in self.files(from, "specs/done") {
            let Some(folder) = name.strip_suffix(".md") else {
                continue;
            };
            if folder_slug(folder).is_none() {
                continue;
            }
            if let Some(text) = self.read(from, &record_path(folder)) {
                records.insert((record_kind(&text), folder.to_string()), text);
            }
        }
        records
    }

    /// The record of `folder` at a commit, as [`Reader::records`] has it.
    fn record(&self, commit: ObjectId, folder: &str) -> BTreeMap<(Kind, String), String> {
        let from = ReadFrom::Commit(commit);
        let text = folder_slug(folder).and(self.read(from, &record_path(folder)));
        text.map(|text| ((record_kind(&text), folder.to_string()), text))
            .into_iter()
            .collect()
    }

    /// The feature or change folder `folder` at a commit, as [`Reader::folders`] has it.
    fn folder(&self, commit: ObjectId, folder: &str) -> BTreeSet<(Kind, String)> {
        [Kind::Feature, Kind::Change]
            .into_iter()
            .filter(|kind| {
                let path = folder_path(*kind, folder);
                folder_slug(folder).is_some()
                    && !self
                        .git
                        .list_files(commit, &path)
                        .unwrap_or_default()
                        .is_empty()
            })
            .map(|kind| (kind, folder.to_string()))
            .collect()
    }

    /// The feature and change folders under `specs/`.
    fn folders(&self, from: ReadFrom) -> BTreeSet<(Kind, String)> {
        let mut folders = BTreeSet::new();
        for (kind, dir) in [(Kind::Feature, "specs"), (Kind::Change, "specs/changes")] {
            let names: Vec<String> = match from {
                ReadFrom::Commit(commit) => self
                    .git
                    .list_files(commit, dir)
                    .unwrap_or_default()
                    .into_iter()
                    .filter_map(|path| {
                        let rest = path.strip_prefix(dir)?.strip_prefix('/')?;
                        let (folder, _) = rest.split_once('/')?;
                        Some(folder.to_string())
                    })
                    .collect(),
                ReadFrom::Disk => fs::read_dir(self.git.root().join(dir))
                    .into_iter()
                    .flatten()
                    .flatten()
                    .filter(|entry| entry.file_type().is_ok_and(|t| t.is_dir()))
                    .filter_map(|entry| entry.file_name().into_string().ok())
                    .collect(),
            };
            for name in names {
                if folder_slug(&name).is_some() {
                    folders.insert((kind, name));
                }
            }
        }
        folders
    }
}

/// What the default branch merged, local or on `origin`, so a merge made on the forge shows before
/// the next pull: the records, and the folders of each tip without a branch.
pub(super) struct Merged {
    pub(super) records: Vec<BTreeMap<(Kind, String), String>>,
    pub(super) folders: Vec<(ObjectId, BTreeSet<(Kind, String)>)>,
    /// Every feature and change with a folder or a record there.
    pub(super) keys: BTreeSet<(Kind, String)>,
}

impl Merged {
    /// What each tip merged, or only the folder `only`'s record and folders.
    pub(super) fn read(
        reader: &Reader<'_>,
        tips: &[ObjectId],
        only: Option<&str>,
        branches: &[Branch],
    ) -> Merged {
        let branched = |(kind, folder): &(Kind, String)| {
            let name = folder_branch(*kind, folder);
            branches.iter().any(|branch| branch.name == name)
        };
        let records: Vec<BTreeMap<(Kind, String), String>> = tips
            .iter()
            .map(|tip| match only {
                Some(folder) => reader.record(*tip, folder),
                None => reader.records(ReadFrom::Commit(*tip)),
            })
            .collect();
        let folders: Vec<(ObjectId, BTreeSet<(Kind, String)>)> = tips
            .iter()
            .map(|tip| {
                let mut folders = match only {
                    Some(folder) => reader.folder(*tip, folder),
                    None => reader.folders(ReadFrom::Commit(*tip)),
                };
                folders.retain(|key| !branched(key));
                (*tip, folders)
            })
            .collect();
        let keys = records
            .iter()
            .flat_map(|records| records.keys().cloned())
            .chain(
                folders
                    .iter()
                    .flat_map(|(_, folders)| folders.iter().cloned()),
            )
            .collect();
        Merged {
            records,
            folders,
            keys,
        }
    }
}

impl Reading<'_> {
    /// The features merged into the default branch, read from it: the record first, local first,
    /// with the branch and the worktree left behind.
    pub(super) fn merged_features(&self, branches: &[Branch]) -> Vec<Feature> {
        let local_branches: BTreeSet<&str> = branches
            .iter()
            .filter(|branch| branch.local.is_some())
            .map(|branch| branch.name.as_str())
            .collect();
        let worktrees = self.git.worktrees().unwrap_or_default();
        let mut features = Vec::new();
        for (kind, folder) in &self.merged.keys {
            let key = (*kind, folder.clone());
            let record = self
                .merged
                .records
                .iter()
                .find_map(|records| records.get(&key));
            let mut feature = match record {
                Some(text) => Feature::from_record(*kind, folder, text.clone()),
                None => {
                    let Some((tip, _)) = self
                        .merged
                        .folders
                        .iter()
                        .find(|(_, folders)| folders.contains(&key))
                    else {
                        continue;
                    };
                    let from = ReadFrom::Commit(*tip);
                    read_feature(&self.reader, *kind, folder, None, from, Some(*tip))
                }
            };
            let branch = folder_branch(*kind, folder);
            feature.source = Source::DefaultBranch;
            feature.branch = None;
            feature.step = Step::done();
            feature.left_worktree = worktrees
                .iter()
                .find(|w| w.path != self.main_root && w.branch.as_deref() == Some(branch.as_str()))
                .map(|w| self.shown(&w.path));
            feature.left_branch = local_branches.contains(branch.as_str()).then_some(branch);
            features.push(feature);
        }
        features
    }
}
