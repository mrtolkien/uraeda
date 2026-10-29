//! The moves of notes out of the inbox: into a section of the priorities, under a proposal, into a
//! new proposal file, or into an existing one. A note's file moves with it to the proposals, or,
//! into an existing proposal file, goes into its text.

use std::fs;

use crate::files::inbox;
use crate::files::priorities::{self, Section};
use crate::files::proposal;
use crate::files::retarget;

use super::super::ActionError;
use super::super::expand;
use super::super::place::Place;
use super::super::priorities::PATH as PRIORITIES;
use super::{PATH, current, merge, no_note, note_file, write_both};

/// The inbox and the priorities, each refused when it changed since it was read.
fn both(
    place: &Place,
    previous: &str,
    priorities_previous: &str,
) -> Result<(String, String), ActionError> {
    let inbox = current(place, PATH, previous)?;
    let priorities = current(place, PRIORITIES, priorities_previous)?;
    Ok((inbox, priorities))
}

/// The note file of the note `note` of the inbox text `inbox` that a move takes along: one on disk
/// that no other note links. A file another note links too stays for it, and the note moves as
/// text, as one whose file the disk lacks.
fn movable(place: &Place, inbox: &str, note: &inbox::Note) -> Option<String> {
    let file = note.file().filter(|file| place.root.join(file).is_file())?;
    let shared = inbox::parse(inbox)
        .iter()
        .any(|other| other.id != note.id && other.file().as_deref() == Some(file.as_str()));
    (!shared).then_some(file)
}

/// Moves the note `id`'s lines, without its marks, into `PRIORITIES.md`, the file `target`,
/// written by `edit` from the lines: its note file, when a move takes it along,
/// moves among the proposals first, and its link follows it. Returns the note's file, as a
/// proposal file now. Both files are written, or none, and the file moves back when they are not.
fn move_out(
    place: &Place,
    inbox: &str,
    id: &str,
    target: &str,
    edit: impl Fn(&[String]) -> Option<String>,
) -> Result<Option<String>, ActionError> {
    let note = inbox::note(inbox, id).ok_or_else(|| no_note(id))?;
    let (lines, _) = inbox::unmarked_lines(inbox, id).ok_or_else(|| no_note(id))?;
    let without = inbox::remove(inbox, id).ok_or_else(|| no_note(id))?;
    let Some(file) = movable(place, inbox, &note) else {
        return finish(place, target, &without, edit(&lines), None, id);
    };
    // Checked before the file moves: nothing is written when the target refuses the lines.
    edit(&lines).ok_or_else(|| no_note(id))?;
    let title = inbox::link_title(inbox, id).unwrap_or_else(|| note.text.clone());
    let to = note_file::to_proposals(place, &file, &title)?;
    let lines: Vec<String> = retarget::moved(&lines.join("\n"), &file, &to)
        .split('\n')
        .map(String::from)
        .collect();
    finish(place, target, &without, edit(&lines), Some((file, to)), id)
}

/// Writes `edited` over `target` and the inbox `without` the note `id`, or moves the note's file,
/// moved from and to `moved`, back when they cannot be written.
fn finish(
    place: &Place,
    target: &str,
    without: &str,
    edited: Option<String>,
    moved: Option<(String, String)>,
    id: &str,
) -> Result<Option<String>, ActionError> {
    let written = edited
        .ok_or_else(|| no_note(id))
        .and_then(|edited| write_both(place, target, &edited, without));
    if let Err(error) = written {
        if let Some((from, to)) = &moved {
            let _ = note_file::back_to_notes(place, to, from);
        }
        return Err(error);
    }
    Ok(moved.map(|(_, to)| to))
}

/// Moves a note's lines, without its marks, to the end of a section of `PRIORITIES.md`: a note
/// with a note file moves it among the proposals, its link rewritten. Both files are checked
/// against the versions read before either is written.
pub fn to_proposal(
    place: &Place,
    id: &str,
    section: Section,
    previous: &str,
    priorities_previous: &str,
) -> Result<(), ActionError> {
    let (inbox, priorities) = both(place, previous, priorities_previous)?;
    move_out(place, &inbox, id, PRIORITIES, |lines| {
        priorities::insert_proposal(&priorities, section, usize::MAX, lines)
    })?;
    Ok(())
}

/// Moves a note's lines, without its marks, its nested items with them, under the proposal
/// `proposal` of `PRIORITIES.md`, as its last item. Both files are checked against the versions
/// read before either is written.
pub fn under_proposal(
    place: &Place,
    id: &str,
    proposal: &str,
    previous: &str,
    priorities_previous: &str,
) -> Result<(), ActionError> {
    let (inbox, priorities) = both(place, previous, priorities_previous)?;
    let (lines, _) = inbox::unmarked_lines(&inbox, id).ok_or_else(|| no_note(id))?;
    let edited = priorities::append_under(&priorities, proposal, &lines).ok_or_else(|| {
        ActionError::Refused(format!("no proposal {proposal} to put the note under"))
    })?;
    let without = inbox::remove(&inbox, id).ok_or_else(|| no_note(id))?;
    write_both(place, PRIORITIES, &edited, &without)
}

