//! Editing `INBOX.md` on the default branch: each edit written at once over the version it was
//! read at, as the priorities are, and the moves of notes into the priorities and proposal files.

use std::fs;

use crate::files::document::hash;
use crate::files::frontmatter;
use crate::files::inbox::{self, Inbox};

use super::commit::Added;
use super::default_round::DefaultRound;
use super::place::Place;
use super::{ActionError, Change, Committed, STALE, changes, commit};

mod categories;
mod image;
mod moves;
mod note_file;
mod undo;
mod unlink;

pub use categories::{add_category, remove_category, rename_category, restore_category};
pub use image::{NoteImage, add_with_image, attach_to_note, with_images};
pub use moves::{into_proposal, to_proposal, to_proposal_file, under_proposal};
pub(crate) use note_file::{
    back_to_notes, committed as committed_note_file, restore as restore_note_file,
};
pub use undo::{
    undo_add, undo_as_file, undo_category, undo_committed, undo_into_proposal, undo_to_proposal,
    undo_under_proposal,
};
pub use unlink::{RemovedImage, remove_image, restore_image};

pub const PATH: &str = "specs/INBOX.md";

/// The marks a tool writes before a note's text.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Marks {
    /// Whether an agent wrote the note.
    pub agent: bool,
    /// The slug of the feature or change it is about.
    pub about: Option<String>,
}

/// A file's text: empty when it is missing, an error when it cannot be read, so that an edit
/// does not overwrite it.
fn file(place: &Place, path: &str) -> Result<String, ActionError> {
    match fs::read_to_string(place.root.join(path)) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        result => Ok(result?),
    }
}

fn text(place: &Place) -> Result<String, ActionError> {
    file(place, PATH)
}

/// The inbox of `text`, with the status of the triage `triage`, and `changes`, the count of the
/// commit bar's change list.
fn of(text: &str, triage: Option<&str>, changes: u32) -> Inbox {
    let status = triage
        .and_then(|triage| frontmatter::parse(triage).ok())
        .and_then(|front| front.text("status").map(String::from));
    Inbox {
        changes,
        triage: status,
        ..inbox::read(text)
    }
}

/// The inbox of `text`, with `changes`, the count of the commit bar's change list, and the triage's
/// status and the notes' images from the files `file` reads, by their paths from the top level:
/// the one way the inbox is read, from a checkout or from the default branch.
pub fn assembled(text: &str, changes: u32, file: impl Fn(&str) -> Option<String>) -> Inbox {
    let triage = file(DefaultRound::Triage.path());
    with_images(of(text, triage.as_deref(), changes), file)
}

fn read_text(place: &Place, written: &str) -> Inbox {
    assembled(written, changes::list(place).count, |path| {
        fs::read_to_string(place.root.join(path)).ok()
    })
}

/// The inbox, with its changes since the last commit and the triage's status. A file that cannot
/// be read shows as empty.
pub fn read(place: &Place) -> Inbox {
    read_text(place, &text(place).unwrap_or_default())
}

/// Applies an edit over the version read at `previous`, or over the file as it is without one,
/// and returns the inbox as it wrote it.
fn apply(
    place: &Place,
    previous: Option<&str>,
    edit: impl FnOnce(&str) -> Option<String>,
    refused: &str,
) -> Result<Inbox, ActionError> {
    let current = text(place)?;
    if previous.is_some_and(|previous| hash(&current) != previous) {
        return Err(ActionError::Refused(format!("INBOX.md {STALE}")));
    }
    let edited = edit(&current).ok_or_else(|| ActionError::Refused(refused.to_string()))?;
    fs::write(place.root.join(PATH), &edited)?;
    Ok(read_text(place, &edited))
}

const NO_TEXT: &str = "A note needs text.";

/// Refuses a blank note, and a mark that would not parse back as one: checked by every add, and
/// by `ura note` before it reaches the default branch.
pub fn checked_note(marks: &Marks, text: &str) -> Result<(), ActionError> {
    if text.trim().is_empty() {
        return Err(ActionError::Refused(NO_TEXT.to_string()));
    }
    if let Some(about) = marks
        .about
        .as_deref()
        .filter(|about| !inbox::is_slug(about))
    {
        return Err(ActionError::Refused(format!(
            "{about} is not a slug: lowercase letters, digits, and -"
        )));
    }
    Ok(())
}

