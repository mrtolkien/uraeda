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
        &notes_on_default(&git, &workspace),
        change_count(&git, &workspace),
        |path| on_default(&git, &workspace, path).0,
    ))
}

/// The note files of the default branch, from its checkout when it has one, else from its tip.
fn notes_on_default(git: &crate::git::Git, workspace: &crate::workspace::Workspace) -> Vec<String> {
    let Some(default) = workspace.default_branch.as_deref() else {
        return Vec::new();
    };
    if let Some(root) = super::default_branch::default_checkout(git, default) {
        return crate::files::inbox::note_paths_on_disk(&root);
    }
    git.tip(default)
        .and_then(|tip| git.list_files(tip, "specs/notes").ok())
        .unwrap_or_default()
}

/// The default branch's note files, each path with its text, as the inbox reads them: the watcher
/// tells a note file added, removed, or edited alone as a change of the inbox.
pub(crate) fn note_texts_on_default(
    git: &crate::git::Git,
    workspace: &crate::workspace::Workspace,
) -> Vec<(String, Option<String>)> {
    notes_on_default(git, workspace)
        .into_iter()
        .map(|path| {
            let text = on_default(git, workspace, &path).0;
            (path, text)
        })
        .collect()
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
    let _lock = write_lock(repo);
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
    let _lock = write_lock(repo);
    let place = reach_default(repo)?;
    Ok(edits::add_and_commit(
        &place,
        category.as_deref(),
        &marks,
        text,
        previous,
    )?)
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
    let _lock = write_lock(repo);
    let place = reach_default(repo)?;
    Ok(edits::add(&place, category.as_deref(), &marks, text, None)?)
}

/// Replaces a note's text, its marks kept.
pub fn edit_note(repo: &Path, id: &str, text: &str, previous: &str) -> Result<Inbox> {
    let _lock = write_lock(repo);
    let place = reach_default(repo)?;
    Ok(edits::edit(&place, id, text, Some(previous))?)
}

/// Removes a note, sub-items included, and its note file.
pub fn remove_note(repo: &Path, id: &str, previous: &str) -> Result<Inbox> {
    let _lock = write_lock(repo);
    let place = reach_default(repo)?;
    Ok(edits::remove(&place, id, Some(previous))?)
}

/// Removes a note as [`remove_note`] does, then commits `INBOX.md` alone, when it had no other
/// change, with `chore: remove "<note>" from the inbox`: a note started as a change.
pub fn remove_note_and_commit(repo: &Path, id: &str, previous: &str) -> Result<(Inbox, Added)> {
    let _lock = write_lock(repo);
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
    let _lock = write_lock(repo);
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
    let _lock = write_lock(repo);
    let place = reach_default(repo)?;
    Ok(edits::place(
        &place,
        id,
        category.as_deref(),
        index as usize,
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
    let _lock = write_lock(repo);
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
    let _lock = write_lock(repo);
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
    let _lock = write_lock(repo);
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
    let _lock = write_lock(repo);
    let place = reach_default(repo)?;
    Ok(edits::into_proposal(&place, id, proposal, previous)?)
}

/// Adds a note with a note file to the proposal of `PRIORITIES.md` with the id `proposal`, like
/// `later-2`, which has no file yet: the proposal gets its file, from the template, linked from its
/// line, and the note file's text goes into its `## Notes`, over both lists as read. Returns the new
/// proposal file's path.
pub fn note_into_proposal_line(
    repo: &Path,
    id: &str,
    proposal: &str,
    previous: &str,
    priorities_previous: &str,
) -> Result<String> {
    let _lock = write_lock(repo);
    let place = reach_default(repo)?;
    Ok(edits::into_proposal_line(
        &place,
        id,
        proposal,
        previous,
        priorities_previous,
    )?)
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
    let _lock = write_lock(repo);
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
    let _lock = write_lock(repo);
    let place = reach_default(repo)?;
    let file = edits::attach_to_note(&place, id, &images, previous)?;
    Ok((edits::read(&place), file))
}

/// Commits the commit bar's changes: `INBOX.md`, `PRIORITIES.md`, and the files notes went into,
/// moved, or left.
pub fn commit_changes(repo: &Path) -> Result<()> {
    let _lock = write_lock(repo);
    let place = reach_default(repo)?;
    changes::commit(&place)?;
    Ok(())
}

/// Restores the committed `INBOX.md` and `PRIORITIES.md`, and takes the notes back out of proposal
/// files, keeping any text the human typed: see [`changes::discard`].
pub fn discard_changes(repo: &Path) -> Result<()> {
    let _lock = write_lock(repo);
    let place = reach_default(repo)?;
    changes::discard(&place)?;
    Ok(())
}

/// The images of proposal files and of note files that no markdown file of their folder links, from
/// the top level, in order: deleted unless `dry_run`, with the `images/` folders they leave empty,
/// on the default branch, uncommitted.
pub fn clean_images(repo: &Path, dry_run: bool) -> Result<Vec<String>> {
    let _lock = write_lock(repo);
    let place = reach_default(repo)?;
    if dry_run {
        return Ok(crate::actions::images::unlinked_in_proposals_and_notes(
            &place.root,
        ));
    }
    Ok(crate::actions::images::delete_unlinked_in_proposals_and_notes(&place.root)?)
}
