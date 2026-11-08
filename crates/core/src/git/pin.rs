//! A clone pinned to a commit, for an extension `ura` installs from git: cloned, fetched, and
//! moved only through the one write runner, which never prompts, each talk to the remote stopped
//! at the fetch deadline. `HEAD` stays detached, so nothing but `ura extension update` moves it.
//! Nothing here runs the clone's code; git runs only the hooks of the user's own configuration.

use std::path::Path;

use super::process;
use super::remote::{FETCH_DEADLINE, remote_error};
use super::{Git, GitError, ObjectId};

/// Where a fetch of the followed branch or tag lands, in the clone.
const FETCHED: &str = "refs/ura/fetched";

/// A clone, pinned.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Pinned {
    /// The commit checked out, detached.
    pub commit: ObjectId,
    /// The remote's default branch, which an update follows.
    pub branch: String,
}

/// Clones `url` into the new folder `into`, and pins it to its default branch's commit.
pub fn clone_pinned(url: &str, into: &Path) -> Result<Pinned, GitError> {
    let parent = into.parent().unwrap_or(Path::new("."));
    let into_text = into.to_string_lossy();
    let clone = ["clone", "--quiet", "--", url, into_text.as_ref()];
    process::git_write_within(&clone, parent, &|_| {}, FETCH_DEADLINE)
        .map_err(|failure| remote_error(failure, "clone", FETCH_DEADLINE))?;
    let git = Git::open(into)?;
    let (Some(branch), Some(commit)) = (git.current_branch(), git.head()) else {
        return Err(GitError::Refused(format!("{url} has no commits")));
    };
    git.checkout_detached(commit)?;
    Ok(Pinned { commit, branch })
}

impl Git {
    /// Fetches `origin`'s branch or tag `git_ref`, and returns its commit, without moving
    /// anything checked out.
    pub fn fetch_pinned(&self, git_ref: &str) -> Result<ObjectId, GitError> {
        let unsafe_ref = git_ref.is_empty()
            || git_ref.starts_with(['-', '+'])
            || git_ref.contains([':', ' ', '\t', '\n', '*', '^', '~', '?', '[', '\\'])
            || git_ref.contains("..");
        if unsafe_ref {
            return Err(GitError::Refused(format!(
                "\"{git_ref}\" is not a branch or a tag"
            )));
        }
        let refspec = format!("+{git_ref}:{FETCHED}");
        let fetch = ["fetch", "--quiet", "--no-tags", "origin", refspec.as_str()];
        process::git_write_within(&fetch, &self.root, &|_| {}, FETCH_DEADLINE)
            .map_err(|failure| remote_error(failure, "fetch", FETCH_DEADLINE))?;
        // A fresh read: the fetch wrote a reference this `Git` may not see.
        Git::open(&self.root)?
            .resolve(&format!("{FETCHED}^{{commit}}"))
            .ok_or_else(|| GitError::Refused(format!("{git_ref} names no commit")))
    }

    /// Checks `commit` out, detached: the clone's files become the commit's.
    pub fn checkout_detached(&self, commit: ObjectId) -> Result<(), GitError> {
        let commit = commit.to_string();
        let checkout = ["checkout", "--quiet", "--detach", commit.as_str()];
        process::git_write(&checkout, &self.root, None)
            .map(drop)
            .map_err(|failure| failure.into_git("checkout"))
    }

    /// What changed from `from` to `to`, as `git diff` prints it, without colours or the user's
    /// diff programs.
    pub fn patch(&self, from: ObjectId, to: ObjectId) -> Result<String, GitError> {
        let range = format!("{from}..{to}");
        let diff = [
            "diff",
            "--no-color",
            "--no-ext-diff",
            "--no-textconv",
            range.as_str(),
        ];
        self.output("diff", &diff)
    }
}
