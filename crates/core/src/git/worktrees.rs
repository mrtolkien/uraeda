//! The repository's working trees: listing them, adding one, and removing a clean one, never
//! forced.

use std::path::PathBuf;

use super::{Git, GitError, read_error};

/// A working tree of the repository, and the branch checked out in it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Worktree {
    pub path: PathBuf,
    pub branch: Option<String>,
}

impl Git {
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
