//! Starting a drafted feature, and the paths a draft may have.

use std::path::Path;

use super::{Result, open, plain, refused, write_lock};
use crate::actions::start;
use crate::today;
use crate::view::StartedView;

/// Starts a drafted feature in its own worktree.
pub fn start_feature(repo: &Path, draft: &str, slug: Option<&str>) -> Result<StartedView> {
    draft_path(draft)?;
    let _lock = write_lock();
    let (git, workspace) = open(repo)?;
    match start::run(&git, &workspace, draft, slug, today::today(), false) {
        Ok(started) => Ok(StartedView {
            folder: started.branch.clone(),
            branch: started.branch,
            worktree: started.worktree,
        }),
        Err(start::StartError::Partial { done, left, cause }) => Err(refused(format!(
            "{cause}. Done: {}. Left: {}.",
            done.join(", "),
            left.join(", then ")
        ))),
        Err(error) => Err(refused(error.to_string())),
    }
}

/// Refuses any path but a draft's: a file or a postponed folder of `specs/drafts/` or
/// `specs/backlog/`, or a file of that folder.
pub(super) fn draft_path(path: &str) -> Result<()> {
    let rest = path
        .strip_prefix("specs/drafts/")
        .or_else(|| path.strip_prefix("specs/backlog/"));
    match rest {
        Some(rest) if plain(path) && rest.split('/').count() <= 2 => Ok(()),
        _ => Err(refused(format!("{path} is not a draft"))),
    }
}
