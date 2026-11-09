//! A review's findings, written and committed in the folder of the feature's worktree.

use std::path::Path;

use super::{Result, reach, write_lock};
use crate::actions::findings::{self, Findings};
use crate::view::feature_title;

/// Writes the next `findings-NN.md` in the folder of the feature's worktree, and commits it alone,
/// as `review(<slug>): findings NN`. Returns its path from the repository's top level.
pub fn write_findings(repo: &Path, folder: &str, findings: &Findings) -> Result<String> {
    let _lock = write_lock(repo);
    let (_, feature, place) = reach(repo, folder)?;
    let title = feature_title(&feature);
    Ok(findings::write_and_commit(
        &place, &feature, &title, findings,
    )?)
}
