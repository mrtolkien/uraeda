//! The edits of the inbox, each written on the default branch and returning the inbox with the
//! count of the commit bar's changes; the moves of notes out of it; and the commit bar's Commit
//! and Discard.

use std::path::Path;

use super::outlines::note_stays;
use super::proposal_edits::{change_count, section};
use super::{Result, on_default, open, reach_default, write_lock};
use crate::actions::changes;
use crate::actions::commit::Added;
use crate::actions::inbox::{self as edits, Marks};
use crate::files::inbox::Inbox;
use crate::workspace::folder_slug;

/// The inbox, with the count of the commit bar's changes and the triage's status, without
/// creating a worktree.
pub fn read_inbox(repo: &Path) -> Result<Inbox> {
    let (git, workspace) = open(repo)?;
    let (text, _) = on_default(&git, &workspace, edits::PATH);
    Ok(edits::assembled(
        &text.unwrap_or_default(),
        change_count(&git, &workspace),
        |path| on_default(&git, &workspace, path).0,
    ))
}

/// The marks of a note added from the web UI: `about` is the folder of the page it was added from,
/// written as its slug when it is a feature's or a change's, a dated folder; any other marks
/// nothing. A slug that would not parse back as a mark is refused by the action.
fn marks(about: Option<String>) -> Marks {
    Marks {
        agent: false,
        about: about.and_then(|folder| folder_slug(&folder).map(String::from)),
    }
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
    let marks = marks(about);
    let _lock = write_lock();
    let place = reach_default(repo)?;
    let (inbox, _) = edits::add(&place, category.as_deref(), &marks, text, Some(previous))?;
    Ok(inbox)
}

/// Adds a note as [`add_note`] does, then commits `INBOX.md` alone, when it had no other change,
/// with `chore: add "<note>" to the inbox`.
pub fn add_note_and_commit(
    repo: &Path,
    category: Option<String>,
    about: Option<String>,
    text: &str,
    previous: &str,
) -> Result<(Inbox, Added)> {
    let marks = marks(about);
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::add_and_commit(
        &place,
        category.as_deref(),
        &marks,
        text,
        previous,
    )?)
}

/// Takes back a committed add: the note, `lines` as written, leaves the inbox, and the removal is
/// committed alone with `chore: remove "<note>" from the inbox`. Refused as a conflict when the
/// inbox changed since it was read at `previous`.
pub fn undo_committed_note(repo: &Path, lines: &[String], previous: &str) -> Result<Inbox> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    edits::undo_committed(&place, lines, previous)?;
    Ok(edits::read(&place))
}

/// Adds a note as [`add_note`] does, over the inbox as it is now, without a hash, as `ura note`
/// does, and gives the note's line, from 1: what the editor opens at.
pub fn add_note_at(
    repo: &Path,
    category: Option<String>,
    about: Option<String>,
    text: &str,
) -> Result<(Inbox, u32)> {
    let marks = marks(about);
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

/// Removes a note, sub-items included, and its note file, which [`insert_note`] brings back.
pub fn remove_note(repo: &Path, id: &str, previous: &str) -> Result<Inbox> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::remove(&place, id, Some(previous))?)
}

/// Removes a note as [`remove_note`] does, then commits `INBOX.md` alone, when it had no other
/// change, with `chore: remove "<note>" from the inbox`: a note started as a change.
pub fn remove_note_and_commit(repo: &Path, id: &str, previous: &str) -> Result<(Inbox, Added)> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::remove_and_commit(&place, id, previous)?)
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

/// Moves a note before the note at `index` of a category, or of the notes without one, or to its
/// end, `index` counting the category's notes once the note has left it.
pub fn place_note(
    repo: &Path,
    id: &str,
    category: Option<String>,
    index: u32,
    previous: &str,
) -> Result<Inbox> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::place(
        &place,
        id,
        category.as_deref(),
        index as usize,
        Some(previous),
    )?)
}

