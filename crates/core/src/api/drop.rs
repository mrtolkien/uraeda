//! Dropping a started feature or change: its proposal leaves the priorities, its worktree goes
//! unless that would lose work, and its branch stays.

use std::path::Path;

use super::{Result, open, write_lock};
use crate::actions::clean::{Left, Leftover, WhyLeft};
use crate::actions::drop;

/// A feature or a change dropped: its branch, kept, why its worktree stays, when it does, and
/// whether its proposal's removal was committed.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DroppedView {
    pub branch: String,
    pub worktree_left: Option<String>,
    /// Whether the proposal's removal was committed: when not, it stays written for the commit bar.
    pub committed: bool,
}

/// Drops the started feature or change of `folder`, from the main checkout, never forcing the
/// removal of its worktree and never deleting its branch.
pub fn drop_item(repo: &Path, folder: &str) -> Result<DroppedView> {
    let _lock = write_lock();
    let (git, workspace) = open(repo)?;
    let dropped = drop::run(&git, &workspace, folder)?;
    Ok(DroppedView {
        branch: dropped.branch,
        worktree_left: dropped.worktree.as_ref().map(stays),
        committed: dropped.committed,
    })
}

/// Why a dropped item's worktree stays, as the session says it.
fn stays(left: &Left) -> String {
    let (Leftover::Worktree(path) | Leftover::Branch(path)) = &left.what;
    match &left.why {
        WhyLeft::Changes => format!("Its worktree has uncommitted changes: it stays at {path}"),
        WhyLeft::Locked => format!("Its worktree is locked: it stays at {path}"),
        WhyLeft::YouAreInIt => format!("You are in its worktree: it stays at {path}"),
        WhyLeft::Outside(_) => format!("Its worktree is outside .worktrees/: it stays at {path}"),
        _ => format!("Its worktree stays at {path}"),
    }
}
