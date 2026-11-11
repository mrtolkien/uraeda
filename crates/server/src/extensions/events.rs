//! The events extensions listen to: what sends one to the VMs whose extension is on in its
//! repository, and the watch that turns a repository's changes into steps reached and commits
//! landed, comparing each feature's step and the main checkout's `HEAD` before and after.
//!
//! While no extension listens to a step or a commit, no repository is read, and what was seen
//! is forgotten: the first listener reads each repository.

use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

use serde_json::{Value, json};
use uraeda_core::api::{checkout_commit, read_workspace};
use uraeda_core::today::rfc3339;
use uraeda_core::watch::Changes;

use super::Extensions;
use crate::live::locked;
use crate::records::repositories;
use crate::shared::Shared;

/// The events the watch sends: it reads repositories only while an extension listens to one.
const WATCHED: [&str; 2] = ["step-reached", "commit-landed"];

/// Something that happened in a repository, named by its name in the list.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Happened {
    /// The main checkout's `HEAD` moved to another commit, on `branch`, none when detached.
    CommitLanded {
        repository: String,
        commit: String,
        branch: Option<String>,
    },
    /// A feature or a change reached a step: the step's name, as `plan`, or at a human gate the
    /// kind of the file waiting for the human, as `spec`; and who acts next, `agent`, `human`,
    /// or `nobody`.
    StepReached {
        repository: String,
        feature: String,
        step: String,
        waits_on: String,
    },
    /// A session's turn ended, `done`, `failed`, or `stopped`: `feature` is none for a chat.
    TurnEnded {
        repository: String,
        session: String,
        feature: Option<String>,
        state: String,
    },
    /// A session was made, on the runtime of this name.
    SessionStarted {
        repository: String,
        session: String,
        runtime: String,
    },
}

impl Happened {
    /// The event's name, its repository, and its payload without its `time`.
    fn parts(&self) -> (&'static str, &str, Value) {
        match self {
            Happened::CommitLanded {
                repository,
                commit,
                branch,
            } => (
                "commit-landed",
                repository,
                json!({ "repository": repository, "commit": commit, "branch": branch }),
            ),
            Happened::StepReached {
                repository,
                feature,
                step,
                waits_on,
            } => (
                "step-reached",
                repository,
                json!({ "repository": repository, "feature": feature, "step": step, "waitsOn": waits_on }),
            ),
            Happened::TurnEnded {
                repository,
                session,
                feature,
                state,
            } => (
                "turn-ended",
                repository,
                json!({ "repository": repository, "session": session, "feature": feature, "state": state }),
            ),
            Happened::SessionStarted {
                repository,
                session,
                runtime,
            } => (
                "session-started",
                repository,
                json!({ "repository": repository, "session": session, "runtime": runtime }),
            ),
        }
    }
}

/// Sends an event to each VM that listens to it and whose extension is on in its repository.
pub(super) fn emit(shared: &Shared, extensions: &Extensions, happened: &Happened) {
    let (event, repository, mut payload) = happened.parts();
    payload["time"] = json!(rfc3339(shared.now()));
    for vm in extensions.listening(event) {
        if extensions.on_in(vm.name(), repository) {
            vm.dispatch("event", json!({ "event": event, "payload": payload }));
        }
    }
}

/// What a repository was last seen at: each feature's step and who it waits on, and the main
/// checkout's `HEAD`.
#[derive(Clone, Default)]
struct Seen {
    branch: Option<String>,
    commit: Option<String>,
    steps: HashMap<String, (String, String)>,
}

/// What each repository was last seen at, by its name.
#[derive(Default)]
pub(super) struct Steps(Mutex<HashMap<String, Seen>>);

/// Reads where a repository is now: none when its workspace cannot be read.
fn read(path: &Path) -> Option<Seen> {
    let workspace = read_workspace(path).ok()?;
    let steps = workspace.features.into_iter().map(|feature| {
        // At a human gate, the step is named by the kind of the file that waits.
        let gate = feature.step.name == "human-gate";
        let kind = feature.step.file_kind.filter(|_| gate);
        let name = kind.unwrap_or(feature.step.name);
        (feature.folder, (name, feature.step.waits_on))
    });
    Some(Seen {
        branch: workspace.current_branch,
        commit: checkout_commit(path).ok().flatten(),
        steps: steps.collect(),
    })
}

/// Whether any extension listens to a step or a commit.
fn watched(extensions: &Extensions) -> bool {
    WATCHED
        .iter()
        .any(|event| !extensions.listening(event).is_empty())
}

/// Reads where each listed repository is, when an extension listens to a step or a commit and
/// the repository was not seen yet: its next change is compared with that.
pub(super) fn seed(shared: &Shared) {
    let Some(extensions) = shared.find::<Extensions>() else {
        return;
    };
    if !watched(&extensions) {
        return;
    }
    for repository in repositories::all(shared) {
        let known = locked(&extensions.0.steps.0).contains_key(&repository.name);
        if known || repository.missing {
            continue;
        }
        if let Some(seen) = read(&repository.path) {
            locked(&extensions.0.steps.0)
                .entry(repository.name)
                .or_insert(seen);
        }
    }
}

/// A repository left the list: what was seen of it is forgotten.
pub(crate) fn repository_left(shared: &Shared, repository: &str) {
    if let Some(extensions) = shared.find::<Extensions>() {
        locked(&extensions.0.steps.0).remove(repository);
    }
}

/// A repository's files changed, as the core's watcher reports after each burst: the features
/// it lists, and the `HEAD` when git changed, are compared with what was seen, and what moved
/// is sent as `step-reached` and `commit-landed`.
pub(crate) fn files_changed(shared: &Shared, repository: &str, changes: &Changes) {
    let Some(extensions) = shared.find::<Extensions>() else {
        return;
    };
    if !watched(&extensions) {
        // What was seen goes stale: the next listener reads the repository first.
        locked(&extensions.0.steps.0).remove(repository);
        return;
    }
    if changes.features.is_empty() && !changes.git {
        return;
    }
    let Ok(path) = repositories::path(shared, repository) else {
        return;
    };
    let Some(now) = read(&path) else {
        return;
    };
    let before = locked(&extensions.0.steps.0).insert(repository.to_owned(), now.clone());
    let Some(before) = before else {
        return;
    };
    for feature in &changes.features {
        let step = now.steps.get(feature);
        if let Some((step, waits_on)) = step.filter(|step| before.steps.get(feature) != Some(step))
        {
            let reached = Happened::StepReached {
                repository: repository.to_owned(),
                feature: feature.clone(),
                step: step.clone(),
                waits_on: waits_on.clone(),
            };
            emit(shared, &extensions, &reached);
        }
    }
    if let Some(commit) = now.commit.filter(|_| changes.git)
        && before.commit.as_ref() != Some(&commit)
    {
        let landed = Happened::CommitLanded {
            repository: repository.to_owned(),
            commit,
            branch: now.branch,
        };
        emit(shared, &extensions, &landed);
    }
}
