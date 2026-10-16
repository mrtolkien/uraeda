//! A review's comments and verdicts on a spec or a plan, committed on its feature's branch.

use std::path::Path;

use super::{Result, reach, read_file, refused, write_lock};
use crate::actions::place;
use crate::actions::review::{self, Tier};
use crate::git::Git;
use crate::today;
use crate::view::FileView;
use crate::workspace::Feature;

/// Adds a comment on lines of the committed file, or on all of it.
pub fn add_comment(
    repo: &Path,
    folder: &str,
    file: &str,
    lines: Option<(u32, u32)>,
    text: &str,
) -> Result<FileView> {
    let _lock = write_lock();
    let (git, feature, place) = reach(repo, folder)?;
    let lines = lines.map(|(start, end)| (start as usize, end as usize));
    review::comment(&git, &place, &feature, file, lines, text)?;
    read_file(repo, folder, file)
}

/// Replaces a pending comment's text.
pub fn edit_comment(
    repo: &Path,
    folder: &str,
    file: &str,
    number: u32,
    text: &str,
) -> Result<FileView> {
    let _lock = write_lock();
    let (_, feature, place) = reach(repo, folder)?;
    review::edit(&place, &feature, file, number, text)?;
    read_file(repo, folder, file)
}

/// Removes a pending comment.
pub fn remove_comment(repo: &Path, folder: &str, file: &str, number: u32) -> Result<FileView> {
    let _lock = write_lock();
    let (_, feature, place) = reach(repo, folder)?;
    review::remove(&place, &feature, file, number)?;
    read_file(repo, folder, file)
}

/// Deletes the pending review, to review the new version from scratch.
pub fn start_over(repo: &Path, folder: &str, file: &str) -> Result<FileView> {
    let _lock = write_lock();
    let (_, feature, place) = reach(repo, folder)?;
    review::start_over(&place, &feature, file)?;
    read_file(repo, folder, file)
}

/// Refuses a verdict on a file whose text on disk differs from its branch's tip: the page shows the
/// committed version, and the verdict must not commit another.
fn as_committed(git: &Git, feature: &Feature, place: &place::Place, file: &str) -> Result<()> {
    let path = format!("{}/{file}", feature.path);
    let on_disk = std::fs::read(place.root.join(&path)).ok();
    let at_tip = feature
        .branch
        .as_deref()
        .and_then(|branch| git.tip(branch))
        .and_then(|tip| git.read_file(tip, &path).ok().flatten());
    if on_disk != at_tip {
        return Err(refused(format!(
            "{file} has changes not committed: the review is of the committed version"
        )));
    }
    Ok(())
}

/// Approves a spec or a plan, and commits it.
pub fn approve(
    repo: &Path,
    folder: &str,
    file: &str,
    summary: Option<&str>,
    risk_tier: Option<String>,
    plan_review: Option<bool>,
) -> Result<FileView> {
    let _lock = write_lock();
    let (git, feature, place) = reach(repo, folder)?;
    as_committed(&git, &feature, &place, file)?;
    let tier = Tier {
        risk_tier,
        plan_review,
    };
    let summary = summary.filter(|s| !s.trim().is_empty());
    review::approve_and_commit(&place, &feature, file, summary, &tier, today::today())?;
    read_file(repo, folder, file)
}

/// Requests changes on a spec or a plan, and commits it.
pub fn request_changes(
    repo: &Path,
    folder: &str,
    file: &str,
    summary: Option<&str>,
) -> Result<FileView> {
    let _lock = write_lock();
    let (git, feature, place) = reach(repo, folder)?;
    as_committed(&git, &feature, &place, file)?;
    let summary = summary.filter(|s| !s.trim().is_empty());
    review::request_changes_and_commit(&place, &feature, file, summary, today::today())?;
    read_file(repo, folder, file)
}