/// Adds a note at the end of a category, or of the notes without one, creating the file or the
/// category when missing, and gives the inbox and the note's line, from 1. `previous` is `None`
/// when nothing was read before, as from the CLI.
pub fn add(
    place: &Place,
    category: Option<&str>,
    marks: &Marks,
    text: &str,
    previous: Option<&str>,
) -> Result<(Inbox, u32), ActionError> {
    checked_note(marks, text)?;
    let line = inbox::note_line(marks.agent, marks.about.as_deref(), text);
    let mut at = 0;
    let edit = |current: &str| {
        let (edited, line) = inbox::add(current, category, &line);
        at = line;
        Some(edited)
    };
    let inbox = apply(place, previous, edit, NO_TEXT)?;
    Ok((inbox, at))
}

/// What [`note`] did once the note was written.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Noted {
    /// Committed alone, in this commit.
    Committed(Committed),
    /// Written without committing, as asked.
    Written,
    /// Written without committing: `INBOX.md` had uncommitted changes, someone's work in progress.
    Uncommitted,
}

/// Adds a note, as `ura note` does, and commits `INBOX.md` alone when `commit` is set and the file
/// had no uncommitted change. Other staged files stay staged, out of the commit.
pub fn note(
    place: &Place,
    category: Option<&str>,
    marks: &Marks,
    text: &str,
    commit: bool,
) -> Result<Noted, ActionError> {
    checked_note(marks, text)?;
    let clean = commit::is_clean(place, PATH);
    add(place, category, marks, text, None)?;
    match (commit, clean) {
        (false, _) => return Ok(Noted::Written),
        (true, false) => return Ok(Noted::Uncommitted),
        (true, true) => {}
    }
    commit::commit_only(
        place,
        &Change {
            paths: vec![PATH.to_string()],
            subject: added_subject(text),
            body: None,
        },
    )
    .map(Noted::Committed)
}

/// The subject of a note's add committed alone.
fn added_subject(text: &str) -> String {
    format!(
        "chore: add \"{}\" to the inbox",
        super::priorities::short(&crate::files::lines::one_line(text))
    )
}

/// Adds a note over the inbox read at `previous`, then commits `INBOX.md` alone when it had no
/// other change: "Add and commit".
pub fn add_and_commit(
    place: &Place,
    category: Option<&str>,
    marks: &Marks,
    text: &str,
    previous: &str,
) -> Result<(Inbox, Added), ActionError> {
    let (_, added) = commit::add_alone(place, PATH, &[], added_subject(text), || {
        add(place, category, marks, text, Some(previous))
    })?;
    Ok((read(place), added))
}

/// Removes a note over the inbox read at `previous`, then commits `INBOX.md` alone, when it had no
/// other change: a note started as a change leaves the inbox in its own commit. Its note file goes
/// too, in the same commit, when it holds what the note wrote or is committed, which the history
/// keeps: an uncommitted file typed in stays.
pub fn remove_and_commit(
    place: &Place,
    id: &str,
    previous: &str,
) -> Result<(Inbox, Added), ActionError> {
    let note = inbox::note(&current(place, PATH, previous)?, id).ok_or_else(|| no_note(id))?;
    let subject = format!(
        "chore: remove \"{}\" from the inbox",
        super::priorities::short(&note.text)
    );
    let also = note
        .file()
        .map(|file| note_file::committed(place, &file))
        .unwrap_or_default();
    let (_, added) = commit::add_alone(place, PATH, &also, subject, || {
        remove_with(place, id, Some(previous), note_file::Lost::NothingCommitted)
    })?;
    Ok((read(place), added))
}

/// Replaces a note's text, its marks and sub-items kept.
pub fn edit(
    place: &Place,
    id: &str,
    text: &str,
    previous: Option<&str>,
) -> Result<Inbox, ActionError> {
    if text.trim().is_empty() {
        return Err(ActionError::Refused(NO_TEXT.to_string()));
    }
    apply(
        place,
        previous,
        |current| inbox::edit(current, id, text),
        &format!("no note {id}"),
    )
}

/// Edits the outline of a note: the note, or with `at`, the item at `at` of its nested items in the
/// order of the file (see [`inbox::outline`]).
pub fn outline(
    place: &Place,
    id: &str,
    at: Option<usize>,
    change: &crate::files::nested::OutlineEdit,
    previous: Option<&str>,
) -> Result<Inbox, ActionError> {
    apply(
        place,
        previous,
        |current| inbox::outline(current, id, at, change),
        &format!("no note {id}, no such item, nowhere to go, or code under it"),
    )
}

