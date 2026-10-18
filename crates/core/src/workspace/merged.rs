//! What the default branch merged, local or on `origin`: the records of `specs/done/` and the
//! feature and change folders of each tip.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;

use super::{Kind, ReadFrom, Reader, folder_slug, record_kind, record_path};
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
    pub(super) fn read(reader: &Reader<'_>, tips: &[ObjectId]) -> Merged {
        let records: Vec<BTreeMap<(Kind, String), String>> = tips
            .iter()
            .map(|tip| reader.records(ReadFrom::Commit(*tip)))
            .collect();
        let folders: Vec<(ObjectId, BTreeSet<(Kind, String)>)> = tips
            .iter()
            .map(|tip| (*tip, reader.folders(ReadFrom::Commit(*tip))))
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
