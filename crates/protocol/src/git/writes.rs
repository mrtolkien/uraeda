//! The Git page's writes: each lands in the repository's write queue, under its `write`, and
//! answers once it landed.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::ConflictFile;
use crate::registry::Action;
use crate::shared::WriteName;

/// Declares an action of the page that answers nothing: what it changed shows in the records.
macro_rules! writes {
    ($($action:ident = $name:literal;)*) => {
        $(impl Action for $action {
            const NAME: &'static str = $name;
            type Input = Self;
            type Output = ();
        })*
    };
}

writes! {
    GitAbort = "git.abort";
    GitClean = "git.clean";
    GitCommitStaged = "git.commit";
    GitContinue = "git.continue";
    GitDiscard = "git.discard";
    GitFetch = "git.fetch";
    GitMerge = "git.merge";
    GitPull = "git.pull";
    GitPush = "git.push";
    GitRemoveWorktree = "git.removeWorktree";
    GitResolve = "git.resolve";
    GitStage = "git.stage";
    GitUnstage = "git.unstage";
}

/// Aborts the main checkout's stopped pull or merge.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitAbort {
    /// The repository's name.
    pub repo: String,
    /// The name the write queue shows it under while it lands: the page's own when none.
    #[serde(default)]
    pub write: Option<WriteName>,
}

/// Cleans a merged feature, as `ura clean` does: its worktree, its branch, and its line of the
/// priorities. Refused, after what it could do, when something stays.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitClean {
    /// The repository's name.
    pub repo: String,
    /// The name the write queue shows it under while it lands: the page's own when none.
    #[serde(default)]
    pub write: Option<WriteName>,
    /// The feature's folder.
    pub folder: String,
}

/// Commits what is staged in a group's checkout, through the repository's hooks. A hook's
/// refusal is the error `hook`, with its output, and leaves the files staged.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitStaged {
    /// The repository's name.
    pub repo: String,
    /// The name the write queue shows it under while it lands: the page's own when none.
    #[serde(default)]
    pub write: Option<WriteName>,
    /// The group's folder; none for the main checkout.
    #[serde(default)]
    pub folder: Option<String>,
    /// The message, as typed: a blank one takes the group's `defaultMessage`.
    pub message: String,
}

/// Continues the main checkout's stopped pull or merge, once its conflicts are resolved.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitContinue {
    /// The repository's name.
    pub repo: String,
    /// The name the write queue shows it under while it lands: the page's own when none.
    #[serde(default)]
    pub write: Option<WriteName>,
}

/// Discards the changes to a file of a group's checkout.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitDiscard {
    /// The repository's name.
    pub repo: String,
    /// The name the write queue shows it under while it lands: the page's own when none.
    #[serde(default)]
    pub write: Option<WriteName>,
    /// The group's folder; none for the main checkout.
    #[serde(default)]
    pub folder: Option<String>,
    /// The file, from the checkout's top level.
    pub path: String,
}

/// Fetches `origin` in the main checkout.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitFetch {
    /// The repository's name.
    pub repo: String,
    /// The name the write queue shows it under while it lands: the page's own when none.
    #[serde(default)]
    pub write: Option<WriteName>,
    /// Whether the fetch is the page's own, as it opens, and not a person's: it never fails,
    /// and the page's `fetchFailure` says why it brought nothing.
    #[serde(default)]
    pub quiet: bool,
}

/// Merges a branch into the main checkout's branch.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitMerge {
    /// The repository's name.
    pub repo: String,
    /// The name the write queue shows it under while it lands: the page's own when none.
    #[serde(default)]
    pub write: Option<WriteName>,
    /// One of the page's `branches`.
    pub branch: String,
}

/// Pulls the main checkout's branch from `origin`, rebasing unless git's configuration says how
/// to pull. A pull that stops on a conflict succeeds: the page shows the stop.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitPull {
    /// The repository's name.
    pub repo: String,
    /// The name the write queue shows it under while it lands: the page's own when none.
    #[serde(default)]
    pub write: Option<WriteName>,
}

/// Pushes the main checkout's branch to `origin`, never forced.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitPush {
    /// The repository's name.
    pub repo: String,
    /// The name the write queue shows it under while it lands: the page's own when none.
    #[serde(default)]
    pub write: Option<WriteName>,
}

/// Removes a linked worktree, never forced: one with changes, or locked, is refused. Its branch
/// stays.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitRemoveWorktree {
    /// The repository's name.
    pub repo: String,
    /// The name the write queue shows it under while it lands: the page's own when none.
    #[serde(default)]
    pub write: Option<WriteName>,
    /// The worktree's `path`, as the page lists it.
    pub path: String,
}

/// Resolves a conflicted file of the main checkout with a side whole, or by deleting it, and
/// stages it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitResolve {
    /// The repository's name.
    pub repo: String,
    /// The name the write queue shows it under while it lands: the page's own when none.
    #[serde(default)]
    pub write: Option<WriteName>,
    /// The file, from the checkout's top level.
    pub path: String,
    /// The side to take, as git names them, or `delete`.
    #[ts(type = "\"ours\" | \"theirs\" | \"delete\"")]
    pub resolution: String,
}

/// Saves the editor's text over a conflicted file of the main checkout, and answers the file
/// with its new hash, which the next save names. It never stages: `git.continue` does.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitSaveConflict {
    /// The repository's name.
    pub repo: String,
    /// The name the write queue shows it under while it lands: the page's own when none.
    #[serde(default)]
    pub write: Option<WriteName>,
    /// The file, from the checkout's top level.
    pub path: String,
    /// Its new text.
    pub text: String,
    /// The `hash` of the file as it was read: the error `conflict` when it changed since.
    pub hash: String,
}

impl Action for GitSaveConflict {
    const NAME: &'static str = "git.saveConflict";
    type Input = Self;
    type Output = ConflictFile;
}

/// Stages files or folders of a group's checkout.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitStage {
    /// The repository's name.
    pub repo: String,
    /// The name the write queue shows it under while it lands: the page's own when none.
    #[serde(default)]
    pub write: Option<WriteName>,
    /// The group's folder; none for the main checkout.
    #[serde(default)]
    pub folder: Option<String>,
    /// Files or folders, from the checkout's top level.
    pub paths: Vec<String>,
}

/// Unstages files or folders of a group's checkout.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitUnstage {
    /// The repository's name.
    pub repo: String,
    /// The name the write queue shows it under while it lands: the page's own when none.
    #[serde(default)]
    pub write: Option<WriteName>,
    /// The group's folder; none for the main checkout.
    #[serde(default)]
    pub folder: Option<String>,
    /// Files or folders, from the checkout's top level.
    pub paths: Vec<String>,
}
