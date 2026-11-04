//! The Git page's views, each a napi object with camelCase fields.

use serde::Serialize;

use crate::changes::ChangedFile;

/// The Git page, read at once.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitPageView {
    /// Always `git`: the page is one view.
    pub id: String,
    /// The main checkout's branch, or the one a stopped rebase replays.
    pub branch: Option<String>,
    /// `HEAD`'s short id when it is detached and nothing is stopped.
    pub detached: Option<String>,
    pub has_remote: bool,
    pub ahead: u32,
    pub behind: u32,
    /// When `origin` was last fetched, in Unix seconds.
    pub fetched_at: Option<i64>,
    pub stopped: Option<StoppedView>,
    /// The main checkout's group first, always there, then each feature's worktree with changes.
    pub groups: Vec<ChangeGroupView>,
    /// The main checkout's conflicted files.
    pub conflicts: Vec<ConflictView>,
    /// The history's first page.
    pub history: Vec<CommitRowView>,
    pub has_more_history: bool,
    /// The linked worktrees, by path.
    pub worktrees: Vec<WorktreeView>,
    /// The branches a merge into the checked-out one may pick: the other local ones, then
    /// `origin`'s, as `origin/<name>`.
    pub branches: Vec<String>,
}

/// The operation the main checkout stopped in, its sides named by branch.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoppedView {
    /// `pull`, `merge`, or `stash`.
    pub kind: String,
    /// Git's stage 2, like `origin/main` during a pull.
    pub ours: String,
    /// Git's stage 3.
    pub theirs: String,
    /// The stash a stash's stop kept, like `stash@{0}`.
    pub stash: Option<String>,
}

/// The changed files of one checkout.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeGroupView {
    /// The feature's folder; none for the main checkout.
    pub folder: Option<String>,
    /// The main checkout's branch, or the feature's title.
    pub name: String,
    /// Sorted by path; a conflicted file is under the page's conflicts instead.
    pub files: Vec<FileChangeView>,
}

/// A changed file of a group.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangeView {
    /// From the checkout's top level.
    pub path: String,
    /// `modified`, `new`, or `deleted`.
    pub state: String,
    /// `no`, `yes`, or `partly`.
    pub staged: String,
    /// Lines added and removed from `HEAD`; none for a binary file.
    pub added: Option<u32>,
    pub removed: Option<u32>,
}

/// A conflicted file of the main checkout.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictView {
    /// A renamed file's new path.
    pub path: String,
    /// `both-changed`, `both-added`, `deleted-ours`, `deleted-theirs`, `both-deleted`,
    /// `added-ours`, or `added-theirs`; `ours` is the stopped operation's `ours` side.
    pub kind: String,
    pub is_binary: bool,
    pub is_resolved: bool,
}

/// A commit of the history.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitRowView {
    pub id: String,
    /// Its first 7 characters.
    pub short: String,
    pub subject: String,
    /// In Unix seconds.
    pub authored: i64,
    /// `pull` for a commit only `origin` has, `push` for one only the branch has, else empty.
    pub mark: String,
}

/// A linked worktree.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeView {
    /// From the main checkout's top level, or absolute outside it.
    pub path: String,
    /// The feature's title, else its folder's name.
    pub name: String,
    pub branch: Option<String>,
    /// The folder of the feature on its branch.
    pub folder: Option<String>,
    /// `missing`, `changes`, `locked`, `merged` for a feature done, or `clean`, the first that
    /// holds.
    pub state: String,
}

/// The sidebar's count.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitSummaryView {
    /// Always `git`.
    pub id: String,
    /// The changed and conflicted files of every group.
    pub changes: u32,
    /// The commits to pull into the main checkout's branch.
    pub behind: u32,
}

/// What a diff is of: a commit of the main checkout's history, else a group's working tree, the
/// main checkout's for no folder.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct GitAt {
    pub folder: Option<String>,
    pub commit: Option<String>,
}

/// A file's diff.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffView {
    /// What it is of and its path: `<commit or folder or "">:<path>`.
    pub id: String,
    pub path: String,
    /// The unified diff; none for a binary file, or one capped.
    pub text: Option<String>,
    /// A binary file's sizes before and after, in bytes.
    pub binary_before: Option<f64>,
    pub binary_after: Option<f64>,
    pub added: u32,
    pub removed: u32,
    /// Over 1,000 lines, and the whole was not asked for.
    pub is_capped: bool,
}

/// A commit, with the files it changed.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitView {
    /// Its full id.
    pub id: String,
    pub subject: String,
    pub body: String,
    pub authored: i64,
    pub files: Vec<ChangedFile>,
}

/// A page of the history, after a commit.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHistoryPageView {
    /// The commit it continues after.
    pub id: String,
    pub commits: Vec<CommitRowView>,
    pub has_more: bool,
}

/// A conflicted text file of the main checkout, for the editor.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictFileView {
    /// Its path.
    pub id: String,
    pub path: String,
    pub text: String,
    /// What a save over it names, to be refused when it changed since.
    pub hash: String,
}
