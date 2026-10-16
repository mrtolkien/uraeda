//! Editing `PRIORITIES.md` on the default branch: each edit written at once over the version it
//! was read at, then one commit when the human is done, with the inbox's: see [`changes`].

use std::fs;

use crate::files::document::hash;
use crate::files::priorities::{self, EntryChange, Priorities, Section};

use super::commit::{Added, add_alone, commit_only, is_clean};
use super::place::Place;
use super::{ActionError, Change, Committed, STALE, changes};

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

/// Adds a line at the end of a section, then commits `PRIORITIES.md` alone when it had no other
/// change: "Add and commit".
pub fn add_and_commit(
    place: &Place,
    section: Section,
    line: &str,
    previous: &str,
) -> Result<(Priorities, Added), ActionError> {
    let added = EntryChange::Added {
        section,
        text: crate::files::lines::one_line(line),
    };
    let subject = format!("chore: {}", describe(&added));
    let (_, added) = add_alone(place, PATH, subject, || add(place, section, line, previous))?;
    Ok((read(place), added))
}

/// Removes the entry a committed add wrote, `lines` as written, and commits the removal alone:
/// Undo of "Add and commit". Refused as stale when the file changed since it was read at
/// `previous`, or since its commit.
pub fn undo_committed(
    place: &Place,
    lines: &[String],
    previous: &str,
) -> Result<Priorities, ActionError> {
    let current = text(place);
    if hash(&current) != previous || !is_clean(place, PATH) {
        return Err(ActionError::Refused(format!("PRIORITIES.md {STALE}")));
    }
    let (without, entry) = priorities::remove_added(&current, lines).ok_or_else(|| {
        ActionError::Refused("Could not undo: the entry is no longer in PRIORITIES.md.".to_string())
    })?;
    fs::write(place.root.join(PATH), &without)?;
    let removed = EntryChange::Removed {
        section: entry.section,
        text: entry.text,
    };
    commit_only(
        place,
        &Change {
            paths: vec![PATH.to_string()],
            subject: format!("chore: {}", describe(&removed)),
            body: None,
        },
    )?;
    Ok(read(place))
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

/// Commits the commit bar's changes: the priorities, the inbox, and the drafts notes went into.
pub fn commit(place: &Place) -> Result<Committed, ActionError> {
    changes::commit(place)
}

/// Restores the committed priorities, inbox, and drafts notes went into.
pub fn discard(place: &Place) -> Result<(), ActionError> {
    changes::discard(place)
}