/// Makes a note a new proposal file, `specs/proposals/<slug>.md` or the next free name, linked
/// from the end of a section of `PRIORITIES.md`, and returns its path. A note with a note file
/// moves it among the proposals instead; one linking a proposal file, or a note file gone from the
/// disk or that another note links too, is refused.
pub fn to_proposal_file(
    place: &Place,
    id: &str,
    section: Section,
    previous: &str,
    priorities_previous: &str,
) -> Result<String, ActionError> {
    let (inbox, priorities) = both(place, previous, priorities_previous)?;
    let note = inbox::note(&inbox, id).ok_or_else(|| no_note(id))?;
    if movable(place, &inbox, &note).is_some() {
        let insert =
            |lines: &[String]| priorities::insert_proposal(&priorities, section, usize::MAX, lines);
        let moved = move_out(place, &inbox, id, PRIORITIES, insert)?;
        return moved.ok_or_else(|| no_note(id));
    }
    let linked = note
        .link
        .as_deref()
        .and_then(|link| crate::workspace::resolve("specs", link))
        .filter(|path| crate::target::is_linked_file(path));
    if let Some(linked) = linked {
        return Err(ActionError::Refused(format!(
            "{} already links {linked}",
            note.text
        )));
    }
    let (title, nested) = inbox::note_file_parts(&inbox, id).ok_or_else(|| no_note(id))?;
    let path = expand::free_path(place, &note.text);
    let line = format!(
        "- {}",
        inbox::link_to(&title, path.trim_start_matches("specs/"))
    );
    let edited = priorities::insert_proposal(&priorities, section, usize::MAX, &[line])
        .ok_or_else(|| no_note(id))?;
    let without = inbox::remove(&inbox, id).ok_or_else(|| no_note(id))?;
    expand::write_new(place, &path, &title, &nested)?;
    if let Err(error) = write_both(place, PRIORITIES, &edited, &without) {
        let _ = fs::remove_file(place.root.join(&path));
        return Err(error);
    }
    Ok(path)
}

/// Adds a note with a note file to the proposal of `PRIORITIES.md` with the id `proposal`, like
/// `later-2`, which links no file yet, and takes it out of the inbox: the proposal gets its file
/// first, from the template, under a free name, its line linking it, then the note file's text
/// goes into its `## Notes`, as [`into_proposal`] adds it to any proposal file (see
/// [`merge::into_new`]). Both lists are checked against the versions read before anything is
/// written. Returns the new proposal file's path.
pub fn into_proposal_line(
    place: &Place,
    id: &str,
    proposal: &str,
    previous: &str,
    priorities_previous: &str,
) -> Result<String, ActionError> {
    let (inbox, priorities) = both(place, previous, priorities_previous)?;
    let line = priorities::parse(&priorities)
        .into_iter()
        .find(|line| format!("{}-{}", line.section.id(), line.position) == proposal)
        .ok_or_else(|| ActionError::Refused(format!("no proposal {proposal}")))?;
    let note = inbox::note(&inbox, id).ok_or_else(|| no_note(id))?;
    let file = movable(place, &inbox, &note).ok_or_else(|| {
        ActionError::Refused(format!(
            "{} has no note file to go into a proposal's file.",
            note.text
        ))
    })?;
    merge::into_new(place, &inbox, &priorities, id, &file, &line)
}

/// The text of the proposal file or the note file at `path`, from the top level, refused when it
/// is neither.
pub(super) fn file_text(place: &Place, path: &str) -> Result<String, ActionError> {
    let plain = !path.split('/').any(|part| part == ".." || part.is_empty());
    (crate::target::is_linked_file(path) && plain && path.ends_with(".md"))
        .then(|| fs::read_to_string(place.root.join(path)).ok())
        .flatten()
        .ok_or_else(|| ActionError::Refused(format!("no proposal or note file {path}")))
}

/// A note's lines as written in the file at `path`, their relative links rebased to its folder.
pub(super) fn into_file(lines: &[String], path: &str) -> Vec<String> {
    let folder = path.rsplit_once('/').map_or("", |(folder, _)| folder);
    retarget::rebase(&lines.join("\n"), expand::INBOX_FOLDER, folder)
        .split('\n')
        .map(String::from)
        .collect()
}

/// Adds a note to the proposal file at `proposal`, from the top level, and takes it out of the
/// inbox: its lines, without its marks, at the end of the file's `## What` section; or, for a note
/// with a note file, the note file's text at the end of its `## Notes`, under the note's title,
/// its images beside it, the note file deleted (see [`merge::merge`]). Returns the proposal file's
/// path, which a single proposal file made a folder for the images changes.
pub fn into_proposal(
    place: &Place,
    id: &str,
    proposal: &str,
    previous: &str,
) -> Result<String, ActionError> {
    let inbox = current(place, PATH, previous)?;
    let text = file_text(place, proposal)?;
    let note = inbox::note(&inbox, id).ok_or_else(|| no_note(id))?;
    if let Some(file) = movable(place, &inbox, &note) {
        return merge::merge(place, &inbox, id, &file, proposal, &text);
    }
    let (lines, _) = inbox::unmarked_lines(&inbox, id).ok_or_else(|| no_note(id))?;
    let edited = proposal::append_to_what(&text, &into_file(&lines, proposal))
        .ok_or_else(|| ActionError::Refused(format!("{proposal} has no ## What section")))?;
    let without = inbox::remove(&inbox, id).ok_or_else(|| no_note(id))?;
    write_both(place, proposal, &edited, &without)?;
    Ok(proposal.to_string())
}
