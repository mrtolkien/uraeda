//! A feature's or a change's history, for its page.

use std::path::Path;

use super::{Result, find, open};
use crate::history::{self, HistoryView};

/// A feature's or a change's stages, read from its commits: a live one's from its branch, a done
/// one's from the default branch.
pub fn read_history(repo: &Path, folder: &str) -> Result<HistoryView> {
    let (git, workspace) = open(repo)?;
    let feature = find(&workspace, folder)?;
    Ok(history::read(
        &git,
        workspace.default_branch.as_deref(),
        feature,
    )?)
}
