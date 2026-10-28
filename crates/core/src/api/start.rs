//! Starting a feature or change from its proposal file, a change typed as a text, the slug proposed
//! for it, and the paths a proposal file or a note file may have.

use std::path::Path;

use super::{Result, encode_image, open, plain, refused, write_lock};
use crate::actions::promote;
use crate::actions::start::{self, StartError, Started};
use crate::git::Git;
use crate::today;
use crate::view::{PromotedView, StartedView};
use crate::workspace::Kind;

/// Starts a feature from its proposal file, or a change with `Kind::Change`, in its own worktree.
pub fn start_feature(
    repo: &Path,
    proposal: &str,
    slug: Option<&str>,
    kind: Kind,
) -> Result<StartedView> {
    proposal_path(proposal)?;
    let _lock = write_lock();
    let (git, workspace) = open(repo)?;
    view(start::run(
        &git,
        &workspace,
        proposal,
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

/// Makes the change in `folder` a feature, in place, in its worktree: its open pull requests are
/// asked of `gh` first, since one refuses the move.
pub fn promote_change(repo: &Path, folder: &str) -> Result<PromotedView> {
    let _lock = write_lock();
    crate::pulls::refresh(&Git::discover(repo)?.main_root());
    let (git, workspace) = open(repo)?;
    match promote::run(&git, &workspace, folder) {
        Ok(promoted) => Ok(PromotedView {
            folder: promoted.folder,
            branch: promoted.branch,
            decisions: promoted.decisions,
        }),
        Err(error) => Err(refusal(error)),
    }
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

/// The slug proposed for a change typed as `text`, from the title `start_change` reads in it: empty
/// when it has none.
pub fn propose_slug(text: &str) -> String {
    start::propose_slug(text)
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
        Err(error) => Err(refusal(error)),
    }
}

/// A start's or a move's refusal: a failure after the first write says what was done, if
/// anything, and what is left.
fn refusal(error: StartError) -> super::ApiError {
    match error {
        StartError::Partial { done, left, cause } => {
            let done = if done.is_empty() {
                String::new()
            } else {
                format!(" Done: {}.", done.join(", "))
            };
            refused(format!("{cause}.{done} Left: {}.", left.join(", then ")))
        }
        error => refused(error.to_string()),
    }
}

/// Refuses any path but a proposal file's: a file or a postponed folder of `specs/proposals/`, or
/// a file of that folder.
pub(super) fn proposal_path(path: &str) -> Result<()> {
    match path.strip_prefix(crate::target::PROPOSALS) {
        Some(rest) if plain(path) && rest.split('/').count() <= 2 => Ok(()),
        _ => Err(refused(format!("{path} is not a proposal file"))),
    }
}

/// Refuses any path but a proposal file's or a note file's: a file or a folder of
/// `specs/proposals/` or `specs/notes/`, or a file of that folder.
pub(super) fn linked_path(path: &str) -> Result<()> {
    let rest = path
        .strip_prefix(crate::target::PROPOSALS)
        .or_else(|| path.strip_prefix(crate::target::NOTES));
    match rest {
        Some(rest) if plain(path) && rest.split('/').count() <= 2 => Ok(()),
        _ => Err(refused(format!("{path} is not a proposal file"))),
    }
}
