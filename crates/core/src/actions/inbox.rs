//! Editing `INBOX.md` on the default branch: each edit written at once over the version it was
//! read at, as the priorities are.

use std::fs;

use crate::files::document::hash;
use crate::files::frontmatter;
use crate::files::inbox::{self, Inbox};

use super::place::{self, Place};
use super::{ActionError, STALE};

pub const PATH: &str = "specs/INBOX.md";
/// The agent's proposed triage, answered like a round of questions.
pub const TRIAGE: &str = "specs/INBOX-TRIAGE.md";

/// The marks a tool writes before a note's text.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Marks {
    /// Whether an agent wrote the note.
    pub agent: bool,
    /// The slug of the feature or bug it is about.
    pub about: Option<String>,
}

/// The file's text: empty when it is missing, an error when it cannot be read, so that an edit
/// does not overwrite it.
fn text(place: &Place) -> Result<String, ActionError> {
    match fs::read_to_string(place.root.join(PATH)) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        result => Ok(result?),
    }
}

/// The inbox of `text`, with its changes since `committed` and the status of the triage `triage`.
pub fn of(text: &str, committed: Option<&str>, triage: Option<&str>) -> Inbox {
    let status = triage
        .and_then(|triage| frontmatter::parse(triage).ok())
        .and_then(|front| front.text("status").map(String::from));
    Inbox {
        changes: inbox::diff(committed.unwrap_or_default(), text).len() as u32,
        triage: status,
        ..inbox::read(text)
    }
}

fn read_text(place: &Place, written: &str) -> Inbox {
    let triage = fs::read_to_string(place.root.join(TRIAGE)).ok();
    of(
        written,
        place::committed(place, PATH).as_deref(),
        triage.as_deref(),
    )
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

/// Adds a note at the end of a category, or of the notes without one, creating the file or the
/// category when missing. `previous` is `None` when nothing was read before, as from the CLI.
pub fn add(
    place: &Place,
    category: Option<&str>,
    marks: &Marks,
    text: &str,
    previous: Option<&str>,
) -> Result<Inbox, ActionError> {
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
    let line = inbox::note_line(marks.agent, marks.about.as_deref(), text);
    apply(
        place,
        previous,
        |current| Some(inbox::add(current, category, &line)),
        NO_TEXT,
    )
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

/// Removes a note, sub-items included.
pub fn remove(place: &Place, id: &str, previous: Option<&str>) -> Result<Inbox, ActionError> {
    apply(
        place,
        previous,
        |current| inbox::remove(current, id),
        &format!("no note {id}"),
    )
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

/// Inserts a note's lines, as written, before the note at `index` of a category, or at its end:
/// Undo of a removal.
pub fn insert(
    place: &Place,
    category: Option<&str>,
    index: usize,
    lines: &[String],
    previous: Option<&str>,
) -> Result<Inbox, ActionError> {
    apply(
        place,
        previous,
        |current| inbox::insert(current, category, index, lines),
        "Nothing to put back.",
    )
}
