//! The commit that ends a committing action, shared by `ura` and the server, and the commit of an
//! add alone, for "Add and commit".

use crate::files::inbox::Inbox;
use crate::files::priorities::Priorities;
use crate::git::{Git, GitError};

use super::place::Place;
use super::{ActionError, Change, Committed};

/// Commits an action's files in the working tree it wrote in, running the hooks, or amends the
/// latest commit with them, as [`amend`](super::amend) says. A hook's refusal keeps the files
/// written, and returns its whole output.
pub fn commit(place: &Place, change: &Change) -> Result<Committed, ActionError> {
    committed(place, change, Git::commit)
}

/// Commits an action's files alone, as [`commit`] does, leaving other staged files staged and
/// out of the commit.
pub fn commit_only(place: &Place, change: &Change) -> Result<Committed, ActionError> {
    committed(place, change, Git::commit_only)
}

/// Commits `change` with `run`, and returns it with the message committed, an amend's. An amend
/// git or a hook refuses is tried again as a commit of its own, so a commit never stays stuck on
/// one.
fn committed(
    place: &Place,
    change: &Change,
    run: impl Fn(&Git, &[String], &str, Option<&str>, bool) -> Result<(), GitError>,
) -> Result<Committed, ActionError> {
    let git = Git::open(&place.root)?;
    let mut result = None;
    if let Some((subject, body)) = super::amend::message(place, change) {
        let amended = run(&git, &change.paths, &subject, Some(&body), true);
        result = amended.is_ok().then_some((subject, Some(body)));
    }
    let (subject, body) = match result {
        Some(message) => message,
        None => {
            let message = (change.subject.clone(), change.body.clone());
            match run(&git, &change.paths, &message.0, message.1.as_deref(), false) {
                Ok(()) => message,
                Err(GitError::Command {
                    subcommand,
                    message,
                    output,
                }) if subcommand == "commit" => return Err(ActionError::Hook { message, output }),
                Err(error) => return Err(error.into()),
            }
        }
    };
    let head = Git::open(&place.root)?
        .head()
        .map(|id| id.to_hex_with_len(7).to_string())
        .unwrap_or_default();
    Ok(Committed {
        change: Change {
            paths: change.paths.clone(),
            subject,
            body,
        },
        commit: head,
    })
}

/// Whether "Add and commit" committed its file: `reason` is `other-changes` when the file had
/// uncommitted changes before the add, or `hook-failed`, with `message` the hook's first line.
// `AddCommit` in JavaScript: `Added` is a repository added to the list.
#[cfg_attr(feature = "napi", napi_derive::napi(object, js_name = "AddCommit"))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Added {
    pub committed: bool,
    pub reason: Option<String>,
    pub message: Option<String>,
}

impl Added {
    fn not(reason: &str, message: Option<String>) -> Added {
        Added {
            committed: false,
            reason: Some(reason.to_string()),
            message,
        }
    }
}

/// The priorities after "Add and commit", and whether it committed.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
pub struct ProposalAdded {
    pub priorities: Priorities,
    pub added: Added,
}

/// The inbox after "Add and commit", and whether it committed.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
pub struct InboxAdded {
    pub inbox: Inbox,
    pub added: Added,
}

/// Whether the file at `path` is as its last commit has it, on disk and in the index, a missing
/// file as no commit has it. A change staged then undone on disk is someone's work in progress.
pub fn is_clean(place: &Place, path: &str) -> bool {
    Git::open(&place.root)
        .and_then(|git| git.as_committed(path))
        .unwrap_or(false)
}

/// Runs `write`, an add to the file at `path`, then commits that file alone with `subject`, with
/// the paths `also` gives once it ran, those the write deleted, when it was as committed before: other changes are
/// someone's work in progress. A hook's refusal leaves the add written, uncommitted.
pub fn add_alone<T>(
    place: &Place,
    path: &str,
    also: impl FnOnce() -> Vec<String>,
    subject: String,
    write: impl FnOnce() -> Result<T, ActionError>,
) -> Result<(T, Added), ActionError> {
    let clean = is_clean(place, path);
    let written = write()?;
    if !clean {
        return Ok((written, Added::not("other-changes", None)));
    }
    let mut paths = vec![path.to_string()];
    paths.extend(also());
    let change = Change {
        paths,
        subject,
        body: None,
    };
    match commit_only(place, &change) {
        Ok(_) => Ok((
            written,
            Added {
                committed: true,
                reason: None,
                message: None,
            },
        )),
        Err(ActionError::Hook { message, .. }) => {
            Ok((written, Added::not("hook-failed", Some(message))))
        }
        Err(error) => Err(error),
    }
}
