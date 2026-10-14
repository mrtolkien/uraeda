//! The edits of the priorities, each written on the default branch and returning the priorities
//! with their changes since the last commit.

use std::path::Path;

use super::{Result, reach_default, refused, write_lock};
use crate::actions::priorities as edits;
use crate::files::priorities::{Priorities, Section};

fn section(id: &str) -> Result<Section> {
    Section::from_id(id).ok_or_else(|| refused(format!("no section {id}")))
}

/// Adds a line at the end of a section.
pub fn add_priority(
    repo: &Path,
    section_id: &str,
    line: &str,
    previous: &str,
) -> Result<Priorities> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::add(&place, section(section_id)?, line, previous)?)
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
    let place = reach_default(repo)?;
    Ok(edits::insert(
        &place,
        section(section_id)?,
        index as usize,
        lines,
        previous,
    )?)
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
    let place = reach_default(repo)?;
    Ok(edits::move_entry(
        &place,
        id,
        section(section_id)?,
        index as usize,
        previous,
    )?)
}

/// Replaces a line's text.
pub fn edit_priority(repo: &Path, id: &str, line: &str, previous: &str) -> Result<Priorities> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::edit(&place, id, line, previous)?)
}

/// Removes a line and its nested lines.
pub fn remove_priority(repo: &Path, id: &str, previous: &str) -> Result<Priorities> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::remove(&place, id, previous)?)
}

/// Commits the priorities alone.
pub fn commit_priorities(repo: &Path) -> Result<Priorities> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    edits::commit(&place)?;
    Ok(edits::read(&place))
}

/// Restores the committed priorities.
pub fn discard_priorities(repo: &Path) -> Result<Priorities> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    edits::discard(&place)?;
    Ok(edits::read(&place))
}