/// Moves a note, or with `at` its nested item at `at`, its own items with it, to `to`: a drop (see
/// [`inbox::drop_item`]).
pub fn drop_item(
    place: &Place,
    id: &str,
    at: Option<usize>,
    to: &inbox::Drop,
    previous: Option<&str>,
) -> Result<Inbox, ActionError> {
    apply(
        place,
        previous,
        |current| inbox::drop_item(current, id, at, to),
        &format!("no note {id}, no such item or place, or code under it"),
    )
}

/// Removes a note, sub-items included, and its note file, held for the removal's Undo, when
/// nothing is lost: the file holds only what the note wrote, or is as the default branch committed
/// it. A file typed in since, or one another note links too, stays.
pub fn remove(place: &Place, id: &str, previous: Option<&str>) -> Result<Inbox, ActionError> {
    remove_with(place, id, previous, note_file::Lost::Nothing)
}

/// Removes a note as [`remove`] does, deleting its note file when `lost` allows it.
fn remove_with(
    place: &Place,
    id: &str,
    previous: Option<&str>,
    lost: note_file::Lost,
) -> Result<Inbox, ActionError> {
    let before = text(place)?;
    let mut after = String::new();
    let inbox = apply(
        place,
        previous,
        |current| {
            let edited = inbox::remove(current, id)?;
            edited.clone_into(&mut after);
            Some(edited)
        },
        &format!("no note {id}"),
    )?;
    if note_file::remove_left(place, &before, &after, lost)? {
        return Ok(read(place));
    }
    Ok(inbox)
}

/// Moves a note to the end of a category, or of the notes without one.
pub fn category(
    place: &Place,
    id: &str,
    category: Option<&str>,
    previous: Option<&str>,
) -> Result<Inbox, ActionError> {
    apply(
        place,
        previous,
        |current| inbox::move_to(current, id, category),
        &format!("no note {id}"),
    )
}

/// Moves a note before the note at `index` of a category, or of the notes without one, or to its
/// end: a drag's drop. `index` counts the category's notes once the note has left it.
pub fn place(
    place: &Place,
    id: &str,
    category: Option<&str>,
    index: usize,
    previous: Option<&str>,
) -> Result<Inbox, ActionError> {
    apply(
        place,
        previous,
        |current| inbox::place(current, id, category, index),
        &format!("no note {id}"),
    )
}

/// Inserts a note's lines, as written, before the note at `index` of a category, or at its end:
/// Undo of a removal, which writes back the note file the removal took away, as it was.
pub fn insert(
    place: &Place,
    category: Option<&str>,
    index: usize,
    lines: &[String],
    previous: Option<&str>,
) -> Result<Inbox, ActionError> {
    let inbox = apply(
        place,
        previous,
        |current| inbox::insert(current, category, index, lines),
        "Nothing to put back.",
    )?;
    match inbox::file_of_lines(lines) {
        Some(file) if note_file::restore(place, &file)? => Ok(read(place)),
        _ => Ok(inbox),
    }
}

/// A file's text, refused when it changed since it was read at `previous`.
fn current(place: &Place, path: &str, previous: &str) -> Result<String, ActionError> {
    let text = file(place, path)?;
    if hash(&text) != previous {
        let name = path.rsplit('/').next().unwrap_or(path);
        return Err(ActionError::Refused(format!("{name} {STALE}")));
    }
    Ok(text)
}

fn no_note(id: &str) -> ActionError {
    ActionError::Refused(format!("no note {id}"))
}

/// Writes `edited` over `target`, then `inbox` over `INBOX.md`, and puts `target` back as it was
/// when the second write fails, so a note is never in neither file.
fn write_both(place: &Place, target: &str, edited: &str, inbox: &str) -> Result<(), ActionError> {
    let path = place.root.join(target);
    let before = fs::read_to_string(&path).ok();
    fs::write(&path, edited)?;
    if let Err(error) = fs::write(place.root.join(PATH), inbox) {
        let _ = match before {
            Some(before) => fs::write(&path, before),
            None => fs::remove_file(&path),
        };
        return Err(error.into());
    }
    Ok(())
}
