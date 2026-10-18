//! What the default branch merged, local or on `origin`: the records of `specs/done/` and the
//! feature and change folders of each tip.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;

use super::{Kind, ReadFrom, Reader, folder_path, folder_slug, record_kind, record_path};
use crate::git::ObjectId;

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
/// the next pull: the records and the folders of each tip.
pub(super) struct Merged {
    pub(super) records: Vec<BTreeMap<(Kind, String), String>>,
    pub(super) folders: Vec<(ObjectId, BTreeSet<(Kind, String)>)>,
    /// Every feature and change with a folder or a record there.
    pub(super) keys: BTreeSet<(Kind, String)>,
}

impl Merged {
    /// What each tip merged, or only the folder `only`'s record and folders.
    pub(super) fn read(reader: &Reader<'_>, tips: &[ObjectId], only: Option<&str>) -> Merged {
        let records: Vec<BTreeMap<(Kind, String), String>> = tips
            .iter()
            .map(|tip| match only {
                Some(folder) => reader.record(*tip, folder),
                None => reader.records(ReadFrom::Commit(*tip)),
            })
            .collect();
        let folders: Vec<(ObjectId, BTreeSet<(Kind, String)>)> = tips
            .iter()
            .map(|tip| match only {
                Some(folder) => (*tip, reader.folder(*tip, folder)),
                None => (*tip, reader.folders(ReadFrom::Commit(*tip))),
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
