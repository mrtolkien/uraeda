//! The repository's working trees: listing them, adding one, and removing a clean one, never
//! forced.

use std::path::{Path, PathBuf};

use super::{Git, GitError, read_error, refresh};

/// A working tree of the repository, and the branch checked out in it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Worktree {
    pub path: PathBuf,
    pub branch: Option<String>,
}

/// A linked worktree as git records it, its folder there or not.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WorktreeRecord {
    pub path: PathBuf,
    pub branch: Option<String>,
    pub locked: bool,
    /// Its folder is gone: `git worktree prune` drops the record.
    pub missing: bool,
}

impl Git {
    /// Checks out an existing branch, local or only on `origin`, in a new worktree at `path`,
    /// after pruning the worktrees whose folder is gone.
    pub fn add_worktree(&self, path: &Path, branch: &str) -> Result<(), GitError> {
        self.run("worktree", &["worktree", "prune"])?;
        let path = path.to_string_lossy();
        let local = self
            .repo
            .try_find_reference(format!("refs/heads/{branch}").as_str())
            .ok()
            .flatten()
            .is_some();
        if local {
            self.run("worktree", &["worktree", "add", "--quiet", &path, branch])
        } else {
            let remote = format!("origin/{branch}");
            self.run(
                "worktree",
                &[
                    "worktree", "add", "--quiet", "--track", "-b", branch, &path, &remote,
                ],
            )
        }
    }

    /// Creates `branch` from `from`, checked out in a new worktree at `path`, whose index is then
    /// refreshed in the background when a server watches the repository.
    pub fn add_worktree_new(&self, path: &Path, branch: &str, from: &str) -> Result<(), GitError> {
        self.run("worktree", &["worktree", "prune"])?;
        let shown = path.to_string_lossy();
        self.run(
            "worktree",
            &["worktree", "add", "--quiet", "-b", branch, &shown, from],
        )?;
        // Only a server, which watches the repository, lives on to read it: a refresh in a process
        // that exits, as `ura`'s, or beside direct calls, as the core's tests', only races them.
        if crate::cache::watched(&self.root) {
            refresh::refresh_later(self.root.join(path));
        }
        Ok(())
    }

    /// Keeps `.worktrees/` out of `git status`, through `.git/info/exclude`, once.
    pub fn exclude_worktrees(&self) -> Result<(), GitError> {
        let info = self.repo.common_dir().join("info");
        let exclude = info.join("exclude");
        let text = std::fs::read_to_string(&exclude).unwrap_or_default();
        if text.lines().any(|line| line.trim() == "/.worktrees/") {
            return Ok(());
        }
        let write = || -> std::io::Result<()> {
            std::fs::create_dir_all(&info)?;
            let mut text = text.clone();
            if !text.is_empty() && !text.ends_with('\n') {
                text.push('\n');
            }
            text.push_str("/.worktrees/\n");
            std::fs::write(&exclude, text)
        };
        write().map_err(read_error(".git/info/exclude"))
    }

    /// Every working tree of the repository, the main one first.
    pub fn worktrees(&self) -> Result<Vec<Worktree>, GitError> {
        let mut worktrees = Vec::new();
        for repo in self
            .repo
            .worktrees_including_main()
            .map_err(read_error("worktrees"))?
        {
            let Ok(repo) = repo else {
                continue;
            };
            let Some(path) = repo.workdir() else {
                continue;
            };
            let path = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
            let branch = repo
                .head_name()
                .ok()
                .flatten()
                .map(|name| name.shorten().to_string());
            worktrees.push(Worktree { path, branch });
        }
        Ok(worktrees)
    }

    /// Every linked worktree git records, with its branch, whether it is locked, and whether its
    /// folder is missing.
    pub fn worktree_records(&self) -> Result<Vec<WorktreeRecord>, GitError> {
        let mut records = Vec::new();
        for proxy in self.repo.worktrees().map_err(read_error("worktrees"))? {
            let Ok(path) = proxy.base() else {
                continue;
            };
            let missing = !path.exists();
            let path = std::fs::canonicalize(&path).unwrap_or(path);
            let locked = proxy.is_locked();
            let branch = proxy
                .into_repo_with_possibly_inaccessible_worktree()
                .ok()
                .and_then(|repo| repo.head_name().ok().flatten())
                .map(|name| name.shorten().to_string());
            records.push(WorktreeRecord {
                path,
                branch,
                locked,
                missing,
            });
        }
        Ok(records)
    }

    /// Drops the records of worktrees whose folder is gone.
    pub fn prune_worktrees(&self) -> Result<(), GitError> {
        self.run("worktree", &["worktree", "prune"])
    }

    /// Removes a clean worktree, never forced: git refuses one with changes.
    pub fn remove_worktree(&self, path: &Path) -> Result<(), GitError> {
        let path = path.to_string_lossy();
        self.run("worktree", &["worktree", "remove", &path])
    }
}
