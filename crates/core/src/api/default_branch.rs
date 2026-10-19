//! The default branch, where drafts, backlog files, the priorities, and the inbox live: reading its
//! files from the checkout that has it, and reaching that checkout to write them.

use std::path::{Path, PathBuf};

use super::{Result, open, refused, write_lock};
use crate::actions::place;
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

/// Lets a tool act on a draft, a backlog file, or the priorities, at `path` from the root, open
/// with `text` in the checkout at `repo`. They are written on the default branch, from its checkout:
/// another branch's copy stands for it only while it holds the default branch's text, read from the
/// checkout that has it, or else from the branch. Names that checkout when they differ, without
/// creating one.
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
    Ok(reach_default_from(repo)?.0)
}

/// The checkout holding the default branch, as [`reach_default`] reaches it, with the workspace
/// read on the way.
pub(super) fn reach_default_from(repo: &Path) -> Result<(place::Place, Workspace)> {
    let (git, workspace) = open(repo)?;
    let default = workspace
        .default_branch
        .as_deref()
        .ok_or_else(|| refused("no default branch: commit on main first"))?;
    Ok((place::reach(&git, default)?, workspace))
}

/// The checkout holding the default branch, where drafts and the priorities are written: this one,
/// another that has it, or a worktree created for it, as [`create_draft`] reaches it.
pub fn default_root(repo: &Path) -> Result<PathBuf> {
    let _lock = write_lock();
    Ok(reach_default(repo)?.root)
}
