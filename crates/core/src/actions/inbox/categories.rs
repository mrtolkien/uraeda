//! The edits of the categories of `INBOX.md`: checked, then written over the version read.

use crate::files::inbox::{self, Inbox, categories};

use super::{ActionError, Place, agent, apply, note_file, read};

const NO_NAME: &str = "A category needs a name.";

fn refuse<T>(message: String) -> Result<T, ActionError> {
    Err(ActionError::Refused(message))
}

/// A name for a category: trimmed, not empty, one that `category_of` reads back from its heading,
/// and none of `names`, the ones the inbox shows.
fn new_name<'a>(names: &[String], name: &'a str) -> Result<&'a str, ActionError> {
    let name = name.trim();
    if name.is_empty() {
        return refuse(NO_NAME.to_string());
    }
    let heading = format!("## {name}");
    if name.contains(['\n', '\r']) || inbox::category_of(&heading).as_deref() != Some(name) {
        return refuse(format!("{name} cannot be written as a heading."));
    }
    if names.iter().any(|n| n == name) {
        return refuse(format!("A category named {name} exists."));
    }
    Ok(name)
}

/// One of `names`, the categories the inbox shows: its headings', and its agents' notes'.
fn existing<'a>(names: &[String], name: &'a str) -> Result<&'a str, ActionError> {
    let name = name.trim();
    if names.iter().any(|n| n == name) {
        Ok(name)
    } else {
        refuse(format!("No category named {name}."))
    }
}

/// Runs a checked edit over the file as `apply` reads it: a refusal writes nothing.
fn checked(
    place: &Place,
    previous: Option<&str>,
    edit: impl FnOnce(&str) -> Result<String, ActionError>,
) -> Result<Inbox, ActionError> {
    let mut refused = None;
    let result = apply(
        place,
        previous,
        |current| match edit(current) {
            Ok(edited) => Some(edited),
            Err(error) => {
                refused = Some(error);
                None
            }
        },
        NO_NAME,
    );
    match refused {
        Some(error) => Err(error),
        None => result,
    }
}

/// Adds a category at the end of the file.
pub fn add_category(
    place: &Place,
    name: &str,
    previous: Option<&str>,
) -> Result<Inbox, ActionError> {
    checked(place, previous, |current| {
        let names = agent::shown_names(place, current);
        Ok(categories::add_category(current, new_name(&names, name)?))
    })
}

/// Renames every heading of the name `from` to `to`, the lines of its agents' notes written first.
pub fn rename_category(
    place: &Place,
    from: &str,
    to: &str,
    previous: Option<&str>,
) -> Result<Inbox, ActionError> {
    checked(place, previous, |current| {
        let names = agent::shown_names(place, current);
        let from = existing(&names, from)?;
        let to = new_name(&names, to)?;
        let (written, _) = agent::category_written(place, current, from);
        Ok(categories::rename_category(&written, from, to))
    })
}

/// Deletes a category, its notes kept as notes without a category, or deleted with it, the lines
/// of its agents' notes written first. Gives the inbox and the file as it was with those lines,
/// which [`restore_category`] writes back. Deleting its notes is refused, writing nothing, when an
/// agent's note's file is not as `HEAD` has it: it holds the human's work.
pub fn remove_category(
    place: &Place,
    name: &str,
    keep_notes: bool,
    previous: Option<&str>,
) -> Result<(Inbox, String), ActionError> {
    let mut before = String::new();
    let inbox = checked(place, previous, |current| {
        let name = existing(&agent::shown_names(place, current), name)?;
        let (written, agents) = agent::category_written(place, current, name);
        let kept = agents
            .iter()
            .find(|agent| !keep_notes && !note_file::as_committed(place, &agent.path));
        if let Some(agent) = kept {
            return refuse(format!(
                "{} has uncommitted changes: the note was not removed",
                agent.path
            ));
        }
        written.clone_into(&mut before);
        Ok(categories::remove_category(&written, name, keep_notes))
    })?;
    // The notes removed with the category take their note files, which a restore brings back.
    let after = std::fs::read_to_string(place.root.join(super::PATH)).unwrap_or_default();
    if note_file::remove_left(place, &before, &after)? {
        return Ok((read(place), before));
    }
    Ok((inbox, before))
}

/// Writes `before`, the file as a delete found it, back, only when the file still is what the
/// delete wrote: `previous` is its hash. The note files the delete took come back, and `INBOX.md`
/// as `HEAD` has it when it shows the same inbox, the lines of agents' notes the delete wrote
/// dropped again.
pub fn restore_category(place: &Place, before: &str, previous: &str) -> Result<Inbox, ActionError> {
    let inbox = apply(place, Some(previous), |_| Some(before.to_string()), NO_NAME)?;
    let restored = note_file::restore_all(place, before)?;
    if agent::as_committed_when_shown(place)? || restored {
        return Ok(read(place));
    }
    Ok(inbox)
}
