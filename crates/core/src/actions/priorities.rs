//! Editing `PRIORITIES.md` on the default branch: each edit written at once over the version it
//! was read at, then one commit when the human is done.

use std::fs;

use crate::files::document::hash;
use crate::files::priorities::{self, Priorities, Section};
use crate::git::Git;

use super::place::{self, Place};
use super::{ActionError, Change, Committed, commit};

pub const PATH: &str = "specs/PRIORITIES.md";

/// The file's committed text, at `HEAD` of the working tree.
fn committed(place: &Place) -> Option<String> {
    let git = Git::open(&place.root).ok()?;
    let bytes = git.read_file(git.head()?, PATH).ok()??;
    String::from_utf8(bytes).ok()
}

fn text(place: &Place) -> String {
    fs::read_to_string(place.root.join(PATH)).unwrap_or_default()
}

/// The priorities, with the number of changes since the last commit.
pub fn read(place: &Place) -> Priorities {
    priorities::read(&text(place), committed(place).as_deref())
}

/// Applies an edit over the version read at `previous`, and returns the new hash.
fn apply(
    place: &Place,
    previous: &str,
    edit: impl FnOnce(&str) -> Option<String>,
    refused: &str,
) -> Result<String, ActionError> {
    let current = text(place);
    if hash(&current) != previous {
        return Err(ActionError::Refused(
            "PRIORITIES.md changed on disk. Your change was not applied.".to_string(),
        ));
    }
    let edited = edit(&current).ok_or_else(|| ActionError::Refused(refused.to_string()))?;
    fs::write(place.root.join(PATH), &edited)?;
    Ok(hash(&edited))
}

/// Adds a line at the end of a section.
pub fn add(
    place: &Place,
    section: Section,
    line: &str,
    previous: &str,
) -> Result<String, ActionError> {
    apply(
        place,
        previous,
        |text| priorities::add(text, section, line),
        "a priority needs some text",
    )
}

/// Moves an entry before the entry at `index` of `section`, or to its end.
pub fn move_entry(
    place: &Place,
    id: &str,
    section: Section,
    index: usize,
    previous: &str,
) -> Result<String, ActionError> {
    apply(
        place,
        previous,
        |text| priorities::move_entry(text, id, section, index),
        &format!("no priority {id}"),
    )
}

/// Replaces an entry's text.
pub fn edit(place: &Place, id: &str, line: &str, previous: &str) -> Result<String, ActionError> {
    apply(
        place,
        previous,
        |text| priorities::edit(text, id, line),
        &format!("no priority {id}, or an empty text"),
    )
}

/// Removes an entry and its nested lines.
pub fn remove(place: &Place, id: &str, previous: &str) -> Result<String, ActionError> {
    apply(
        place,
        previous,
        |text| priorities::remove(text, id),
        &format!("no priority {id}"),
    )
}

/// Commits `PRIORITIES.md` alone.
pub fn commit(place: &Place) -> Result<Committed, ActionError> {
    if committed(place).as_deref() == Some(text(place).as_str()) {
        return Err(ActionError::Refused(
            "PRIORITIES.md has no change to commit".to_string(),
        ));
    }
    let change = Change {
        paths: vec![PATH.to_string()],
        subject: "chore: update the priorities".to_string(),
        body: None,
    };
    place::ensure_only_staged(place, &change.paths)?;
    commit::commit(place, &change)
}

/// Restores the committed `PRIORITIES.md`.
pub fn discard(place: &Place) -> Result<(), ActionError> {
    Git::open(&place.root)?.restore(PATH)?;
    Ok(())
}
