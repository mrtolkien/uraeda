//! The Commit page's panes: one per branch with changes, the default branch's first, then each
//! branch whose checkout holds files a buffer edited, each committed or discarded apart.

use std::path::{Path, PathBuf};

use serde::Serialize;

use super::{Result, default_checkout, open, refused, write_lock};
use crate::actions::changes::{self, Pane};
use crate::actions::place::{self, Place};
use crate::git::Git;
use crate::view::CommitView;
use crate::workspace::{Feature, Workspace};

/// One branch's pane: what its commit holds, a line each, and the message suggested for it.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchPane {
    pub branch: String,
    /// The folder of the feature or change on the branch, as an agent's session names it; none on
    /// the default branch.
    pub folder: Option<String>,
    pub count: u32,
    pub lines: Vec<String>,
    pub message: String,
}

fn at(root: PathBuf) -> Place {
    Place {
        root,
        created: false,
        switched: None,
    }
}

/// The unfinished feature or change on `branch`.
fn feature_on<'a>(workspace: &'a Workspace, branch: &str) -> Option<&'a Feature> {
    workspace
        .features
        .iter()
        .find(|feature| !feature.is_finished() && feature.branch.as_deref() == Some(branch))
}

/// The pane of `branch`, other than the default one.
fn branch_pane(feature: Option<&Feature>) -> Pane<'_> {
    Pane::Branch {
        folder: feature.map(|feature| feature.path.as_str()),
        slug: feature.map(|feature| feature.slug.as_str()),
    }
}

/// Every pane with changes: the default branch's, from its checkout, then each other branch's
/// checked out, by name. A branch with no checkout has no uncommitted change.
pub(super) fn panes(git: &Git, workspace: &Workspace) -> Vec<BranchPane> {
    let default = workspace.default_branch.as_deref();
    let mut panes = Vec::new();
    let mut push = |branch: &str, root: PathBuf, pane: Pane, folder: Option<String>| {
        let (changes, message) = changes::pane(&at(root), pane);
        if changes.count > 0 {
            panes.push(BranchPane {
                branch: branch.to_string(),
                folder,
                count: changes.count,
                lines: changes.lines,
                message,
            });
        }
    };
    if let Some(default) = default
        && let Some(root) = default_checkout(git, default)
    {
        push(default, root, Pane::Default, None);
    }
    let mut others: Vec<(String, PathBuf)> = git
        .worktrees()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|worktree| Some((worktree.branch?, worktree.path)))
        .filter(|(branch, path)| Some(branch.as_str()) != default && path.exists())
        .collect();
    others.sort();
    others.dedup_by(|a, b| a.0 == b.0);
    for (branch, root) in others {
        let feature = feature_on(workspace, &branch);
        let folder = feature.map(|feature| feature.folder.clone());
        push(&branch, root, branch_pane(feature), folder);
    }
    panes
}

/// The Commit page's panes, without creating a worktree.
pub fn branch_changes(repo: &Path) -> Result<Vec<BranchPane>> {
    let (git, workspace) = open(repo)?;
    Ok(panes(&git, &workspace))
}

/// Reaches `branch` with the pane it has: the default branch's checkout, created if need be, as
/// every write of the lists does, or another branch's, which must be checked out already.
fn reach_pane<'a>(git: &Git, workspace: &'a Workspace, branch: &str) -> Result<(Place, Pane<'a>)> {
    if workspace.default_branch.as_deref() == Some(branch) {
        return Ok((place::reach(git, branch)?, Pane::Default));
    }
    let checked_out = git
        .worktrees()?
        .iter()
        .any(|worktree| worktree.branch.as_deref() == Some(branch) && worktree.path.exists());
    if !checked_out {
        return Err(refused(format!("{branch} has no change to commit")));
    }
    let pane = branch_pane(feature_on(workspace, branch));
    Ok((place::reach(git, branch)?, pane))
}

/// Commits `branch`'s pane with `message` as typed, trimmed of the blank lines around it: see
/// [`changes::commit_pane`].
pub fn commit_branch(repo: &Path, branch: &str, message: &str) -> Result<CommitView> {
    let _lock = write_lock(repo);
    let (git, workspace) = open(repo)?;
    let (place, pane) = reach_pane(&git, &workspace, branch)?;
    let committed = changes::commit_pane(&place, pane, message)?;
    Ok(CommitView {
        subject: committed.change.subject,
        commit: committed.commit,
    })
}

/// Discards `branch`'s pane: see [`changes::discard_pane`].
pub fn discard_branch(repo: &Path, branch: &str) -> Result<()> {
    let _lock = write_lock(repo);
    let (git, workspace) = open(repo)?;
    let (place, pane) = reach_pane(&git, &workspace, branch)?;
    changes::discard_pane(&place, pane)?;
    Ok(())
}
