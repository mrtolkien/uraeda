//! The edits of the categories of `INBOX.md`: checked, then written over the version read.

use crate::files::inbox::{self, Inbox, categories};

use super::{ActionError, Place, apply};

const NO_NAME: &str = "A category needs a name.";

fn refuse<T>(message: String) -> Result<T, ActionError> {
    Err(ActionError::Refused(message))
}

/// A name for a category: trimmed, not empty, one that `category_of` reads back from its heading,
/// and none of the existing ones.
fn new_name<'a>(current: &str, name: &'a str) -> Result<&'a str, ActionError> {
    let name = name.trim();
    if name.is_empty() {
        return refuse(NO_NAME.to_string());
    }
    let heading = format!("## {name}");
    if name.contains(['\n', '\r']) || inbox::category_of(&heading).as_deref() != Some(name) {
        return refuse(format!("{name} cannot be written as a heading."));
    }
    if inbox::category_names(current).iter().any(|n| n == name) {
        return refuse(format!("A category named {name} exists."));
    }
    Ok(name)
}

fn existing<'a>(current: &str, name: &'a str) -> Result<&'a str, ActionError> {
    let name = name.trim();
    if inbox::category_names(current).iter().any(|n| n == name) {
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
        Ok(categories::add_category(current, new_name(current, name)?))
    })
}

/// Renames every heading of the name `from` to `to`.
pub fn rename_category(
    place: &Place,
    from: &str,
    to: &str,
    previous: Option<&str>,
) -> Result<Inbox, ActionError> {
    checked(place, previous, |current| {
        let from = existing(current, from)?;
        Ok(categories::rename_category(
            current,
            from,
            new_name(current, to)?,
        ))
    })
}

/// Deletes a category, its notes kept as notes without a category, or deleted with it. Gives the
/// inbox and the file as it was, which [`restore_category`] writes back.
pub fn remove_category(
    place: &Place,
    name: &str,
    keep_notes: bool,
    previous: Option<&str>,
) -> Result<(Inbox, String), ActionError> {
    let mut before = String::new();
    let inbox = checked(place, previous, |current| {
        let name = existing(current, name)?;
        current.clone_into(&mut before);
        Ok(categories::remove_category(current, name, keep_notes))
    })?;
    Ok((inbox, before))
}

/// Writes `before`, the file as a delete found it, back, only when the file still is what the
/// delete wrote: `previous` is its hash.
pub fn restore_category(place: &Place, before: &str, previous: &str) -> Result<Inbox, ActionError> {
    apply(place, Some(previous), |_| Some(before.to_string()), NO_NAME)
}
