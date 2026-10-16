//! The commit that ends a committing action, shared by `ura` and the server, and the commit of an
//! add alone, for "Add and commit".

use crate::files::inbox::Inbox;
use crate::files::priorities::Priorities;
use crate::git::{Git, GitError};

use super::place::{self, Place};
use super::{ActionError, Change, Committed};

/// Commits an action's files in the working tree it wrote in, running the hooks. A hook's refusal
/// keeps the files written, and returns its whole output.
pub fn commit(place: &Place, change: &Change) -> Result<Committed, ActionError> {
    committed(place, change, Git::commit)
}

/// Commits an action's files alone, as [`commit`] does, leaving other staged files staged and
/// out of the commit.
pub fn commit_only(place: &Place, change: &Change) -> Result<Committed, ActionError> {
    committed(place, change, Git::commit_only)
}

fn committed(
    place: &Place,
    change: &Change,
    run: impl FnOnce(&Git, &[String], &str, Option<&str>) -> Result<(), GitError>,
) -> Result<Committed, ActionError> {
    let git = Git::open(&place.root)?;
    match run(&git, &change.paths, &change.subject, change.body.as_deref()) {
        Ok(()) => {}
        Err(GitError::Command {
            subcommand,
            message,
            output,
        }) if subcommand == "commit" => return Err(ActionError::Hook { message, output }),
        Err(error) => return Err(error.into()),
    }
    let head = Git::open(&place.root)?
        .head()
        .map(|id| id.to_hex_with_len(7).to_string())
        .unwrap_or_default();
    Ok(Committed {
        change: change.clone(),
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
pub struct PrioritiesAdded {
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

/// Whether the file at `path` is as its last commit has it, a missing file as no commit has it.
pub fn is_clean(place: &Place, path: &str) -> bool {
    std::fs::read_to_string(place.root.join(path)).ok() == place::committed(place, path)
}

/// Runs `write`, an add to the file at `path`, then commits that file alone with `subject`, when
/// it was as committed before: other changes are someone's work in progress. A hook's refusal
/// leaves the add written, uncommitted.
pub fn add_alone<T>(
    place: &Place,
    path: &str,
    subject: String,
    write: impl FnOnce() -> Result<T, ActionError>,
) -> Result<(T, Added), ActionError> {
    let clean = is_clean(place, path);
    let written = write()?;
    if !clean {
        return Ok((written, Added::not("other-changes", None)));
    }
    let change = Change {
        paths: vec![path.to_string()],
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
