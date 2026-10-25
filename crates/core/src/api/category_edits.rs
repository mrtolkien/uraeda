//! The edits of the inbox's categories, each written on the default branch over the version read.

use std::path::Path;

use super::{Result, reach_default, write_lock};
use crate::actions::inbox as edits;
use crate::files::inbox::Inbox;

/// Adds a category at the end of the inbox.
pub fn add_category(repo: &Path, name: &str, previous: &str) -> Result<Inbox> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::add_category(&place, name, Some(previous))?)
}

/// Renames a category, every heading of its name.
pub fn rename_category(repo: &Path, from: &str, to: &str, previous: &str) -> Result<Inbox> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::rename_category(&place, from, to, Some(previous))?)
}

/// Deletes a category: its notes stay without a category with `keep_notes`, and go with it
/// otherwise. Gives the inbox and the file as it was, for [`restore_category`].
pub fn remove_category(
    repo: &Path,
    name: &str,
    keep_notes: bool,
    previous: &str,
) -> Result<(Inbox, String)> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::remove_category(
        &place,
        name,
        keep_notes,
        Some(previous),
    )?)
}

/// Takes back a delete: writes `before` back, only when the inbox still hashes to `previous`.
pub fn restore_category(repo: &Path, before: &str, previous: &str) -> Result<Inbox> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::restore_category(&place, before, previous)?)
}
