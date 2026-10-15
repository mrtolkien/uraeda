//! What differs from `HEAD` under a path, and which paths of a commit git can add.

use super::{Git, GitError, others_staged, read_error};
use std::panic::{AssertUnwindSafe, catch_unwind};

impl Git {
    /// gix asserts when recreating its object store if the directory disappeared during a read.
    /// Keep that panic inside the status read instead of letting it abort the Node binding.
    pub(super) fn status_items(
        &self,
        what: &str,
        untracked: gix::status::UntrackedFiles,
    ) -> Result<gix::status::Iter, GitError> {
        catch_unwind(AssertUnwindSafe(|| {
            self.repo
                .status(gix::progress::Discard)
                .map_err(read_error(what))?
                .untracked_files(untracked)
                .index_worktree_rewrites(None)
                .into_iter(None)
                .map_err(read_error(what))
        }))
        .map_err(|panic| {
            let message = panic
                .downcast_ref::<String>()
                .map(String::as_str)
                .or_else(|| panic.downcast_ref::<&str>().copied())
                .unwrap_or("git status panicked");
            GitError::Read {
                what: what.into(),
                message: message.into(),
            }
        })?
    }

    /// The paths of a commit git can add: a deletion already staged, by the human, is
    /// not one, whether a file or a folder whose files the index no longer holds.
    pub(super) fn addable<'a>(
        &self,
        paths: &'a [String],
        staged: &[String],
    ) -> Result<Vec<&'a str>, GitError> {
        let mut addable = Vec::new();
        for path in paths {
            let staged_under =
                others_staged(staged, std::slice::from_ref(path)).len() < staged.len();
            if self.root.join(path).exists() || !staged_under || self.in_index(path)? {
                addable.push(path.as_str());
            }
        }
        Ok(addable)
    }

    /// Whether the files at or under `path` differ between `HEAD` and the working tree, as
    /// `git add --all` would stage them: ignored files left out, symbolic links compared as links,
    /// and a new file staged then deleted from disk, `AD`, no change.
    pub fn differs_from_head(&self, path: &str) -> Result<bool, GitError> {
        let output = self.output(
            "status",
            &[
                "--no-optional-locks",
                "status",
                "--porcelain=v1",
                "-z",
                "--untracked-files=all",
                "--no-renames",
                "--",
                path,
            ],
        )?;
        Ok(output
            .split('\0')
            .filter(|entry| entry.len() > 3)
            .any(|entry| !entry.starts_with("AD ")))
    }

    /// Whether the index holds `path`, or files under it.
    pub(crate) fn in_index(&self, path: &str) -> Result<bool, GitError> {
        let index = self
            .repo
            .index_or_empty()
            .map_err(read_error("the index"))?;
        let folder = format!("{}/", path.trim_end_matches('/'));
        Ok(index.entries().iter().any(|entry| {
            let entry = entry.path(&index);
            entry == path.as_bytes() || entry.starts_with(folder.as_bytes())
        }))
    }
}
