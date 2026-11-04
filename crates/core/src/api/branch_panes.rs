//! The changes waiting for a commit, a branch's each: the default branch's first, then each branch
//! whose checkout holds files a buffer edited. The lists' count of changes adds them up.

use std::path::PathBuf;

use super::buffer::branch_owner;
use super::default_checkout;
use crate::actions::changes::{self, Pane};
use crate::actions::place::Place;
use crate::git::Git;
use crate::workspace::Workspace;

/// One branch's changes: how many, and each as a line.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct BranchPane {
    pub branch: String,
    pub count: u32,
    pub lines: Vec<String>,
}

fn at(root: PathBuf) -> Place {
    Place {
        root,
        created: false,
        switched: None,
    }
}

/// Every branch with changes: the default branch's, from its checkout, then each other branch's
/// checked out, by name. A branch with no checkout has no uncommitted change.
pub(super) fn panes(git: &Git, workspace: &Workspace) -> Vec<BranchPane> {
    let default = workspace.default_branch.as_deref();
    let mut panes = Vec::new();
    let mut push = |branch: &str, root: PathBuf, pane: Pane| {
        let changes = changes::pane(&at(root), pane);
        if changes.count > 0 {
            panes.push(BranchPane {
                branch: branch.to_string(),
                count: changes.count,
                lines: changes.lines,
            });
        }
    };
    if let Some(default) = default
        && let Some(root) = default_checkout(git, default)
    {
        push(default, root, Pane::Default);
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
        let folder = branch_owner(workspace, &branch).map(|feature| feature.path.as_str());
        push(&branch, root, Pane::Branch { folder });
    }
    panes
}
