//! Reading a workspace's files: from a working tree, or from a commit.

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
}
