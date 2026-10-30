//! The repository's open and merged pull requests, from `gh`, and the latest snapshot of them kept
//! in memory per repository, which every workspace read applies to its items' steps.

use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime};

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use crate::cache;
use crate::git::{Git, process};
use crate::steps::{PullRequest, Step};
use crate::workspace::Feature;

/// An open pull request's state.
#[cfg_attr(feature = "napi", napi(string_enum = "kebab-case"))]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PullRequestState {
    Draft,
    Open,
    ChangesRequested,
}

/// A branch's open pull request.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestView {
    pub number: u32,
    /// Its address, like `https://github.com/o/r/pull/31`.
    pub url: String,
    pub state: PullRequestState,
    /// Its head commit's full hash, as `gh` reads it on GitHub: empty when read from a record.
    pub head: String,
}

/// The repository's pull requests, by their branch's name: `Unavailable` when `gh` is missing,
/// signed out, or fails, and before a first fetch.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PullRequests {
    Unavailable,
    Known {
        open: BTreeMap<String, PullRequestView>,
        /// The head commit of each branch's latest merged pull request.
        merged: BTreeMap<String, String>,
    },
}

impl PullRequests {
    /// A snapshot of these open pull requests, and no merged one.
    pub fn open(open: impl IntoIterator<Item = (String, PullRequestView)>) -> PullRequests {
        PullRequests::Known {
            open: open.into_iter().collect(),
            merged: BTreeMap::new(),
        }
    }

    /// The state of `branch`'s pull request, as the steps read it: an open one is `Unpushed` while
    /// its head lacks the branch's latest commit, in `git`. A head the repository does not have
    /// is ready: nothing proves the branch holds commits it lacks (R2).
    fn state(&self, branch: &str, git: &Git) -> PullRequest {
        let PullRequests::Known { open, .. } = self else {
            return PullRequest::Unknown;
        };
        let Some(view) = open.get(branch) else {
            return PullRequest::NoPullRequest;
        };
        match view.state {
            PullRequestState::Draft => PullRequest::Draft,
            PullRequestState::Open if holds_tip(git, branch, &view.head) == Some(false) => {
                PullRequest::Unpushed
            }
            PullRequestState::Open => PullRequest::Open,
            PullRequestState::ChangesRequested => PullRequest::ChangesRequested,
        }
    }

    /// Whether `branch`'s latest merged pull request holds its latest commit, with no open one:
    /// its work is merged, even before a fetch brings the merge. A head the repository does not
    /// have holds it when the local branch is at its remote tip, nothing left unpushed (R2).
    fn merged(&self, branch: &str, git: &Git) -> bool {
        let PullRequests::Known { open, merged } = self else {
            return false;
        };
        !open.contains_key(branch)
            && merged.get(branch).is_some_and(|head| {
                holds_tip(git, branch, head).unwrap_or_else(|| pushed(git, branch))
            })
    }

    /// Gives a feature or a change its branch's open pull request, and recomputes its step when
    /// the pull request decides it: done once a merged pull request holds the branch's latest
    /// commit. A merged item has no branch, and keeps its step.
    pub fn apply(&self, feature: &mut Feature, git: &Git) {
        let Some(branch) = feature.branch.clone() else {
            return;
        };
        feature.pull_request = match self {
            PullRequests::Known { open, .. } => open.get(&branch).cloned(),
            PullRequests::Unavailable => None,
        };
        if !feature.step.depends_on_pull_request() {
            return;
        }
        if self.merged(&branch, git) {
            feature.step = Step::done();
        } else {
            feature.with_pull_request(self.state(&branch, git));
        }
    }
}

/// Whether the commit `head` holds `branch`'s latest commit: `None` when the branch has none, or
/// the repository lacks `head`.
fn holds_tip(git: &Git, branch: &str, head: &str) -> Option<bool> {
    git.holds(head, git.tip(branch)?)
}

/// Whether the local `branch` is at its remote tip: nothing on it is left unpushed.
fn pushed(git: &Git, branch: &str) -> bool {
    let local = git.resolve(&format!("refs/heads/{branch}"));
    local.is_some() && local == git.remote_tip(branch)
}

/// The open pull requests of
/// `gh pr list --json headRefName,headRefOid,number,url,isDraft,reviewDecision`, by branch: changes
/// requested first, even on a draft, since the human's feedback comes before finishing. `None` when
/// it is not that JSON.
pub fn parse(json: &[u8]) -> Option<BTreeMap<String, PullRequestView>> {
    let rows = serde_json::from_slice::<Vec<serde_json::Value>>(json).ok()?;
    let mut known = BTreeMap::new();
    for row in rows {
        let (Some(branch), Some(head), Some(number), Some(url)) = (
            row["headRefName"].as_str(),
            row["headRefOid"].as_str(),
            row["number"].as_u64().and_then(|n| u32::try_from(n).ok()),
            row["url"].as_str(),
        ) else {
            continue;
        };
        let state = if row["reviewDecision"] == "CHANGES_REQUESTED" {
            PullRequestState::ChangesRequested
        } else if row["isDraft"] == true {
            PullRequestState::Draft
        } else {
            PullRequestState::Open
        };
        let view = PullRequestView {
            number,
            url: url.to_string(),
            state,
            head: head.to_string(),
        };
        known.entry(branch.to_string()).or_insert(view);
    }
    Some(known)
}

