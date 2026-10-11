//! Where an action writes: the working tree that has the branch, or a worktree created for it at
//! `.worktrees/<branch>/`, never by switching the user's checkout (see `specs/decisions/git.md`).

use std::path::PathBuf;

use crate::git::{Git, GitError, others_staged};

/// The working tree an action writes in.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Place {
    pub root: PathBuf,
    /// Whether the worktree was created to reach the branch.
    pub created: bool,
    /// The branch this working tree was switched to, with `--switch` only.
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

/// Where a branch's worktree goes: `<main checkout>/.worktrees/<branch>`.
pub fn worktree_path(git: &Git, branch: &str) -> PathBuf {
    git.main_root().join(".worktrees").join(branch)
}

/// Reaches a branch: this working tree when it has it, another one that has it, or a worktree
/// created for it at `.worktrees/<branch>/`.
pub fn reach(git: &Git, branch: &str) -> Result<Place, PlaceError> {
    if git.current_branch().as_deref() == Some(branch) {
        return Ok(Place {
            root: git.root().to_path_buf(),
            created: false,
            switched: None,
        });
    }
    let worktrees = git.worktrees()?;
    if let Some(worktree) = worktrees
        .iter()
        .find(|worktree| worktree.branch.as_deref() == Some(branch) && worktree.path.exists())
    {
        return Ok(Place {
            root: worktree.path.clone(),
            created: false,
            switched: None,
        });
    }
    let path = worktree_path(git, branch);
    if path.exists() {
        return Err(GitError::WorktreeExists(format!(".worktrees/{branch}")).into());
    }
    git.exclude_worktrees()?;
    git.add_worktree(&path, branch)?;
    let root = std::fs::canonicalize(&path).unwrap_or(path);
    Ok(Place {
        root,
        created: true,
        switched: None,
    })
}

/// Reaches a branch by switching this working tree to it when it has no uncommitted change, for
/// the commands the human runs with `--switch`.
pub fn reach_switching(git: &Git, branch: &str) -> Result<Place, PlaceError> {
    let current = git.current_branch();
    if current.as_deref() == Some(branch) {
        return Ok(Place {
            root: git.root().to_path_buf(),
            created: false,
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
        created: false,
        switched: Some(branch.to_string()),
    })
}

/// Refuses when files other than `paths`, or files outside their folders, are staged in the
/// working tree an action writes in: its commit would carry them. Checked before any write.
pub fn ensure_only_staged(place: &Place, paths: &[String]) -> Result<(), GitError> {
    let git = Git::open(&place.root)?;
    let others = others_staged(&git.staged_files()?, paths);
    if others.is_empty() {
        Ok(())
    } else {
        Err(GitError::OtherStagedFiles(others))
    }
}

/// Switches a working tree back to the branch it was on, after an action that switched it was
/// refused before writing anything.
pub fn switch_back(git: &Git, place: &Place, previous: Option<&str>) {
    if let (Some(_), Some(previous)) = (&place.switched, previous) {
        let _ = git.switch(previous);
    }
}
