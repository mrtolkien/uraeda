//! Reading a workspace's files: from a working tree, or from a commit.

use std::collections::BTreeSet;
use std::fs;

use super::ReadFrom;
use crate::git::Git;

/// Reads a working tree's files, or a commit's.
pub(super) struct Reader<'a> {
    pub(super) git: &'a Git,
}

impl Reader<'_> {
    pub(super) fn read(&self, from: ReadFrom, path: &str) -> Option<String> {
        let bytes = match from {
            ReadFrom::Commit(commit) => self.git.read_file(commit, path).ok()??,
            ReadFrom::Disk => fs::read(self.git.root().join(path)).ok()?,
        };
        String::from_utf8(bytes).ok()
    }

    /// The files directly inside a folder.
    pub(super) fn files(&self, from: ReadFrom, dir: &str) -> Vec<String> {
        match from {
            ReadFrom::Commit(commit) => self
                .git
                .list_files(commit, dir)
                .unwrap_or_default()
                .into_iter()
                .filter_map(|path| {
                    let name = path.strip_prefix(dir)?.strip_prefix('/')?;
                    (!name.contains('/')).then(|| name.to_string())
                })
                .collect(),
            ReadFrom::Disk => {
                let mut names: Vec<String> = fs::read_dir(self.git.root().join(dir))
                    .into_iter()
                    .flatten()
                    .flatten()
                    .filter(|entry| entry.file_type().is_ok_and(|t| t.is_file()))
                    .filter_map(|entry| entry.file_name().into_string().ok())
                    .collect();
                names.sort();
                names
            }
        }
    }

    /// The proposal files and postponed folders of `specs/proposals/`, with a proposal.
    pub(super) fn proposals(&self, from: ReadFrom) -> Vec<String> {
        let dir = "specs/proposals";
        let paths: Vec<String> = match from {
            ReadFrom::Commit(commit) => self.git.list_files(commit, dir).unwrap_or_default(),
            ReadFrom::Disk => fs::read_dir(self.git.root().join(dir))
                .into_iter()
                .flatten()
                .flatten()
                .filter_map(|entry| {
                    let name = entry.file_name().into_string().ok()?;
                    let is_dir = entry.file_type().is_ok_and(|t| t.is_dir());
                    let file = if is_dir { "/proposal.md" } else { "" };
                    Some(format!("{dir}/{name}{file}"))
                })
                .filter(|path| self.git.root().join(path).is_file())
                .collect(),
        };
        let mut proposals = BTreeSet::new();
        for path in paths {
            let Some(rest) = path.strip_prefix(dir).and_then(|r| r.strip_prefix('/')) else {
                continue;
            };
            match rest.split_once('/') {
                Some((folder, "proposal.md")) => proposals.insert(format!("{dir}/{folder}")),
                None if rest.ends_with(".md") => proposals.insert(path.clone()),
                _ => false,
            };
        }
        proposals.into_iter().collect()
    }
}
