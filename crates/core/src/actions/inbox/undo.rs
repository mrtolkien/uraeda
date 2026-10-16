//! The Undo of a note's move out of its place, each one write of both files, or none: what the
//! move wrote is taken back only while it is there as the move wrote it, and the note goes back to
//! its place over the inbox as it is now, so nothing written meanwhile is lost.

use std::fs;

use crate::files::document::hash;
use crate::files::inbox;
use crate::files::lines;
use crate::files::priorities::{self, Section};
use crate::files::proposal;

use super::super::place::{self, Place};
use super::super::{ActionError, Change, STALE, commit, draft, priorities as priority_edits};
use super::{PATH, draft_text, file, text, write_both};

/// The refusal of an Undo whose note is no longer where the move put it.
fn gone(note: &str, file: &str) -> ActionError {
    ActionError::Refused(format!(
        "Could not undo: \"{note}\" is no longer in {file}."
    ))
}

/// A note's text and its lines without its marks, from its lines as written.
fn parts(lines: &[String]) -> Result<(String, Vec<String>), ActionError> {
    inbox::of_lines(lines).ok_or_else(|| ActionError::Refused("Nothing to put back.".to_string()))
}

/// The inbox with a note's lines back before the note at `index` of its category.
fn put_back(
    current: &str,
    category: Option<&str>,
    index: usize,
    lines: &[String],
) -> Result<String, ActionError> {
    inbox::insert(current, category, index, lines)
        .ok_or_else(|| ActionError::Refused("Nothing to put back.".to_string()))
}

/// Takes back a move into a section of the priorities: the line the move wrote leaves the section,
/// and the note, `lines` as written, goes back to its place. With several lines of the note's text
/// in the section, `key`, the key the move's line had, tells which; without it, the Undo refuses.
pub fn undo_to_priorities(
    place: &Place,
    lines: &[String],
    category: Option<&str>,
    index: usize,
    section: Section,
    key: Option<&str>,
) -> Result<(), ActionError> {
    let (note, unmarked) = parts(lines)?;
    let current = text(place)?;
    let written = file(place, priority_edits::PATH)?;
    let without = priorities::remove_written(&written, section, &unmarked, key)
        .ok_or_else(|| gone(&note, "PRIORITIES.md"))?;
    let back = put_back(&current, category, index, lines)?;
    write_both(place, priority_edits::PATH, &without, &back)
}

/// Takes back an add to the draft at `draft`: the note's lines leave its `## What`, every other
/// edit kept, as Discard takes them back, and the note goes back to its place.
pub fn undo_to_draft(
    place: &Place,
    draft: &str,
    lines: &[String],
    category: Option<&str>,
    index: usize,
) -> Result<(), ActionError> {
    let (note, unmarked) = parts(lines)?;
    let current = text(place)?;
    let written = draft_text(place, draft)?;
    let name = draft.strip_prefix("specs/").unwrap_or(draft);
    let without = lines::markdown_of(&super::into_draft(&unmarked, draft))
        .and_then(|markdown| proposal::without_item(&written, &markdown))
        .ok_or_else(|| gone(&note, name))?;
    let back = put_back(&current, category, index, lines)?;
    write_both(place, draft, &without, &back)
}

/// The inbox as it is now, and the id of the one note whose lines are `lines` as written: refused
/// once the note changed or left, or when two notes hold its lines.
fn found(place: &Place, lines: &[String]) -> Result<(String, String, String), ActionError> {
    let (note, _) = parts(lines)?;
    let current = text(place)?;
    match inbox::ids_of_lines(&current, lines).as_slice() {
        [id] => Ok((note, current, id.clone())),
        _ => Err(gone(&note, "INBOX.md")),
    }
}

/// Takes back a move to another category: the note, found by its lines as written, goes back to
/// its place, in one write. Refused once it changed or left, or when two notes hold its lines.
pub fn undo_category(
    place: &Place,
    lines: &[String],
    category: Option<&str>,
    index: usize,
) -> Result<(), ActionError> {
    let (note, current, id) = found(place, lines)?;
    let without = inbox::remove(&current, &id).ok_or_else(|| gone(&note, "INBOX.md"))?;
    let back = put_back(&without, category, index, lines)?;
    fs::write(place.root.join(PATH), back)?;
    Ok(())
}

/// Takes back an add as a draft: the note, found by its lines as written, leaves the inbox, and the
/// draft it links goes with it while no commit has it and it holds what the add wrote, with at
/// most the note's image. A draft typed in is kept.
pub fn undo_as_draft(place: &Place, lines: &[String]) -> Result<(), ActionError> {
    let (note, current, id) = found(place, lines)?;
    let id = id.as_str();
    let linked = inbox::note(&current, id).and_then(|note| note.draft());
    let title = inbox::link_title(&current, id);
    let without = inbox::remove(&current, id).ok_or_else(|| gone(&note, "INBOX.md"))?;
    fs::write(place.root.join(PATH), without)?;
    if let (Some(path), Some(title)) = (linked, title)
        && place::committed(place, &path).is_none()
    {
        draft::remove_written(place, &path, &draft::from_note(&path, &title, &[]))?;
    }
    Ok(())
}

/// Takes back an add: the note, found by its lines as written, leaves the inbox wherever it is now,
/// in one write. Refused once it changed or left, or when two notes hold its lines.
pub fn undo_add(place: &Place, lines: &[String]) -> Result<(), ActionError> {
    let (note, current, id) = found(place, lines)?;
    let without = inbox::remove(&current, &id).ok_or_else(|| gone(&note, "INBOX.md"))?;
    fs::write(place.root.join(PATH), without)?;
    Ok(())
}

/// Takes back a committed add, as [`undo_add`] does, and commits the removal alone: Undo of "Add
/// and commit". Refused as stale when the inbox changed since it was read at `previous`, or since
/// its commit.
pub fn undo_committed(place: &Place, lines: &[String], previous: &str) -> Result<(), ActionError> {
    let current = text(place)?;
    if hash(&current) != previous || !commit::is_clean(place, PATH) {
        return Err(ActionError::Refused(format!("INBOX.md {STALE}")));
    }
    let (note, _) = parts(lines)?;
    undo_add(place, lines)?;
    commit::commit_only(
        place,
        &Change {
            paths: vec![PATH.to_string()],
            subject: format!(
                "chore: remove \"{}\" from the inbox",
                priority_edits::short(&note)
            ),
            body: None,
        },
    )?;
    Ok(())
}
