//! The repository's pull requests, asked of `gh` once for every read that follows.

use std::path::Path;

use super::Result;
use crate::git::Git;
use crate::pulls;

/// Asks `gh` for the open pull requests of the repository holding `repo`, and keeps them for its
/// workspace reads: whether they changed since the last refresh.
pub fn refresh_pull_requests(repo: &Path) -> Result<bool> {
    let git = Git::discover(repo)?;
    Ok(pulls::refresh(&git.main_root()))
}
