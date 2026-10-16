//! The edits of the priorities, each written on the default branch and returning the priorities
//! with their changes since the last commit.

use std::path::Path;

use super::{
    Result, default_checkout, on_default, open, reach_default, reach_default_from, refused,
    write_lock,
};
use crate::actions::commit::Added;
use crate::actions::{changes, place, priorities as edits};
use crate::files::priorities::{self, Priorities, Section};
use crate::git::Git;
use crate::workspace::Workspace;

pub(super) fn section(id: &str) -> Result<Section> {
    Section::from_id(id).ok_or_else(|| refused(format!("no section {id}")))
}

/// How many changes the commit bar counts, in the default branch's checkout: none without one,
/// since the branch's tip has no uncommitted change.
pub(super) fn change_count(git: &Git, workspace: &Workspace) -> u32 {
    let checkout = workspace
        .default_branch
        .as_deref()
        .and_then(|default| default_checkout(git, default));
    checkout.map_or(0, |root| {
        changes::list(&place::Place {
            root,
            created: false,
            switched: None,
        })
        .count
    })
}

/// The priorities, with the count of the commit bar's changes, without creating a worktree.
pub fn read_priorities(repo: &Path) -> Result<Priorities> {
    let (git, workspace) = open(repo)?;
    Ok(Priorities {
        changes: change_count(&git, &workspace),
        ..joined_priorities(&git, &workspace)
    })
}

/// The default branch's priorities, each entry with its draft and running feature from the
/// workspace, without the count of the commit bar's changes.
pub(crate) fn joined_priorities(git: &Git, workspace: &Workspace) -> Priorities {
    let (text, _) = on_default(git, workspace, edits::PATH);
    workspace.join_priorities(priorities::read(&text.unwrap_or_default(), None))
}

/// The priorities joined with the workspace read now.
fn joined(repo: &Path, priorities: Priorities) -> Result<Priorities> {
    Ok(open(repo)?.1.join_priorities(priorities))
}

/// Adds a line at the end of a section. Edits keep the drafts and features: the workspace read
/// before them joins their answer.
pub fn add_priority(
    repo: &Path,
    section_id: &str,
    line: &str,
    previous: &str,
) -> Result<Priorities> {
    let _lock = write_lock();
    let (place, workspace) = reach_default_from(repo)?;
    Ok(workspace.join_priorities(edits::add(&place, section(section_id)?, line, previous)?))
}

/// Adds a line at the end of a section, as [`add_priority`] does, then commits `PRIORITIES.md`
/// alone, when it had no other change, with `chore: add "<short>" to <Section>`.
pub fn add_priority_and_commit(
    repo: &Path,
    section_id: &str,
    line: &str,
    previous: &str,
) -> Result<(Priorities, Added)> {
    let _lock = write_lock();
    let (place, workspace) = reach_default_from(repo)?;
    let (priorities, added) = edits::add_and_commit(&place, section(section_id)?, line, previous)?;
    Ok((workspace.join_priorities(priorities), added))
}

/// Takes back a committed add: the entry, `lines` as written, leaves the end of its section, and
/// the removal is committed alone with `chore: remove "<short>"`. Refused as a conflict when the
/// file changed since it was read at `previous`.
pub fn undo_committed_priority(
    repo: &Path,
    lines: &[String],
    previous: &str,
) -> Result<Priorities> {
    let _lock = write_lock();
    let (place, workspace) = reach_default_from(repo)?;
    Ok(workspace.join_priorities(edits::undo_committed(&place, lines, previous)?))
}

/// Inserts a line with its nested lines, as written, before the line at `index` of a section, or
/// at its end: Undo of a removal.
pub fn insert_priority(
    repo: &Path,
    section_id: &str,
    index: u32,
    lines: &[String],
    previous: &str,
) -> Result<Priorities> {
    let _lock = write_lock();
    let (place, workspace) = reach_default_from(repo)?;
    Ok(workspace.join_priorities(edits::insert(
        &place,
        section(section_id)?,
        index as usize,
        lines,
        previous,
    )?))
}

/// Moves a line before the line at `index` of a section, or to its end.
pub fn move_priority(
    repo: &Path,
    id: &str,
    section_id: &str,
    index: u32,
    previous: &str,
) -> Result<Priorities> {
    let _lock = write_lock();
    let (place, workspace) = reach_default_from(repo)?;
    Ok(workspace.join_priorities(edits::move_entry(
        &place,
        id,
        section(section_id)?,
        index as usize,
        previous,
    )?))
}

/// Replaces a line's text.
pub fn edit_priority(repo: &Path, id: &str, line: &str, previous: &str) -> Result<Priorities> {
    let _lock = write_lock();
    let (place, workspace) = reach_default_from(repo)?;
    Ok(workspace.join_priorities(edits::edit(&place, id, line, previous)?))
}

/// Removes a line and its nested lines.
pub fn remove_priority(repo: &Path, id: &str, previous: &str) -> Result<Priorities> {
    let _lock = write_lock();
    let (place, workspace) = reach_default_from(repo)?;
    Ok(workspace.join_priorities(edits::remove(&place, id, previous)?))
}

/// Commits the commit bar's changes, the priorities' and the inbox's, as
/// [`commit_changes`](super::commit_changes) does.
pub fn commit_priorities(repo: &Path) -> Result<Priorities> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    changes::commit(&place)?;
    joined(repo, edits::read(&place))
}

/// Restores the committed priorities and inbox, and takes the notes back out of drafts, as
/// [`discard_changes`](super::discard_changes) does.
pub fn discard_priorities(repo: &Path) -> Result<Priorities> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    changes::discard(&place)?;
    // A discard deletes the drafts never committed: the workspace is read after it.
    joined(repo, edits::read(&place))
}
