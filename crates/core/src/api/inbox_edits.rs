//! The edits of the inbox, each written on the default branch and returning the inbox with the
//! count of the commit bar's changes; the moves of notes out of it; and the commit bar's Commit
//! and Discard.

use std::path::Path;

use super::priority_edits::{change_count, section};
use super::{Result, on_default, open, reach_default, refused, write_lock};
use crate::actions::changes;
use crate::actions::inbox::{self as edits, Marks};
use crate::files::inbox::Inbox;
use crate::workspace::folder_slug;

/// The inbox, with the count of the commit bar's changes and the triage's status, without
/// creating a worktree.
pub fn read_inbox(repo: &Path) -> Result<Inbox> {
    let (git, workspace) = open(repo)?;
    let (text, _) = on_default(&git, &workspace, edits::PATH);
    let (triage, _) = on_default(&git, &workspace, edits::TRIAGE);
    Ok(edits::of(
        &text.unwrap_or_default(),
        triage.as_deref(),
        change_count(&git, &workspace),
    ))
}

/// The marks of a note added from the web UI: `about` is the folder of the feature or bug the
/// note is about, written as its slug. One that is not a dated folder is refused here, and a slug
/// that would not parse back as a mark is refused by the action.
fn marks(about: Option<String>) -> Result<Marks> {
    let about = about
        .map(|folder| {
            folder_slug(&folder)
                .map(String::from)
                .ok_or_else(|| refused(format!("no feature {folder}")))
        })
        .transpose()?;
    Ok(Marks {
        agent: false,
        about,
    })
}

/// Adds a note at the end of a category, or of the notes without one, marked with the slug of
/// the folder `about`.
pub fn add_note(
    repo: &Path,
    category: Option<String>,
    about: Option<String>,
    text: &str,
    previous: &str,
) -> Result<Inbox> {
    let marks = marks(about)?;
    let _lock = write_lock();
    let place = reach_default(repo)?;
    let (inbox, _) = edits::add(&place, category.as_deref(), &marks, text, Some(previous))?;
    Ok(inbox)
}

/// Adds a note as [`add_note`] does, over the inbox as it is now, without a hash, as `ura note`
/// does, and gives the note's line, from 1: what the editor opens at.
pub fn add_note_at(
    repo: &Path,
    category: Option<String>,
    about: Option<String>,
    text: &str,
) -> Result<(Inbox, u32)> {
    let marks = marks(about)?;
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::add(&place, category.as_deref(), &marks, text, None)?)
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

/// Moves a note to the end of a section of the priorities, over both files as read at `previous`
/// and `priorities_previous`.
pub fn note_to_priorities(
    repo: &Path,
    id: &str,
    section_id: &str,
    previous: &str,
    priorities_previous: &str,
) -> Result<()> {
    let section = section(section_id)?;
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::to_priorities(
        &place,
        id,
        section,
        previous,
        priorities_previous,
    )?)
}

/// Makes a note a new draft, linked from the end of a section of the priorities. Returns the
/// draft's path, from the top level.
pub fn note_to_new_draft(
    repo: &Path,
    id: &str,
    section_id: &str,
    previous: &str,
    priorities_previous: &str,
) -> Result<String> {
    let section = section(section_id)?;
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::to_new_draft(
        &place,
        id,
        section,
        previous,
        priorities_previous,
    )?)
}

/// Adds a note at the end of the `## What` of the draft at `draft`, from the top level.
pub fn note_to_draft(repo: &Path, id: &str, draft: &str, previous: &str) -> Result<()> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::to_draft(&place, id, draft, previous)?)
}

/// Adds a note as a new draft written from its text, linked from the end of a category. Returns
/// the draft's path, from the top level.
pub fn add_note_as_draft(
    repo: &Path,
    category: Option<String>,
    about: Option<String>,
    text: &str,
    previous: &str,
) -> Result<String> {
    let marks = marks(about)?;
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::add_as_draft(
        &place,
        category.as_deref(),
        &marks,
        text,
        Some(previous),
    )?)
}

/// Commits the commit bar's changes: `INBOX.md`, `PRIORITIES.md`, and the drafts notes went into.
pub fn commit_changes(repo: &Path) -> Result<()> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    changes::commit(&place)?;
    Ok(())
}

/// Restores the committed `INBOX.md` and `PRIORITIES.md`, and takes the notes back out of drafts,
/// keeping any text the human typed: see [`changes::discard`].
pub fn discard_changes(repo: &Path) -> Result<()> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    changes::discard(&place)?;
    Ok(())
}