/// Inserts a note's lines, as written, before the note at `index` of a category, or at its end:
/// Undo of a removal, with the note file the removal took away, as it was.
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
pub fn note_to_proposal(
    repo: &Path,
    id: &str,
    section_id: &str,
    previous: &str,
    priorities_previous: &str,
) -> Result<()> {
    let section = section(section_id)?;
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::to_proposal(
        &place,
        id,
        section,
        previous,
        priorities_previous,
    )?)
}

/// Moves a note under the proposal `proposal` of the priorities, `now-2`, as its last item, over
/// both files as read at `previous` and `priorities_previous`. A note with a note file is refused:
/// nested, its file would no longer be found by its link.
pub fn note_under_proposal(
    repo: &Path,
    id: &str,
    proposal: &str,
    previous: &str,
    priorities_previous: &str,
) -> Result<()> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    note_stays(&place, id, previous)?;
    Ok(edits::under_proposal(
        &place,
        id,
        proposal,
        previous,
        priorities_previous,
    )?)
}

/// Makes a note a new proposal file, linked from the end of a section of the priorities, or moves
/// its note file among the proposals. Returns the proposal file's path, from the top level.
pub fn note_to_proposal_file(
    repo: &Path,
    id: &str,
    section_id: &str,
    previous: &str,
    priorities_previous: &str,
) -> Result<String> {
    let section = section(section_id)?;
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::to_proposal_file(
        &place,
        id,
        section,
        previous,
        priorities_previous,
    )?)
}

/// Adds a note to the proposal file at `proposal`, from the top level: its lines at the end of the
/// file's `## What`, or, for a note with a note file, the note file's text at the end of its
/// `## Notes`, its images beside it. Returns the proposal file's path, which a single proposal file
/// made a folder for the images changes.
pub fn note_into_proposal(repo: &Path, id: &str, proposal: &str, previous: &str) -> Result<String> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    Ok(edits::into_proposal(&place, id, proposal, previous)?)
}

/// An image sent with a note: its bytes, and its original file name, `None` for a pasted image.
pub type NoteImage = (Vec<u8>, Option<String>);

/// Checks and encodes the images first, so that a refused one writes nothing.
fn encoded(images: &[NoteImage]) -> Result<Vec<edits::NoteImage>> {
    images
        .iter()
        .map(|(bytes, name)| {
            let encoded = super::encode_image(bytes, name.as_deref().unwrap_or("pasted image"))?;
            Ok((encoded, name.clone()))
        })
        .collect()
}

/// Adds a note as a new note file's folder, `specs/notes/<slug>/note.md`, holding its text and the
/// `images`, linked from the end of a category: all written or none. The images are checked and
/// encoded first, so a refused one writes nothing. Returns the inbox and the note file's path, from
/// the top level.
pub fn add_note_with_images(
    repo: &Path,
    category: Option<String>,
    about: Option<String>,
    text: &str,
    images: &[NoteImage],
    previous: &str,
) -> Result<(Inbox, String)> {
    let marks = marks(about);
    edits::checked_note(&marks, text)?;
    let images = encoded(images)?;
    let _lock = write_lock();
    let place = reach_default(repo)?;
    let file = edits::add_with_image(&place, category.as_deref(), &marks, text, &images, previous)?;
    Ok((edits::read(&place), file))
}

/// Adds `images` to the note `id`: into its note file, or into the note file it gets, linked from
/// the note's own place. The images are checked and encoded first. Returns the inbox and the note
/// file's path, from the top level.
pub fn attach_note_images(
    repo: &Path,
    id: &str,
    images: &[NoteImage],
    previous: &str,
) -> Result<(Inbox, String)> {
    let images = encoded(images)?;
    let _lock = write_lock();
    let place = reach_default(repo)?;
    let file = edits::attach_to_note(&place, id, &images, previous)?;
    Ok((edits::read(&place), file))
}

/// Commits the commit bar's changes: `INBOX.md`, `PRIORITIES.md`, and the files notes went into,
/// moved, or left.
pub fn commit_changes(repo: &Path) -> Result<()> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    changes::commit(&place)?;
    Ok(())
}

