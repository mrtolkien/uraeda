//! The default branch, where proposal files, note files, the priorities, and the inbox live:
//! reading its files from the checkout that has it, and reaching that checkout to write them.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use super::{Result, open, refused, write_lock};
use crate::actions::place;
use crate::cache;
use crate::git::Git;
use crate::workspace::Workspace;

/// A file of the default branch, from the working tree that has it, else from its tip; and its
/// committed text.
pub(super) fn on_default(
    git: &Git,
    workspace: &Workspace,
    path: &str,
) -> (Option<String>, Option<String>) {
    let Some(default) = workspace.default_branch.as_deref() else {
        return (None, None);
    };
    let committed = git
        .tip(default)
        .and_then(|tip| git.read_file(tip, path).ok().flatten())
        .and_then(|bytes| String::from_utf8(bytes).ok());
    match default_checkout(git, default) {
        Some(root) => (std::fs::read_to_string(root.join(path)).ok(), committed),
        None => (committed.clone(), committed),
    }
}

/// The working tree that has the default branch checked out, if any.
pub(crate) fn default_checkout(git: &Git, default: &str) -> Option<PathBuf> {
    if git.current_branch().as_deref() == Some(default) {
        Some(git.root().to_path_buf())
    } else {
        git.worktrees()
            .unwrap_or_default()
            .into_iter()
            .find(|worktree| worktree.branch.as_deref() == Some(default))
            .map(|worktree| worktree.path)
    }
}

/// Lets a tool act on a proposal file, a note file, or the priorities, at `path` from the root,
/// open with `text` in the checkout at `repo`. They are written on the default branch, from its
/// checkout: another branch's copy stands for it only while it holds the default branch's text,
/// read from the checkout that has it, or else from the branch. Names that checkout when they
/// differ, without creating one.
pub fn on_default_branch(repo: &Path, path: &str, text: &str) -> Result<()> {
    let git = Git::discover(repo)?;
    // Without a default branch, writing refuses on its own.
    let Some(default) = git.default_branch() else {
        return Ok(());
    };
    if git.current_branch().as_deref() == Some(default.as_str()) {
        return Ok(());
    }
    let checkout = default_checkout(&git, &default);
    let theirs = match &checkout {
        Some(checkout) => std::fs::read_to_string(checkout.join(path)).ok(),
        None => git
            .tip(&default)
            .and_then(|tip| git.read_file(tip, path).ok().flatten())
            .and_then(|bytes| String::from_utf8(bytes).ok()),
    };
    if theirs.as_deref() == Some(text) {
        return Ok(());
    }
    let name = path.rsplit('/').next().unwrap_or(path);
    Err(refused(match checkout {
        Some(checkout) => format!(
            "{name} here differs from {default}'s: open it from {default}'s checkout, {}.",
            checkout.display()
        ),
        None => {
            format!("{name} here differs from {default}'s: open it from a checkout of {default}.")
        }
    }))
}

pub(super) fn reach_default(repo: &Path) -> Result<place::Place> {
    let (git, workspace) = open(repo)?;
    Ok(reach(&git, workspace)?.0)
}

/// The checkout holding the default branch, as [`reach_default`] reaches it, with the workspace
/// read on the way, for a write that has written nothing yet: from memory when a read since the
/// last change kept it, as a read just before the write's lock would have answered.
pub(super) fn reach_default_from(repo: &Path) -> Result<(place::Place, Arc<Workspace>)> {
    let git = Git::discover(repo)?;
    let workspace = match cache::kept_read(&git) {
        Some(read) => Arc::clone(&read.workspace),
        None => open(repo)?.1,
    };
    reach(&git, workspace)
}

fn reach(git: &Git, workspace: Arc<Workspace>) -> Result<(place::Place, Arc<Workspace>)> {
    let default = workspace
        .default_branch
        .as_deref()
        .ok_or_else(|| refused("no default branch: commit on main first"))?;
    Ok((place::reach(git, default)?, workspace))
}

/// The checkout holding the default branch, where proposal files and the priorities are written:
/// this one, another that has it, or a worktree created for it, as [`expand_proposal`] reaches it.
pub fn default_root(repo: &Path) -> Result<PathBuf> {
    let _lock = write_lock(repo);
    Ok(reach_default(repo)?.root)
}
