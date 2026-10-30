//! A feature's or a change's history, for its page.

use std::path::Path;

use super::{Result, find, refused};
use crate::cache;
use crate::git::Git;
use crate::history::{self, HistoryView};
use crate::workspace::Workspace;

/// A feature's or a change's stages, read from its commits: a live one's from its branch, a done
/// one's from the default branch, or from its branch when its merge was never fetched. Only its own
/// folder is read, not the whole workspace (SC-002), and from memory when a read since the last
/// change kept it.
pub fn read_history(repo: &Path, folder: &str) -> Result<HistoryView> {
    let git = Git::discover(repo)?;
    cache::kept(&git, &format!("history {folder}"), || history(&git, folder))
}

fn history(git: &Git, folder: &str) -> Result<HistoryView> {
    let workspace =
        Workspace::read_folder(git, folder).map_err(|error| refused(error.to_string()))?;
    let feature = find(&workspace, folder)?;
    Ok(history::read(
        git,
        workspace.default_branch.as_deref(),
        feature,
    )?)
}
