//! The repository's open pull requests, from one `gh` call, and the latest snapshot of them kept
//! in memory per repository, which every workspace read applies to its items' steps.

use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use crate::git::process;
use crate::steps::PullRequest;
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
}

/// The repository's open pull requests, by their branch's name: `Unavailable` when `gh` is
/// missing, signed out, or fails, and before a first fetch.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PullRequests {
    Unavailable,
    Known(BTreeMap<String, PullRequestView>),
}

impl PullRequests {
    /// The state of `branch`'s pull request, as the steps read it.
    pub fn state(&self, branch: &str) -> PullRequest {
        let PullRequests::Known(known) = self else {
            return PullRequest::Unknown;
        };
        match known.get(branch).map(|view| view.state) {
            None => PullRequest::NoPullRequest,
            Some(PullRequestState::Draft) => PullRequest::Draft,
            Some(PullRequestState::Open) => PullRequest::Open,
            Some(PullRequestState::ChangesRequested) => PullRequest::ChangesRequested,
        }
    }

    /// Gives a feature or a change its branch's open pull request, and recomputes its step when
    /// the pull request decides it. A merged item has no branch, and keeps its step.
    pub fn apply(&self, feature: &mut Feature) {
        let Some(branch) = feature.branch.clone() else {
            return;
        };
        feature.pull_request = match self {
            PullRequests::Known(known) => known.get(&branch).cloned(),
            PullRequests::Unavailable => None,
        };
        if feature.step.depends_on_pull_request() {
            feature.with_pull_request(self.state(&branch));
        }
    }
}

/// The open pull requests of `gh pr list --json headRefName,number,url,isDraft,reviewDecision`,
/// by branch: changes requested first, even on a draft, since the human's feedback comes before
/// finishing. `None` when it is not that JSON.
pub fn parse(json: &[u8]) -> Option<BTreeMap<String, PullRequestView>> {
    let rows = serde_json::from_slice::<Vec<serde_json::Value>>(json).ok()?;
    let mut known = BTreeMap::new();
    for row in rows {
        let (Some(branch), Some(number), Some(url)) = (
            row["headRefName"].as_str(),
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
        };
        known.entry(branch.to_string()).or_insert(view);
    }
    Some(known)
}

/// Asks `gh` for the open pull requests of the repository at `root`. `gh` runs there, since it
/// finds the repository from its current folder.
pub fn fetch(root: &Path) -> PullRequests {
    let args = [
        "pr",
        "list",
        "--state",
        "open",
        "--json",
        "headRefName,number,url,isDraft,reviewDecision",
        "--limit",
        "200",
    ];
    process::run("gh", &args, root)
        .ok()
        .and_then(|stdout| parse(&stdout))
        .map_or(PullRequests::Unavailable, PullRequests::Known)
}

fn snapshots() -> &'static Mutex<HashMap<PathBuf, PullRequests>> {
    static SNAPSHOTS: OnceLock<Mutex<HashMap<PathBuf, PullRequests>>> = OnceLock::new();
    SNAPSHOTS.get_or_init(Mutex::default)
}

/// Keeps `snapshot` as the latest of the repository whose main checkout is `root`, and says
/// whether it differs from the one before.
pub fn remember(root: &Path, snapshot: PullRequests) -> bool {
    let mut snapshots = snapshots()
        .lock()
        .unwrap_or_else(|poison| poison.into_inner());
    let before = snapshots.insert(root.to_path_buf(), snapshot.clone());
    before.unwrap_or(PullRequests::Unavailable) != snapshot
}

/// The latest snapshot of the repository whose main checkout is `root`: `Unavailable` until a
/// first fetch.
pub fn latest(root: &Path) -> PullRequests {
    let snapshots = snapshots()
        .lock()
        .unwrap_or_else(|poison| poison.into_inner());
    snapshots
        .get(root)
        .cloned()
        .unwrap_or(PullRequests::Unavailable)
}

/// Fetches the pull requests of the repository whose main checkout is `root`, and remembers them:
/// whether they changed.
pub fn refresh(root: &Path) -> bool {
    remember(root, fetch(root))
}
