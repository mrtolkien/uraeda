//! Starting a feature or change from its proposal file, a change typed as a text, the slug proposed
//! for it, and the paths a proposal file or a note file may have.

use std::path::Path;

use super::{ApiError, Result, default_checkout, encode_image, open, plain, refused, write_lock};
use crate::actions::start::{self, Run, StartError, StartProgress, Started};
use crate::actions::{deferred, place, promote};
use crate::cache;
use crate::git::Git;
use crate::today;
use crate::view::{PlannedView, PromotedView, StartedView};
use crate::workspace::Kind;

/// What starting a feature from its proposal file, or a change with `Kind::Change`, would make:
/// every check of the start made but those of uncommitted and staged files, which a queued write
/// may have left and the start makes in its turn, without the write lock, nothing written. Read from the
/// default branch's checkout, which is reached, as the start would, only when there is none.
pub fn plan_start(
    repo: &Path,
    proposal: &str,
    slug: Option<&str>,
    kind: Kind,
) -> Result<PlannedView> {
    proposal_path(proposal)?;
    let (git, workspace) = open(repo)?;
    let default = workspace
        .default_branch
        .clone()
        .ok_or_else(|| refused("no default branch: commit on main first"))?;
    let root = match default_checkout(&git, &default) {
        Some(root) => root,
        None => place::reach(&git, &default)?.root,
    };
    let today = today::today();
    match start::plan(&git, &root, &workspace, proposal, slug, kind, today) {
        Ok(planned) => Ok(PlannedView {
            folder: planned.folder,
            branch: planned.branch,
            slug: planned.slug,
            title: planned.title,
        }),
        Err(error) => Err(refusal(error)),
    }
}

/// Starts a feature from its proposal file, or a change with `Kind::Change`, in its own worktree,
/// each step given to `on_step` as it is reached, the commit's output streamed. In a repository
/// the server defers commits for, a hook's refusal of the start commit puts the proposal file and
/// the priorities back as they were, nothing committed, as a `hook` error with the hook's output;
/// elsewhere, as through `ura`, the files stay written, for the start to be finished by hand.
pub fn start_feature(
    repo: &Path,
    proposal: &str,
    slug: Option<&str>,
    kind: Kind,
    on_step: &dyn Fn(StartProgress),
) -> Result<StartedView> {
    proposal_path(proposal)?;
    let _lock = write_lock(repo);
    let (git, workspace) = open(repo)?;
    let run = steps_run(repo, on_step);
    view(start::run_with(
        &git, &workspace, proposal, slug, kind, &run,
    ))
}

/// A start with its steps reported, whose commit refused by a hook puts back what it wrote when
/// the server defers the commits of the repository holding `repo`.
fn steps_run<'a>(repo: &Path, on_step: &'a dyn Fn(StartProgress)) -> Run<'a> {
    Run {
        today: today::today(),
        switch: false,
        on_step: Some(on_step),
        restore: deferred::deferring(&cache::key(repo)),
    }
}

/// Starts a change typed as a text, with its images, in its own worktree, its steps given to
/// `on_step` as [`start_feature`] does, and a hook's refusal of its commit, when the server defers
/// commits, leaves nothing written.
/// Each image is checked and encoded as `image-1`, `image-2`, and so on, before the write lock is
/// taken.
pub fn start_change(
    repo: &Path,
    text: &str,
    images: &[Vec<u8>],
    slug: Option<&str>,
    on_step: &dyn Fn(StartProgress),
) -> Result<StartedView> {
    let encoded = images
        .iter()
        .enumerate()
        .map(|(index, bytes)| encode_image(bytes, &format!("image-{}", index + 1)))
        .collect::<Result<Vec<_>>>()?;
    let _lock = write_lock(repo);
    let (git, workspace) = open(repo)?;
    let run = steps_run(repo, on_step);
    view(start::run_text_with(
        &git, &workspace, text, &encoded, slug, &run,
    ))
}

/// Makes the change in `folder` a feature, in place, in its worktree: its open pull requests are
/// asked of `gh` first, since one refuses the move.
pub fn promote_change(repo: &Path, folder: &str) -> Result<PromotedView> {
    let _lock = write_lock(repo);
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
/// anything, and what is left. A feature's taken slug is refused by its name; a change's keeps the
/// message naming its folder, which the server reads.
fn refusal(error: StartError) -> ApiError {
    match error {
        StartError::Hook { message, output } => ApiError {
            code: "hook",
            message: format!("git commit failed: {message}"),
            output: Some(output),
        },
        StartError::Taken {
            slug,
            kind: Kind::Feature,
            ..
        } => refused(format!("A feature named {slug} exists already")),
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
        _ => Err(refused(format!(
            "{path} is not a proposal file or a note file"
        ))),
    }
}
