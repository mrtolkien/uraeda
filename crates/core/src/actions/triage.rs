//! The inbox's triage, `specs/INBOX-TRIAGE.md`: the one round of questions that lives on the
//! default branch, outside any feature folder. It is answered as a feature's round is, and
//! committed alone with a subject of its own.

use std::fs;

use crate::files::document::hash;
use crate::files::frontmatter;
use crate::today::Date;

use super::place::Place;
use super::{ActionError, Change, Committed, answer, commit};

/// The triage's path from the repository's root.
pub const PATH: &str = "specs/INBOX-TRIAGE.md";

/// The triage's file name, which is also its template's.
pub const FILE_NAME: &str = "INBOX-TRIAGE.md";

/// The triage's id among workflow files: it has no feature folder.
pub const ID: &str = "inbox-triage";

/// The subject of the commit submitting the triage's answers.
const ANSWERED: &str = "chore: answer the inbox triage";

/// The subject of the commit deleting the triage unanswered, for a new one.
const DISMISSED: &str = "chore: dismiss the inbox triage";

/// Refuses the triage as changed unless its text has the hash `base`: the page that writes or
/// submits it saw all of it.
pub fn ensure_unchanged(place: &Place, base: &str) -> Result<(), ActionError> {
    if hash(&fs::read_to_string(place.root.join(PATH))?) == base {
        Ok(())
    } else {
        Err(ActionError::changed(PATH))
    }
}

/// The commit of the triage alone: files the human staged stay staged, out of it.
fn commit_alone(place: &Place, subject: &str) -> Result<Committed, ActionError> {
    commit::commit_only(
        place,
        &Change {
            paths: vec![PATH.to_string()],
            subject: subject.to_string(),
            body: None,
        },
    )
}

/// Submits the triage, answered as a feature's round is, and commits it alone. Refused before
/// anything is written when it changed since it was read with the hash `previous`.
pub fn submit(place: &Place, previous: &str, today: Date) -> Result<Committed, ActionError> {
    ensure_unchanged(place, previous)?;
    answer::record(place, PATH, today, false)?;
    commit_alone(place, ANSWERED)
}

/// Commits the triage again after a hook refused its submit: only an answered triage that the
/// last commit does not hold.
pub fn retry(place: &Place) -> Result<Committed, ActionError> {
    let text = fs::read_to_string(place.root.join(PATH))?;
    let answered = frontmatter::parse(&text)
        .ok()
        .is_some_and(|front| front.text("status") == Some("answered"));
    let git = crate::git::Git::open(&place.root)?;
    let committed = git
        .head()
        .and_then(|head| git.read_file(head, PATH).ok().flatten());
    if !answered || committed.as_deref() == Some(text.as_bytes()) {
        return Err(ActionError::Refused(format!(
            "{} has nothing to commit again",
            answer::name_of(PATH)
        )));
    }
    commit_alone(place, ANSWERED)
}

/// Dismisses the triage: deletes its file and commits the deletion alone, so a new one can be
/// asked for. Refused before anything is written when it changed since it was read with the hash
/// `previous`, and for a triage that is gone or was never committed.
pub fn dismiss(place: &Place, previous: &str) -> Result<Committed, ActionError> {
    if !place.root.join(PATH).exists() {
        return Err(ActionError::Refused("No inbox triage waits.".to_string()));
    }
    // Git keeps a committed triage; one never committed would be lost for good, and git cannot
    // commit its deletion.
    if super::place::committed(place, PATH).is_none() {
        return Err(ActionError::Refused(format!(
            "{} was never committed: delete it by hand to dismiss it.",
            answer::name_of(PATH)
        )));
    }
    ensure_unchanged(place, previous)?;
    fs::remove_file(place.root.join(PATH))?;
    commit_alone(place, DISMISSED)
}
