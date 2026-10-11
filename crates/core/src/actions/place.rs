//! Where an action writes: the working tree that has the branch, or this one, switched to it when
//! it has no uncommitted change.

use std::path::PathBuf;

use crate::git::{Git, GitError};

/// The working tree an action writes in.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Place {
    pub root: PathBuf,
    /// The branch this working tree was switched to, if it was.
    pub switched: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum PlaceError {
    #[error("detached HEAD: switch to a branch first")]
    Detached,
    #[error("cannot switch to {branch}: uncommitted changes in {}", .files.join(", "))]
    Uncommitted { branch: String, files: Vec<String> },
    #[error(transparent)]
    Git(#[from] GitError),
}

/// Reaches a branch: this working tree when it has it, another one that has it, or this one
/// switched to it when it has no uncommitted change.
pub fn reach(git: &Git, branch: &str) -> Result<Place, PlaceError> {
    let current = git.current_branch();
    if current.as_deref() == Some(branch) {
        return Ok(Place {
            root: git.root().to_path_buf(),
            switched: None,
        });
    }
    if let Some(worktree) = git
        .worktrees()?
        .into_iter()
        .find(|worktree| worktree.branch.as_deref() == Some(branch))
    {
        return Ok(Place {
            root: worktree.path,
            switched: None,
        });
    }
    if current.is_none() {
        return Err(PlaceError::Detached);
    }
    let files = git.changed_files()?;
    if !files.is_empty() {
        return Err(PlaceError::Uncommitted {
            branch: branch.to_string(),
            files,
        });
    }
    git.switch(branch)?;
    Ok(Place {
        root: git.root().to_path_buf(),
        switched: Some(branch.to_string()),
    })
}
