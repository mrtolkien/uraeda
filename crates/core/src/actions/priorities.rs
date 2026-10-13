//! Editing `PRIORITIES.md` on the default branch: each edit written at once over the version it
//! was read at, then one commit when the human is done.

use std::fs;

use crate::files::document::hash;
use crate::files::priorities::{self, EntryChange, Priorities, Section};
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
        return Err(ActionError::Refused(
            "PRIORITIES.md changed on disk. Your change was not applied.".to_string(),
        ));
    }
    let edited = edit(&current).ok_or_else(|| ActionError::Refused(refused.to_string()))?;
    fs::write(place.root.join(PATH), &edited)?;
    Ok(priorities::read(&edited, committed(place).as_deref()))
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
fn short(text: &str) -> String {
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
fn describe(change: &EntryChange) -> String {
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
fn line(change: &EntryChange) -> String {
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

/// Commits `PRIORITIES.md` alone, with a message naming its changes.
pub fn commit(place: &Place) -> Result<Committed, ActionError> {
    let before = committed(place);
    let after = text(place);
    if before.as_deref() == Some(after.as_str()) {
        return Err(ActionError::Refused(
            "PRIORITIES.md has no change to commit".to_string(),
        ));
    }
    let (subject, body) = message(before.as_deref().unwrap_or_default(), &after);
    let change = Change {
        paths: vec![PATH.to_string()],
        subject,
        body,
    };
    place::ensure_only_staged(place, &change.paths)?;
    commit::commit(place, &change)
}

/// Restores the committed `PRIORITIES.md`.
pub fn discard(place: &Place) -> Result<(), ActionError> {
    Git::open(&place.root)?.restore(PATH)?;
    Ok(())
}