/// Restores the committed `INBOX.md` and `PRIORITIES.md`, and takes the notes back out of proposal
/// files, keeping any text the human typed: see [`changes::discard`].
pub fn discard_changes(repo: &Path) -> Result<()> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    changes::discard(&place)?;
    Ok(())
}

/// Takes back a note's move to a section of the priorities, in one write of both files or none:
/// the line the move wrote leaves the section, found by the note's lines and, among several of
/// them, by `proposal_key`, the key it had once moved; the note, `lines` as written, goes back
/// before the note at `index` of its category, over the inbox as it is now, and its note file,
/// moved among the proposals, back among the notes.
pub fn undo_note_to_proposal(
    repo: &Path,
    lines: &[String],
    category: Option<String>,
    index: u32,
    section_id: &str,
    proposal_key: Option<String>,
) -> Result<Inbox> {
    let section = section(section_id)?;
    let _lock = write_lock();
    let place = reach_default(repo)?;
    edits::undo_to_proposal(
        &place,
        lines,
        category.as_deref(),
        index as usize,
        section,
        proposal_key.as_deref(),
    )?;
    Ok(edits::read(&place))
}

/// Takes back a note's move under a proposal of the priorities, in one write of both files or none:
/// the item the move wrote leaves the proposal whose key is `proposal_key`, and the note, `lines`
/// as written, goes back before the note at `index` of its category, over the inbox as it is now.
pub fn undo_note_under_proposal(
    repo: &Path,
    lines: &[String],
    category: Option<String>,
    index: u32,
    proposal_key: &str,
) -> Result<Inbox> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    edits::undo_under_proposal(
        &place,
        lines,
        category.as_deref(),
        index as usize,
        proposal_key,
    )?;
    Ok(edits::read(&place))
}

/// Takes back a note's add to the proposal file at `proposal`, in one write of both files or none:
/// the note's lines leave the file, every other edit kept, and the note goes back to its place.
pub fn undo_note_into_proposal(
    repo: &Path,
    proposal: &str,
    lines: &[String],
    category: Option<String>,
    index: u32,
) -> Result<Inbox> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    edits::undo_into_proposal(&place, proposal, lines, category.as_deref(), index as usize)?;
    Ok(edits::read(&place))
}

/// Takes back a note's move to another category, in one write: the note, found by its lines as
/// written, goes back before the note at `index` of `category`, or none.
pub fn undo_note_category(
    repo: &Path,
    lines: &[String],
    category: Option<String>,
    index: u32,
) -> Result<Inbox> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    edits::undo_category(&place, lines, category.as_deref(), index as usize)?;
    Ok(edits::read(&place))
}

/// Takes back a note added as a file: the note, found by its lines as written, leaves the inbox,
/// and its note file goes with it, image included, unless a commit has it or the human typed in it.
pub fn undo_note_as_file(repo: &Path, lines: &[String]) -> Result<Inbox> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    edits::undo_as_file(&place, lines)?;
    Ok(edits::read(&place))
}

/// Takes back a note's add: the note, found by its lines as written, leaves the inbox wherever it
/// is now. Refused once it changed or left, or when two notes hold its lines.
pub fn undo_note_add(repo: &Path, lines: &[String]) -> Result<Inbox> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    edits::undo_add(&place, lines)?;
    Ok(edits::read(&place))
}

/// The images of proposal files and of note files that no markdown file of their folder links, from
/// the top level, in order: deleted unless `dry_run`, with the `images/` folders they leave empty,
/// on the default branch, uncommitted.
pub fn clean_images(repo: &Path, dry_run: bool) -> Result<Vec<String>> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    if dry_run {
        return Ok(crate::actions::images::unlinked_in_proposals_and_notes(
            &place.root,
        ));
    }
    Ok(crate::actions::images::delete_unlinked_in_proposals_and_notes(&place.root)?)
}
