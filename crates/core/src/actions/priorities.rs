//! Editing `PRIORITIES.md` on the default branch: each edit written at once over the version it
//! was read at, then one commit when the human is done, with the inbox's: see [`changes`].

use std::fs;

use crate::files::document::hash;
use crate::files::priorities::{self, EntryChange, Priorities, Section};

use super::place::Place;
use super::{ActionError, Committed, STALE, changes};

pub const PATH: &str = "specs/PRIORITIES.md";

fn text(place: &Place) -> String {
    fs::read_to_string(place.root.join(PATH)).unwrap_or_default()
}

/// The priorities of `text`, with the count of the commit bar's change list.
fn counted(place: &Place, text: &str) -> Priorities {
    Priorities {
        changes: changes::list(place).count,
        ..priorities::read(text, None)
    }
}

/// The priorities, with the number of changes the commit bar counts.
pub fn read(place: &Place) -> Priorities {
    counted(place, &text(place))
}

/// Applies an edit over the version read at `previous`, and returns the priorities as it wrote
/// them: a change made elsewhere right after is not taken for this one, and the next edit over
/// this version is refused.
fn apply(
    place: &Place,
    previous: &str,
    edit: impl FnOnce(&str) -> Option<String>,
    refused: &str,
) -> Result<Priorities, ActionError> {
    let current = text(place);
    if hash(&current) != previous {
        return Err(ActionError::Refused(format!("PRIORITIES.md {STALE}")));
    }
    let edited = edit(&current).ok_or_else(|| ActionError::Refused(refused.to_string()))?;
    fs::write(place.root.join(PATH), &edited)?;
    Ok(counted(place, &edited))
}

/// Adds a line at the end of a section.
pub fn add(
    place: &Place,
    section: Section,
    line: &str,
    previous: &str,
) -> Result<Priorities, ActionError> {
    apply(
        place,
        previous,
        |text| priorities::add(text, section, line),
        "a priority needs some text",
    )
}

/// Inserts an entry's lines, nested lines included, before the entry at `index` of `section`, or
/// at its end when `index` is past it: Undo of a removal.
pub fn insert(
    place: &Place,
    section: Section,
    index: usize,
    lines: &[String],
    previous: &str,
) -> Result<Priorities, ActionError> {
    apply(
        place,
        previous,
        |text| priorities::insert_entry(text, section, index, lines),
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
) -> Result<Priorities, ActionError> {
    apply(
        place,
        previous,
        |text| priorities::move_entry(text, id, section, index),
        &format!("no priority {id}"),
    )
}

/// Replaces an entry's text.
pub fn edit(
    place: &Place,
    id: &str,
    line: &str,
    previous: &str,
) -> Result<Priorities, ActionError> {
    apply(
        place,
        previous,
        |text| priorities::edit(text, id, line),
        &format!("no priority {id}, or an empty text"),
    )
}

/// Removes an entry and its nested lines.
pub fn remove(place: &Place, id: &str, previous: &str) -> Result<Priorities, ActionError> {
    apply(
        place,
        previous,
        |text| priorities::remove(text, id),
        &format!("no priority {id}"),
    )
}

/// An entry's text cut at a word, to keep a subject short.
pub(crate) fn short(text: &str) -> String {
    const MAX: usize = 40;
    if text.chars().count() <= MAX {
        return text.to_string();
    }
    let cut: String = text.chars().take(MAX).collect();
    let words = cut
        .rsplit_once(' ')
        .map_or(cut.as_str(), |(words, _)| words);
    format!(
        "{}…",
        words.trim_end_matches(|c: char| !c.is_alphanumeric() && !")]".contains(c))
    )
}

/// A change as a subject's description, its entry's text shortened.
pub(crate) fn describe(change: &EntryChange) -> String {
    match change {
        EntryChange::Added { section, text } => {
            format!("add \"{}\" to {}", short(text), section.title())
        }
        EntryChange::Removed { text, .. } => format!("remove \"{}\"", short(text)),
        EntryChange::Moved { from, to, text } if from == to => {
            format!("move \"{}\" within {}", short(text), to.title())
        }
        EntryChange::Moved { to, text, .. } => {
            format!("move \"{}\" to {}", short(text), to.title())
        }
        EntryChange::Edited { after, .. } => format!("edit \"{}\"", short(after)),
    }
}

/// A change as a line of the body, with its entry's whole text.
pub(crate) fn line(change: &EntryChange) -> String {
    match change {
        EntryChange::Added { section, text } => format!("- Add to {}: {text}", section.title()),
        EntryChange::Removed { section, text } => {
            format!("- Remove from {}: {text}", section.title())
        }
        EntryChange::Moved { from, to, text } if from == to => {
            format!("- Move within {}: {text}", to.title())
        }
        EntryChange::Moved { from, to, text } => {
            format!("- Move from {} to {}: {text}", from.title(), to.title())
        }
        EntryChange::Edited {
            section,
            before,
            after,
        } => format!("- Edit in {}: {before} -> {after}", section.title()),
    }
}

/// The commit message of the changes from `before` to `after`: the first change, and with more,
/// their count, and every change in the body.
pub fn message(before: &str, after: &str) -> (String, Option<String>) {
    let changes = priorities::diff(before, after);
    match changes.as_slice() {
        [] => ("chore: update the priorities".to_string(), None),
        [change] => (format!("chore: {}", describe(change)), None),
        [first, rest @ ..] => (
            format!("chore: {}, and {} more", describe(first), rest.len()),
            Some(changes.iter().map(line).collect::<Vec<_>>().join("\n")),
        ),
    }
}

/// Commits the commit bar's changes: the priorities, the inbox, and the drafts notes went into.
pub fn commit(place: &Place) -> Result<Committed, ActionError> {
    changes::commit(place)
}

/// Restores the committed priorities, inbox, and drafts notes went into.
pub fn discard(place: &Place) -> Result<(), ActionError> {
    changes::discard(place)
}
