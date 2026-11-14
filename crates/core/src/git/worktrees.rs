//! The repository's working trees: listing them, adding one, and removing a clean one, never
//! forced.

use std::path::{Path, PathBuf};

use super::{Git, GitError, read_error};

/// A working tree of the repository, and the branch checked out in it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Worktree {
    pub path: PathBuf,
    pub branch: Option<String>,
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
}
