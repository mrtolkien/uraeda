//! An agent's note acted on by its id, its file's path: turned into its line first, at the end of
//! its category in `INBOX.md`, then acted on as a note linking its file (see the rulings of the
//! "Master" PR, R2). A removal deletes the file alone, `INBOX.md` left as it was, and only when the
//! file is as committed.

use std::fs;

use crate::files::document::hash;
use crate::files::frontmatter;
use crate::files::inbox::categories::remove_category;
use crate::files::inbox::{self, AgentNote, Inbox, NoteFile};

use super::super::place::Place;
use super::super::{ActionError, STALE};
use super::{PATH, no_note, note_file, read, text};

/// The agent's note `id` with the inbox text `text`: the text with its line written at the end of
/// its category, and that line's note. `None` for an id that names no note file on disk, or one a
/// note of `text` links.
pub(super) fn as_line(place: &Place, text: &str, id: &str) -> Option<(String, inbox::Note)> {
    if !inbox::is_note_file_path(id) {
        return None;
    }
    let file = NoteFile {
        path: id.to_string(),
        text: fs::read_to_string(place.root.join(id)).ok()?,
    };
    let note = inbox::agent_notes(text, &[file]).pop()?;
    let (edited, _) = inbox::add(text, note.category.as_deref(), &note.line);
    let line = inbox::parse(&edited)
        .into_iter()
        .find(|line| line.file().as_deref() == Some(id))?;
    Some((edited, line))
}

/// `INBOX.md`'s text, refused when it changed since it was read at `previous`.
fn unchanged(place: &Place, previous: Option<&str>) -> Result<String, ActionError> {
    let current = text(place)?;
    if previous.is_some_and(|previous| hash(&current) != previous) {
        return Err(ActionError::Refused(format!("INBOX.md {STALE}")));
    }
    Ok(current)
}

/// The line of the agent's note `id` written at the end of its category over `INBOX.md` as read at
/// `previous`: `INBOX.md`'s text before and after, the line's id, and the category the line made,
/// one `INBOX.md` lacked. Refused as no note when `id` names no agent's note, its file gone or
/// linked since.
fn written(place: &Place, id: &str, previous: Option<&str>) -> Result<Written, ActionError> {
    let before = unchanged(place, previous)?;
    let existed = place.root.join(PATH).exists();
    let (after, line) = as_line(place, &before, id).ok_or_else(|| no_note(id))?;
    fs::write(place.root.join(PATH), &after)?;
    let made = line
        .category
        .filter(|name| !inbox::category_names(&before).contains(name));
    Ok(Written {
        before: existed.then_some(before),
        after,
        id: line.id,
        made,
    })
}

/// What [`written`] wrote.
struct Written {
    /// `INBOX.md`'s text before, `None` when it did not exist.
    before: Option<String>,
    after: String,
    id: String,
    made: Option<String>,
}

/// Writes `INBOX.md` back as it was, `before`, deleting it when it did not exist.
fn write_back(place: &Place, before: Option<&str>) -> std::io::Result<()> {
    let file = place.root.join(PATH);
    match before {
        Some(before) => fs::write(&file, before),
        None => fs::remove_file(&file),
    }
}

/// Puts `INBOX.md` back as it was, `before`, deleting it when it did not exist, after an action
/// refused with `error`: `error`, or, when `INBOX.md` could not be put back, an error saying so too.
fn put_back(place: &Place, before: Option<&str>, error: ActionError) -> ActionError {
    match write_back(place, before) {
        Ok(()) => error,
        Err(back) => ActionError::Io(format!(
            "{error}; and INBOX.md could not be put back as it was: {back}"
        )),
    }
}

/// Runs `act` on the note `id`, given its id and `INBOX.md`'s hash once an agent's note is its line,
/// written at the end of its category. `INBOX.md` goes back as it was when `act` refuses; a category
/// the line made goes once the line left it, as a move does.
pub(super) fn acting<T>(
    place: &Place,
    id: &str,
    previous: Option<&str>,
    act: impl FnOnce(&str, Option<&str>) -> Result<T, ActionError>,
) -> Result<T, ActionError> {
    if !inbox::is_note_file_path(id) {
        return act(id, previous);
    }
    let written = written(place, id, previous)?;
    let result = act(
        &written.id,
        previous.map(|_| hash(&written.after)).as_deref(),
    );
    if let Err(error) = result {
        return Err(put_back(place, written.before.as_deref(), error));
    }
    if let Some(name) = &written.made {
        let now = text(place)?;
        let empty = !inbox::parse(&now)
            .iter()
            .any(|note| note.category.as_ref() == Some(name));
        if empty {
            fs::write(place.root.join(PATH), remove_category(&now, name, true))?;
        }
    }
    result
}

/// [`acting`] for an action read at `previous`, as every move out of the inbox is.
pub(super) fn acting_read<T>(
    place: &Place,
    id: &str,
    previous: &str,
    act: impl FnOnce(&str, &str) -> Result<T, ActionError>,
) -> Result<T, ActionError> {
    acting(place, id, Some(previous), |id, linked| {
        act(id, linked.unwrap_or(previous))
    })
}

