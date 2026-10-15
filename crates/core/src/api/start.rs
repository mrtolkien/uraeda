//! Starting a drafted feature or change, a change typed as a text, the slug proposed for it, and
//! the paths a draft may have.

use std::path::Path;

use super::{Result, encode_image, open, plain, refused, write_lock};
use crate::actions::start::{self, StartError, Started};
use crate::today;
use crate::view::StartedView;
use crate::workspace::Kind;

/// Starts a drafted feature, or a change with `Kind::Change`, in its own worktree.
pub fn start_feature(
    repo: &Path,
    draft: &str,
    slug: Option<&str>,
    kind: Kind,
) -> Result<StartedView> {
    draft_path(draft)?;
    let _lock = write_lock();
    let (git, workspace) = open(repo)?;
    view(start::run(
        &git,
        &workspace,
        draft,
        slug,
        kind,
        today::today(),
        false,
    ))
}

/// Starts a change typed as a text, with its images, in its own worktree. Each image is checked
/// and encoded as `image-1`, `image-2`, and so on, before the write lock is taken.
pub fn start_change(
    repo: &Path,
    text: &str,
    images: &[Vec<u8>],
    slug: Option<&str>,
) -> Result<StartedView> {
    let encoded = images
        .iter()
        .enumerate()
        .map(|(index, bytes)| encode_image(bytes, &format!("image-{}", index + 1)))
        .collect::<Result<Vec<_>>>()?;
    let _lock = write_lock();
    let (git, workspace) = open(repo)?;
    view(start::run_text(
        &git,
        &workspace,
        text,
        &encoded,
        slug,
        today::today(),
        false,
    ))
}

/// The kind a start takes from its name: a feature when none is given.
pub fn start_kind(name: Option<&str>) -> Result<Kind> {
    match name {
        None | Some("feature") => Ok(Kind::Feature),
        Some("change") => Ok(Kind::Change),
        Some(other) => Err(refused(format!(
            "\"{other}\" is not a kind: feature or change"
        ))),
    }
}

/// The slug proposed for a change typed with this title.
pub fn propose_slug(title: &str) -> String {
    crate::slug::propose(title)
}

/// A start's view, or its refusal: a failure after the first commit says what was done and what
/// is left.
fn view(started: std::result::Result<Started, StartError>) -> Result<StartedView> {
    match started {
        Ok(started) => Ok(StartedView {
            folder: started.folder,
            branch: started.branch,
            worktree: started.worktree,
        }),
        Err(StartError::Partial { done, left, cause }) => Err(refused(format!(
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
