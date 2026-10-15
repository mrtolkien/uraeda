//! The edits of the inbox, each written on the default branch and returning the inbox with its
//! changes since the last commit.

use std::path::Path;

use super::{Result, on_default, open, reach_default, refused, write_lock};
use crate::actions::inbox::{self as edits, Marks};
use crate::files::inbox::Inbox;
use crate::workspace::folder_slug;

/// The inbox, with its changes since the last commit and the triage's status, without creating a
/// worktree.
pub fn read_inbox(repo: &Path) -> Result<Inbox> {
    let (git, workspace) = open(repo)?;
    let (text, committed) = on_default(&git, &workspace, edits::PATH);
    let (triage, _) = on_default(&git, &workspace, edits::TRIAGE);
    Ok(edits::of(
        &text.unwrap_or_default(),
        committed.as_deref(),
        triage.as_deref(),
    ))
}

/// Adds a note at the end of a category, or of the notes without one. `about` is the folder of
/// the feature or bug the note is about, written as its slug: one that is not a dated folder is
/// refused here, and a slug that would not parse back as a mark is refused by `edits::add`.
pub fn add_note(
    repo: &Path,
    category: Option<String>,
    about: Option<String>,
    text: &str,
    previous: &str,
) -> Result<Inbox> {
    let about = about
        .map(|folder| {
            folder_slug(&folder)
                .map(String::from)
                .ok_or_else(|| refused(format!("no feature {folder}")))
        })
        .transpose()?;
    let marks = Marks {
        agent: false,
        about,
    };
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::add(
        &place,
        category.as_deref(),
        &marks,
        text,
        Some(previous),
    )?)
}

/// Replaces a note's text, its marks kept.
pub fn edit_note(repo: &Path, id: &str, text: &str, previous: &str) -> Result<Inbox> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::edit(&place, id, text, Some(previous))?)
}

/// Removes a note, sub-items included.
pub fn remove_note(repo: &Path, id: &str, previous: &str) -> Result<Inbox> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::remove(&place, id, Some(previous))?)
}

/// Moves a note to the end of a category, or of the notes without one.
pub fn move_note_to_category(
    repo: &Path,
    id: &str,
    category: Option<String>,
    previous: &str,
) -> Result<Inbox> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::category(
        &place,
        id,
        category.as_deref(),
        Some(previous),
    )?)
}

/// Inserts a note's lines, as written, before the note at `index` of a category, or at its end:
/// Undo of a removal.
pub fn insert_note(
    repo: &Path,
    category: Option<String>,
    index: u32,
    lines: &[String],
    previous: &str,
) -> Result<Inbox> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::insert(
        &place,
        category.as_deref(),
        index as usize,
        lines,
        Some(previous),
    )?)
}
