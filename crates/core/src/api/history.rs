//! A feature's or a change's history, for its page.

use std::path::Path;

use super::{Result, find, refused};
use crate::git::Git;
use crate::history::{self, HistoryView};
use crate::workspace::Workspace;

/// A feature's or a change's stages, read from its commits: a live one's from its branch, a done
/// one's from the default branch. Only its own folder is read, not the whole workspace (SC-002).
pub fn read_history(repo: &Path, folder: &str) -> Result<HistoryView> {
    let git = Git::discover(repo)?;
    let workspace =
        Workspace::read_folder(&git, folder).map_err(|error| refused(error.to_string()))?;
    let feature = find(&workspace, folder)?;
    Ok(history::read(
        &git,
        workspace.default_branch.as_deref(),
        feature,
    )?)
}
