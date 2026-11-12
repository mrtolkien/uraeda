//! `gh`, asked for a repository's pull requests. It runs in the server's environment, so the
//! config folder's secrets reach it, as `GH_TOKEN`, and in the repository's main checkout,
//! since it finds the repository from its current folder. The core reads what it answers.

use std::path::Path;
use std::time::Duration;

use uraeda_core::pulls::{self, PullRequests};

use crate::live::wait;
use crate::shared::Shared;

/// `gh` gives up after this long: a network that does not answer holds no round for longer.
const WITHIN: Duration = Duration::from_secs(30);

/// The pull requests asked for, of each state: an older merge's branch is long gone.
const LIMIT: &str = "200";

/// What is asked of an open pull request.
const OPEN: &str = "headRefName,headRefOid,number,url,isDraft,reviewDecision";

/// What is asked of a merged one.
const MERGED: &str = "headRefName,headRefOid,number,url";

/// The server stopped while `gh` ran, which was ended.
pub(super) struct Stopped;

/// Asks `gh` for the open and the merged pull requests of the repository whose main checkout
/// is `root`, on a blocking thread: unavailable when `gh` is missing, signed out, fails, or
/// does not answer. The merged ones are asked only once the open ones are known, which alone
/// decide whether anything is.
pub(super) fn pull_requests(shared: &Shared, root: &Path) -> Result<PullRequests, Stopped> {
    let open = list(shared, root, "open", OPEN)?;
    let open = open.and_then(|answer| pulls::parse(&answer));
    let merged = match open {
        Some(_) => list(shared, root, "merged", MERGED)?,
        None => None,
    };
    let merged = merged.and_then(|answer| pulls::parse_merged(&answer));
    Ok(pulls::known(open, merged, &pulls::latest(root)))
}

/// What `gh pr list` prints for the pull requests of a state, or none when it fails. A server
/// that stops starts no `gh`, and ends the one that runs.
fn list(
    shared: &Shared,
    root: &Path,
    state: &str,
    fields: &str,
) -> Result<Option<Vec<u8>>, Stopped> {
    let mut gh = shared.environment().command("gh");
    gh.args(["pr", "list", "--state", state, "--json", fields])
        .args(["--limit", LIMIT])
        .current_dir(root);
    let answered = wait(async {
        tokio::select! {
            biased;
            () = shared.stopping() => Err(Stopped),
            answer = crate::process::output(gh, WITHIN) => Ok(answer),
        }
    })?;
    let printed = answered.and_then(Result::ok);
    let printed = printed.filter(|printed| printed.status.success());
    Ok(printed.map(|printed| printed.stdout))
}