/// [`acting`] for a move within the inbox: an agent's note's file then loses its `category`, which
/// its line now holds. A move that leaves the inbox showing as it did, the note dropped where it
/// was, writes nothing: `INBOX.md` goes back as it was, and the file keeps its `category`.
pub(super) fn moving(
    place: &Place,
    id: &str,
    previous: Option<&str>,
    act: impl FnOnce(&str, Option<&str>) -> Result<Inbox, ActionError>,
) -> Result<Inbox, ActionError> {
    if !inbox::is_note_file_path(id) {
        return acting(place, id, previous, act);
    }
    let before = place
        .root
        .join(PATH)
        .exists()
        .then(|| text(place))
        .transpose()?;
    acting(place, id, previous, act)?;
    let files = files_on_disk(place);
    let shown = |text: &str| inbox::joined(text, &files);
    if shown(&text(place)?) == shown(before.as_deref().unwrap_or_default()) {
        write_back(place, before.as_deref())?;
        return Ok(read(place));
    }
    let path = place.root.join(id);
    let text = fs::read_to_string(&path)?;
    fs::write(path, frontmatter::remove(&text, "category"))?;
    Ok(read(place))
}

/// The agents' notes of `text` in `category`, in the order the inbox shows them.
fn agents_in(place: &Place, text: &str, category: Option<&str>) -> Vec<AgentNote> {
    inbox::agent_notes(text, &files_on_disk(place))
        .into_iter()
        .filter(|note| note.category.as_deref() == category)
        .collect()
}

/// `text` with the lines of `notes` written, each at the end of its category, and the id the note
/// `id` of `text` has there: the lines added before it shift it. `None` for an `id` that names no
/// note of `text`.
fn with_lines(text: &str, notes: &[AgentNote], id: &str) -> Option<(String, String)> {
    let mut at = inbox::parse(text).iter().position(|note| note.id == id)?;
    let mut text = text.to_string();
    for note in notes {
        let (edited, line) = inbox::add(&text, note.category.as_deref(), &note.line);
        let added = inbox::parse(&edited)
            .iter()
            .position(|note| note.line == line as usize)?;
        if added <= at {
            at += 1;
        }
        text = edited;
    }
    Some((text, format!("note-{}", at + 1)))
}

/// `text` with the lines written of the agents' notes of `category` the inbox shows before the
/// place `index`, and the id the note `id` has there: `index` then counts the notes of `INBOX.md` as
/// it counted the notes shown, the agents' notes after the category's lines. With `leaving`, `id`
/// leaves the category first, and `index` counts the notes without it.
pub(super) fn shown_before(
    place: &Place,
    text: &str,
    id: &str,
    (category, index): (Option<&str>, usize),
    leaving: bool,
) -> Option<(String, String)> {
    let lines = inbox::parse(text)
        .iter()
        .filter(|note| note.category.as_deref() == category && !(leaving && note.id == id))
        .count();
    let mut agents = agents_in(place, text, category);
    agents.truncate(index.saturating_sub(lines));
    with_lines(text, &agents, id)
}

/// The note files of `specs/notes/` in the checkout, with their texts.
fn files_on_disk(place: &Place) -> Vec<NoteFile> {
    inbox::note_files(&inbox::note_paths_on_disk(&place.root), |path| {
        fs::read_to_string(place.root.join(path)).ok()
    })
}

/// The Undo of an agent's note's removal, `lines` put back before the note at `index` of
/// `category`: the file the removal took away comes back, and, when its line would go exactly where
/// the inbox shows the file as an agent's note, `HEAD`'s `INBOX.md` linking it not, `INBOX.md` stays
/// as it is, so the checkout is as before the removal. `None`, writing nothing, when `lines` link no
/// note file a removal holds.
pub(super) fn restored(
    place: &Place,
    category: Option<&str>,
    index: usize,
    lines: &[String],
    previous: Option<&str>,
) -> Result<Option<Inbox>, ActionError> {
    let Some(path) = inbox::file_of_lines(lines).filter(|path| inbox::is_note_file_path(path))
    else {
        return Ok(None);
    };
    let current = unchanged(place, previous)?;
    let inserted = inbox::insert(&current, category, index, lines)
        .ok_or_else(|| ActionError::Refused("Nothing to put back.".to_string()))?;
    if !note_file::restore(place, &path)? {
        return Ok(None);
    }
    let committed = super::super::place::committed(place, PATH).unwrap_or_default();
    let shown = as_line(place, &committed, &path).is_some()
        && as_line(place, &current, &path).is_some_and(|(edited, _)| edited == inserted);
    if !shown {
        fs::write(place.root.join(PATH), &inserted)?;
    }
    Ok(Some(read(place)))
}

/// Removes the agent's note `id` over `INBOX.md` as read at `previous`: its file goes, held for the
/// removal's Undo, and `INBOX.md` stays as it was. Refused, writing nothing, when the file is not
/// as `HEAD` has it: edited since its commit, or never committed, it holds the human's work. `None`
/// for an id that is no note file's path.
pub(super) fn remove(
    place: &Place,
    id: &str,
    previous: Option<&str>,
) -> Option<Result<Inbox, ActionError>> {
    if !inbox::is_note_file_path(id) {
        return None;
    }
    let removed = unchanged(place, previous).and_then(|current| {
        as_line(place, &current, id).ok_or_else(|| no_note(id))?;
        if !note_file::as_committed(place, id) {
            return Err(ActionError::Refused(format!(
                "{id} has uncommitted changes: the note was not removed"
            )));
        }
        note_file::remove(place, id)?;
        Ok(read(place))
    });
    Some(removed)
}
