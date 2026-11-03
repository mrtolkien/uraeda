//! The commit that ends a committing action, shared by `ura` and the server, and the commit of an
//! add alone, for "Add and commit".

use crate::cache::WriteGuard;
use crate::files::inbox::Inbox;
use crate::files::priorities::Priorities;
use crate::git::{Git, GitError};

use super::place::Place;
use super::{ActionError, Change, Committed};

/// How a commit runs: alone, other staged files left out of it, and whether it may amend the latest
/// commit, as [`amend`](super::amend) says. A message the human typed never amends.
#[derive(Clone, Copy, Debug)]
pub(super) struct Mode {
    pub only: bool,
    pub amends: bool,
}

/// Commits an action's files in the working tree it wrote in, running the hooks, or amends the
/// latest commit with them, as [`amend`](super::amend) says. A hook's refusal keeps the files
/// written, and returns its whole output. In a repository that defers its commits, returns at
/// once, the commit left to [`land`](super::deferred::land).
pub fn commit(place: &Place, change: &Change) -> Result<Committed, ActionError> {
    commit_as(
        place,
        change,
        Mode {
            only: false,
            amends: true,
        },
    )
}

/// Commits an action's files alone, as [`commit`] does, leaving other staged files staged and
/// out of the commit.
pub fn commit_only(place: &Place, change: &Change) -> Result<Committed, ActionError> {
    commit_as(
        place,
        change,
        Mode {
            only: true,
            amends: true,
        },
    )
}

/// Commits an action's files as `mode` says, as [`commit`] does.
pub(super) fn commit_as(
    place: &Place,
    change: &Change,
    mode: Mode,
) -> Result<Committed, ActionError> {
    if let Some(deferred) = super::deferred::defer_commit(place, change, mode) {
        return Ok(deferred);
    }
    type Run = fn(&Git, &[String], &str, Option<&str>, bool) -> Result<(), GitError>;
    let run: Run = if mode.only {
        Git::commit_only
    } else {
        Git::commit
    };
    committed(place, change, mode.amends, run)
}

/// Runs a deferred commit as `mode` says, as [`commit_as`] would have, `on_output` given git's
/// output as it comes. The repository's write lock, which `lock` takes, is held to stage the
/// change's paths and to take them back on a refusal, never while `git commit` and its hooks run.
pub(super) fn run(
    place: &Place,
    change: &Change,
    mode: Mode,
    on_output: &dyn Fn(&str),
    lock: &dyn Fn() -> WriteGuard,
) -> Result<Committed, ActionError> {
    committed(
        place,
        change,
        mode.amends,
        |git, paths, subject, body, amend| {
            let stage = {
                let _lock = lock();
                git.stage(paths, mode.only)?
            };
            git.commit_stage(&stage, subject, body, amend, Some(on_output))
                .inspect_err(|_| {
                    let _lock = lock();
                    drop(git.unstage_stage(&stage));
                })
        },
    )
}

/// Commits `change` with `run`, and returns it with the message committed, an amend's. An amend
/// that git or a hook refuses is tried again as a plain commit, so the files are committed whenever
/// a plain commit would be.
fn committed(
    place: &Place,
    change: &Change,
    amends: bool,
    run: impl Fn(&Git, &[String], &str, Option<&str>, bool) -> Result<(), GitError>,
) -> Result<Committed, ActionError> {
    let git = Git::open(&place.root)?;
    let amend = amends
        .then(|| super::amend::message(place, change))
        .flatten();
    let amended = match amend {
        Some((subject, body)) => match run(&git, &change.paths, &subject, Some(&body), true) {
            Ok(()) => Some((subject, Some(body))),
            Err(GitError::Command { subcommand, .. }) if subcommand == "commit" => None,
            Err(error) => return Err(error.into()),
        },
        None => None,
    };
    let (subject, body) = match amended {
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
/// the paths `also` gives once it ran, those the write deleted, when it was as committed before:
/// other changes are someone's work in progress. A hook's refusal leaves the add written,
/// uncommitted.
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
    // A file missing on disk and in `HEAD`, as `INBOX.md` before its first note, is no path to
    // commit: the deletions of `also` are the whole commit.
    let mut paths: Vec<String> = Some(path.to_string())
        .filter(|path| {
            place.root.join(path).exists() || super::place::committed(place, path).is_some()
        })
        .into_iter()
        .collect();
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
