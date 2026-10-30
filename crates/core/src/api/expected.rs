//! The step a feature or a change is expected to have once its uncommitted workflow files are
//! committed, for the composer's message while a folder's commits wait in the server's queue.

use std::path::Path;

use super::{Result, find, open};
use crate::pulls;
use crate::steps::{self, PullRequest};
use crate::view::NextView;

/// The step the feature or change of `folder` will have once its uncommitted workflow files are
/// committed: its step computed from its files as they are on disk, where [`next_step`] reads the
/// branch's latest commit. A prediction for the composer's message only, while the folder's
/// commits are queued: never the branch's step, which the Git decision reads from its latest
/// commit alone. A folder checked out nowhere, or with nothing uncommitted, has its branch's step.
///
/// [`next_step`]: super::next_step
pub fn expected_step(repo: &Path, folder: &str) -> Result<NextView> {
    let (git, workspace) = open(repo)?;
    let feature = find(&workspace, folder)?;
    // A feature read from disk keeps its files' texts; only its step is the tip's.
    let mut step = steps::step(feature, PullRequest::Unknown);
    if let Some(branch) = &feature.branch
        && step.depends_on_pull_request()
    {
        let state = pulls::latest(&git.main_root()).state(branch);
        step = steps::step(feature, state);
    }
    Ok(NextView {
        folder: feature.folder.clone(),
        branch: feature.branch.clone(),
        main_root: git.main_root().to_string_lossy().into_owned(),
        step: (&step).into(),
    })
}
