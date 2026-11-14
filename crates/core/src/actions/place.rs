//! Where an action writes: the working tree that holds the branch. `ura` never makes a worktree,
//! switches a checkout, or commits: the human's session host, or the next agent step, does.

use std::path::PathBuf;

use crate::git::{Git, GitError};

/// The working tree an action writes in.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Place {
    pub root: PathBuf,
}

#[derive(Debug, thiserror::Error)]
pub enum PlaceError {
    #[error(transparent)]
    Git(#[from] GitError),
    #[error("no worktree holds the branch {0}: check it out in a worktree first")]
    NoWorktree(String),
}

/// Reaches a branch: this working tree when it has it, else another that has it. Refused, before
/// anything is written, when none does, or when the checkout reached has a pull or a merge stopped.
pub fn reach(git: &Git, branch: &str) -> Result<Place, PlaceError> {
    let root = holder(git, branch)?.ok_or_else(|| PlaceError::NoWorktree(branch.to_string()))?;
    Git::open(&root)?.ensure_not_stopped()?;
    Ok(Place { root })
}

/// A checkout holds the branch checked out, or the one a stopped rebase replays: its writes are
/// then refused, never made in a new worktree, which git refuses for that branch.
fn holds(git: &Git) -> Option<String> {
    git.current_branch().or_else(|| git.rebasing())
}

/// The working tree that holds `branch`: this one, or another that exists.
pub(crate) fn holder(git: &Git, branch: &str) -> Result<Option<PathBuf>, GitError> {
    if holds(git).as_deref() == Some(branch) {
        return Ok(Some(git.root().to_path_buf()));
    }
    let worktrees = git.worktrees()?;
    Ok(worktrees
        .into_iter()
        .find(|worktree| {
            let held = || Git::open(&worktree.path).ok().as_ref().and_then(holds);
            worktree.path.exists()
                && worktree.branch.clone().or_else(held).as_deref() == Some(branch)
        })
        .map(|worktree| worktree.path))
}

/// A file's committed text, at `HEAD` of the working tree, from its top level.
pub fn committed(place: &Place, path: &str) -> Option<String> {
    let git = Git::open(&place.root).ok()?;
    let bytes = git.read_file(git.head()?, path).ok()??;
    String::from_utf8(bytes).ok()
}
