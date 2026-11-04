//! The edits of the priorities, each written on the default branch and returning the priorities
//! with their changes since the last commit.

use std::path::Path;

use super::{Result, on_default, open, reach_default, reach_default_from, refused, write_lock};
use crate::actions::commit::Added;
use crate::actions::{changes, priorities as edits};
use crate::files::priorities::{self, Priorities, Section};
use crate::git::Git;
use crate::workspace::Workspace;

pub(super) fn section(id: &str) -> Result<Section> {
    Section::from_id(id).ok_or_else(|| refused(format!("no section {id}")))
}

/// How many changes wait for a commit, every branch's.
pub(super) fn change_count(git: &Git, workspace: &Workspace) -> u32 {
    super::branch_panes::panes(git, workspace)
        .iter()
        .map(|pane| pane.count)
        .sum()
}

/// The priorities, with the count of the changes waiting for a commit, every branch's, and the default
/// branch's as lines, without creating a worktree.
pub fn read_priorities(repo: &Path) -> Result<Priorities> {
    let (git, workspace) = open(repo)?;
    let panes = super::branch_panes::panes(&git, &workspace);
    let lines = panes
        .iter()
        .find(|pane| workspace.default_branch.as_deref() == Some(pane.branch.as_str()))
        .map(|pane| pane.lines.clone())
        .unwrap_or_default();
    Ok(Priorities {
        changes: panes.iter().map(|pane| pane.count).sum(),
        change_lines: lines,
        ..joined_priorities(&git, &workspace)
    })
}

/// The default branch's priorities, each proposal with its proposal file and running feature from
/// the workspace, without the count of the commit bar's changes.
pub(crate) fn joined_priorities(git: &Git, workspace: &Workspace) -> Priorities {
    let (text, _) = on_default(git, workspace, edits::PATH);
    workspace.join_priorities(priorities::read(&text.unwrap_or_default(), None))
}

/// The priorities joined with the workspace read now.
fn joined(repo: &Path, priorities: Priorities) -> Result<Priorities> {
    Ok(open(repo)?.1.join_priorities(priorities))
}

/// Adds a line at the end of a section. Edits keep the proposal files and features: the workspace
/// read before them joins their answer.
pub fn add_proposal(
    repo: &Path,
    section_id: &str,
    line: &str,
    previous: &str,
) -> Result<Priorities> {
    let _lock = write_lock(repo);
    let (place, workspace) = reach_default_from(repo)?;
    Ok(workspace.join_priorities(edits::add(&place, section(section_id)?, line, previous)?))
}

/// Adds a line at the end of a section, as [`add_proposal`] does, then commits `PRIORITIES.md`
/// alone, when it had no other change, with `chore: add "<short>" to <Section>`.
pub fn add_proposal_and_commit(
    repo: &Path,
    section_id: &str,
    line: &str,
    previous: &str,
) -> Result<(Priorities, Added)> {
    let _lock = write_lock(repo);
    let (place, workspace) = reach_default_from(repo)?;
    let (priorities, added) = edits::add_and_commit(&place, section(section_id)?, line, previous)?;
    Ok((workspace.join_priorities(priorities), added))
}

/// Takes back a committed add: the proposal, `lines` as written, leaves the end of its section, and
/// the removal is committed alone with `chore: remove "<short>"`. Refused as a conflict when the
/// file changed since it was read at `previous`.
pub fn undo_committed_proposal(
    repo: &Path,
    lines: &[String],
    previous: &str,
) -> Result<Priorities> {
    let _lock = write_lock(repo);
    let (place, workspace) = reach_default_from(repo)?;
    Ok(workspace.join_priorities(edits::undo_committed(&place, lines, previous)?))
}

/// Inserts a line with its nested lines, as written, before the line at `index` of a section, or
/// at its end: Undo of a removal.
pub fn insert_proposal(
    repo: &Path,
    section_id: &str,
    index: u32,
    lines: &[String],
    previous: &str,
) -> Result<Priorities> {
    let _lock = write_lock(repo);
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
pub fn move_proposal(
    repo: &Path,
    id: &str,
    section_id: &str,
    index: u32,
    previous: &str,
) -> Result<Priorities> {
    let _lock = write_lock(repo);
    let (place, workspace) = reach_default_from(repo)?;
    Ok(workspace.join_priorities(edits::move_proposal(
        &place,
        id,
        section(section_id)?,
        index as usize,
        previous,
    )?))
}

/// Replaces a line's text.
pub fn edit_proposal(repo: &Path, id: &str, line: &str, previous: &str) -> Result<Priorities> {
    let _lock = write_lock(repo);
    let (place, workspace) = reach_default_from(repo)?;
    Ok(workspace.join_priorities(edits::edit(&place, id, line, previous)?))
}

/// Removes a line and its nested lines.
pub fn remove_proposal(repo: &Path, id: &str, previous: &str) -> Result<Priorities> {
    let _lock = write_lock(repo);
    let (place, workspace) = reach_default_from(repo)?;
    Ok(workspace.join_priorities(edits::remove(&place, id, previous)?))
}

/// Commits the commit bar's changes, the priorities' and the inbox's, as
/// [`commit_changes`](super::commit_changes) does.
pub fn commit_priorities(repo: &Path) -> Result<Priorities> {
    let _lock = write_lock(repo);
    let place = reach_default(repo)?;
    changes::commit(&place)?;
    joined(repo, edits::read(&place))
}

/// Restores the committed priorities and inbox, and takes the notes back out of proposal files, as
/// [`discard_changes`](super::discard_changes) does.
pub fn discard_priorities(repo: &Path) -> Result<Priorities> {
    let _lock = write_lock(repo);
    let place = reach_default(repo)?;
    changes::discard(&place)?;
    // A discard deletes the proposal files never committed: the workspace is read after it.
    joined(repo, edits::read(&place))
}
