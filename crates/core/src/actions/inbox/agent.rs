//! An agent's note acted on by its id, its file's path: turned into its line first, at the end of
//! its category in `INBOX.md`, then acted on as a note linking its file (see the rulings of the
//! "Master" PR, R2). A removal deletes the file alone, `INBOX.md` left as it was, and only when the
//! file is as committed.

use std::fs;

use crate::files::document::hash;
use crate::files::frontmatter;
use crate::files::inbox::categories::remove_category;
use crate::files::inbox::{self, Inbox, NoteFile};

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

/// Puts `INBOX.md` back as it was, `before`, deleting it when it did not exist, after an action
/// refused with `error`: `error`, or, when `INBOX.md` could not be put back, an error saying so too.
fn put_back(place: &Place, before: Option<&str>, error: ActionError) -> ActionError {
    let file = place.root.join(PATH);
    let back = match before {
        Some(before) => fs::write(&file, before),
        None => fs::remove_file(&file),
    };
    match back {
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
/// its line now holds.
pub(super) fn moving(
    place: &Place,
    id: &str,
    previous: Option<&str>,
    act: impl FnOnce(&str, Option<&str>) -> Result<Inbox, ActionError>,
) -> Result<Inbox, ActionError> {
    let inbox = acting(place, id, previous, act)?;
    if !inbox::is_note_file_path(id) {
        return Ok(inbox);
    }
    let path = place.root.join(id);
    let text = fs::read_to_string(&path)?;
    fs::write(path, frontmatter::remove(&text, "category"))?;
    Ok(read(place))
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