/// The head commit of each branch's latest merged pull request, from
/// `gh pr list --state merged --json headRefName,headRefOid,number,url`, newest first. `None` when it is not
/// that JSON.
pub fn parse_merged(json: &[u8]) -> Option<BTreeMap<String, String>> {
    let rows = serde_json::from_slice::<Vec<serde_json::Value>>(json).ok()?;
    let mut merged = BTreeMap::new();
    for row in rows {
        if let (Some(branch), Some(head)) =
            (row["headRefName"].as_str(), row["headRefOid"].as_str())
        {
            merged
                .entry(branch.to_string())
                .or_insert_with(|| head.to_string());
        }
    }
    Some(merged)
}

/// Asks `gh` for the open and the merged pull requests of the repository at `root`. `gh` runs
/// there, since it finds the repository from its current folder. The merged ones are the latest
/// 200: an older merge's branch is long gone.
pub fn fetch(root: &Path) -> PullRequests {
    let list = |state: &str, fields: &str| {
        let args = [
            "pr", "list", "--state", state, "--json", fields, "--limit", "200",
        ];
        process::run("gh", &args, root).ok()
    };
    let open = list(
        "open",
        "headRefName,headRefOid,number,url,isDraft,reviewDecision",
    )
    .and_then(|stdout| parse(&stdout));
    let merged = list("merged", "headRefName,headRefOid,number,url")
        .and_then(|stdout| parse_merged(&stdout));
    known(open, merged, &latest(root))
}

/// The snapshot of a fetch's open and merged pull requests, each `None` when its call failed. The
/// open ones decide the steps: without the merged ones, it keeps those of `last`, or none.
pub fn known(
    open: Option<BTreeMap<String, PullRequestView>>,
    merged: Option<BTreeMap<String, String>>,
    last: &PullRequests,
) -> PullRequests {
    let Some(open) = open else {
        return PullRequests::Unavailable;
    };
    let merged = merged.unwrap_or_else(|| match last {
        PullRequests::Known { merged, .. } => merged.clone(),
        PullRequests::Unavailable => BTreeMap::new(),
    });
    PullRequests::Known { open, merged }
}

/// How long a failed `gh` keeps the last pull requests it read.
const KEPT: Duration = Duration::from_secs(10 * 60);

/// The latest snapshot of a repository, and when it was last known from `gh`.
struct Kept {
    snapshot: PullRequests,
    known_at: Option<SystemTime>,
}

fn snapshots() -> &'static Mutex<HashMap<PathBuf, Kept>> {
    static SNAPSHOTS: OnceLock<Mutex<HashMap<PathBuf, Kept>>> = OnceLock::new();
    SNAPSHOTS.get_or_init(Mutex::default)
}

/// Keeps `snapshot` as the latest of the repository whose main checkout is `root`, and says
/// whether it differs from the one before.
pub fn remember(root: &Path, snapshot: PullRequests) -> bool {
    settle(root, snapshot, SystemTime::now())
}

/// Keeps a fetched snapshot as the latest, at `now`: an `Unavailable` one keeps the last known
/// pull requests for 10 minutes after they were read, so a failure of `gh` for a moment changes no
/// step. Says whether the latest changed: when it did, the workspace reads kept in memory, which
/// applied the one before, are read again.
pub fn settle(root: &Path, fetched: PullRequests, now: SystemTime) -> bool {
    let changed = keep(root, fetched, now);
    if changed {
        cache::invalidate(root);
    }
    changed
}

/// Keeps a fetched snapshot as the latest, as `settle` says.
fn keep(root: &Path, fetched: PullRequests, now: SystemTime) -> bool {
    let mut snapshots = snapshots()
        .lock()
        .unwrap_or_else(|poison| poison.into_inner());
    let kept = snapshots.entry(root.to_path_buf()).or_insert(Kept {
        snapshot: PullRequests::Unavailable,
        known_at: None,
    });
    let recent = kept
        .known_at
        .is_some_and(|at| now.duration_since(at).unwrap_or_default() < KEPT);
    let next = match fetched {
        PullRequests::Known { .. } => {
            kept.known_at = Some(now);
            fetched
        }
        PullRequests::Unavailable if recent => return false,
        PullRequests::Unavailable => {
            kept.known_at = None;
            fetched
        }
    };
    let changed = kept.snapshot != next;
    kept.snapshot = next;
    changed
}

/// The latest snapshot of the repository whose main checkout is `root`: `Unavailable` until a
/// first fetch.
pub fn latest(root: &Path) -> PullRequests {
    let snapshots = snapshots()
        .lock()
        .unwrap_or_else(|poison| poison.into_inner());
    snapshots
        .get(root)
        .map_or(PullRequests::Unavailable, |kept| kept.snapshot.clone())
}

/// Fetches the pull requests of the repository whose main checkout is `root`, and remembers them:
/// whether they changed.
pub fn refresh(root: &Path) -> bool {
    remember(root, fetch(root))
}
