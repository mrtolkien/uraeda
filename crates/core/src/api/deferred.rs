//! Deferred commits, for the server: it turns deferral on for a repository, takes the commits its
//! writes deferred, and lands them one after another, as [`deferred`] says.

use std::path::Path;

use super::Result;
use crate::actions::deferred;
use crate::cache;
use crate::view::CommitView;

/// A commit deferred by a write, waiting to land.
#[cfg_attr(feature = "napi", napi_derive::napi(object, js_name = "Deferred"))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
pub struct DeferredView {
    pub id: String,
    pub subject: String,
    pub paths: Vec<String>,
}

/// Turns deferral of commits on or off for the repository holding `repo`. Off by default: `ura`
/// and every other caller commit within the call. Turned off, the commits deferred and not landed
/// are forgotten, their files left written, uncommitted.
pub fn defer_commits(repo: &Path, on: bool) {
    deferred::defer(&cache::key(repo), on);
}

/// The commits the writes to the repository holding `repo` deferred since the last call, each
/// handed out once.
pub fn take_deferred(repo: &Path) -> Vec<DeferredView> {
    deferred::take(&cache::key(repo))
        .into_iter()
        .map(|taken| DeferredView {
            id: taken.id,
            subject: taken.subject,
            paths: taken.paths,
        })
        .collect()
}

/// Lands the deferred commit `id`, running the hooks without the repository's write lock, with
/// `on_output` called with each line git and its hooks print. A hook's refusal puts back what the
/// write left, and returns the `hook` error with the whole output.
pub fn land(repo: &Path, id: &str, on_output: impl Fn(&str)) -> Result<CommitView> {
    let committed = deferred::land(&cache::key(repo), id, &on_output)?;
    Ok(CommitView {
        subject: committed.change.subject,
        commit: committed.commit,
    })
}
