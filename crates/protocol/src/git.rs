//! Git: the page of a repository's checkouts, the sidebar's count, a file's diff, a commit, a
//! page of the history, a conflicted file, and the page's writes.
//!
//! A record's or an action's `repo` is the repository's name in the server's list. A group is a
//! checkout with changes: the main checkout's for no `folder`, else the worktree of the feature
//! in that folder. A client never names a checkout's path to act on.
//!
//! Every write lands in the repository's write queue, after the writes made before it, and
//! answers once it landed. Its `write` names it there, for the toast: the page's own name when
//! none is given.

mod writes;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub use writes::{
    GitAbort, GitClean, GitCommitStaged, GitContinue, GitDiscard, GitFetch, GitMerge, GitPull,
    GitPush, GitRemoveWorktree, GitResolve, GitSaveConflict, GitStage, GitUnstage,
};

use crate::registry::Record;
use crate::shared::RepositoryArgs;

/// The Git page: the main checkout's sync, changes, conflicts, and the first page of its
/// history, each feature's worktree with changes, and every worktree.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitPage {
    /// Whether a chat's agent works in the main checkout, which refuses the page's writes there.
    pub agent_working: bool,
    /// The main checkout's branch, or the one a stopped rebase replays.
    pub branch: Option<String>,
    /// `HEAD`'s short id when it is detached and nothing is stopped.
    pub detached: Option<String>,
    /// Whether the repository has an `origin`.
    pub has_remote: bool,
    /// The commits to push.
    pub ahead: u32,
    /// The commits to pull.
    pub behind: u32,
    /// When `origin` was last fetched, in Unix seconds.
    pub fetched_at: Option<i64>,
    /// Why the last fetch in the background failed, until one succeeds.
    pub fetch_failure: Option<String>,
    /// The pull or the merge the main checkout stopped in.
    pub stopped: Option<GitStopped>,
    /// The main checkout's group first, always there, then each feature's worktree with changes.
    pub groups: Vec<GitGroup>,
    /// The main checkout's conflicted files.
    pub conflicts: Vec<GitConflict>,
    /// The first page of the history.
    pub history: Vec<GitCommitRow>,
    /// Whether the history goes on after that page.
    pub has_more_history: bool,
    /// The linked worktrees, by path.
    pub worktrees: Vec<GitWorktree>,
    /// The branches a merge into the checked-out one may pick: the other local ones, then
    /// `origin`'s, as `origin/<name>`.
    pub branches: Vec<String>,
}

impl Record for GitPage {
    const NAME: &'static str = "GitPage";
    type Args = RepositoryArgs;
    type Value = Self;
}

/// The operation the main checkout stopped in, its sides named by branch.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitStopped {
    /// What stopped.
    #[ts(type = "\"pull\" | \"merge\" | \"stash\"")]
    pub kind: String,
    /// Git's stage 2, like `origin/main` during a pull.
    pub ours: String,
    /// Git's stage 3.
    pub theirs: String,
    /// The stash a stash's stop kept, like `stash@{0}`.
    pub stash: Option<String>,
}

/// The changed files of one checkout.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitGroup {
    /// The feature's folder, or `.` for the main checkout's.
    pub id: String,
    /// The feature's folder, as the page's writes name the group; none for the main checkout.
    pub folder: Option<String>,
    /// The main checkout's branch, or the feature's title.
    pub name: String,
    /// Sorted by path. A conflicted file is under the page's conflicts instead.
    pub files: Vec<GitFile>,
    /// The message a commit takes when none is typed, from what is staged; none when nothing is.
    pub default_message: Option<String>,
    /// Whether its feature's agent works, which refuses its writes.
    pub is_working: bool,
}

/// A changed file of a group.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitFile {
    /// Its path.
    pub id: String,
    /// From the checkout's top level.
    pub path: String,
    /// What happened to it.
    #[ts(type = "\"modified\" | \"new\" | \"deleted\"")]
    pub state: String,
    /// How much of its change the next commit holds.
    #[ts(type = "\"no\" | \"yes\" | \"partly\"")]
    pub staged: String,
    /// Lines added from `HEAD`; none for a binary file, or one past 1 MiB.
    pub added: Option<u32>,
    /// Lines removed from `HEAD`; none for a binary file, or one past 1 MiB.
    pub removed: Option<u32>,
}

/// A conflicted file of the main checkout.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitConflict {
    /// Its path.
    pub id: String,
    /// From the checkout's top level; a renamed file's new path.
    pub path: String,
    /// How its two sides differ: `ours` is the stopped operation's `ours` side.
    #[ts(
        type = "\"both-changed\" | \"both-added\" | \"deleted-ours\" | \"deleted-theirs\" | \"both-deleted\" | \"added-ours\" | \"added-theirs\""
    )]
    pub kind: String,
    /// Whether it is binary: only a side taken whole resolves it.
    pub is_binary: bool,
    /// Whether it is resolved, and waits for the operation to continue.
    pub is_resolved: bool,
}

/// A commit of the history.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitRow {
    /// Its full id.
    pub id: String,
    /// Its first 7 characters.
    pub short: String,
    /// Its message's first line.
    pub subject: String,
    /// When it was authored, in Unix seconds.
    pub authored: i64,
    /// `pull` for a commit only `origin` has, `push` for one only the branch has, else empty.
    #[ts(type = "\"\" | \"pull\" | \"push\"")]
    pub mark: String,
}

/// A linked worktree.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitWorktree {
    /// Its path.
    pub id: String,
    /// From the main checkout's top level, or absolute outside it: what `git.removeWorktree`
    /// names.
    pub path: String,
    /// The feature's title, else its folder's name.
    pub name: String,
    /// The branch it has checked out.
    pub branch: Option<String>,
    /// The folder of the feature on its branch.
    pub folder: Option<String>,
    /// The first that holds: `merged` is a feature that is done.
    #[ts(type = "\"missing\" | \"changes\" | \"locked\" | \"merged\" | \"clean\"")]
    pub state: String,
    /// Whether its feature's agent works, which refuses its cleaning and its removal.
    pub is_working: bool,
}

/// The sidebar's count.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitSummary {
    /// The main checkout's changed and conflicted files: a feature worktree's are not counted.
    pub changes: u32,
    /// The commits to pull into the main checkout's branch.
    pub behind: u32,
}

impl Record for GitSummary {
    const NAME: &'static str = "GitSummary";
    type Args = RepositoryArgs;
    type Value = Self;
}

/// Which diff: of a file in a commit of the main checkout's history, else in a group's working
/// tree.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffArgs {
    /// The repository's name.
    pub repo: String,
    /// The group's folder; none for the main checkout, or with a commit.
    #[serde(default)]
    pub folder: Option<String>,
    /// The commit's id; none for a working tree.
    #[serde(default)]
    pub commit: Option<String>,
    /// The file, from the checkout's top level.
    pub path: String,
    /// Whether to give the whole diff, past 1,000 lines.
    #[serde(default)]
    pub whole: bool,
}

/// A file's diff.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitDiff {
    /// The file, from the checkout's top level.
    pub path: String,
    /// The unified diff; none for a binary file, or one capped.
    pub text: Option<String>,
    /// A binary file's size before, in bytes.
    pub binary_before: Option<u64>,
    /// A binary file's size after, in bytes.
    pub binary_after: Option<u64>,
    /// Lines added.
    pub added: u32,
    /// Lines removed.
    pub removed: u32,
    /// Whether it is over 1,000 lines, and the whole was not asked for.
    pub is_capped: bool,
}

impl Record for GitDiff {
    const NAME: &'static str = "GitDiff";
    type Args = GitDiffArgs;
    type Value = Self;
}

/// Which commit of the main checkout's history.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitArgs {
    /// The repository's name.
    pub repo: String,
    /// The commit's id, full or short.
    pub id: String,
}

/// A commit, with the files it changed.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitCommit {
    /// Its full id.
    pub id: String,
    /// Its message's first line.
    pub subject: String,
    /// The rest of its message.
    pub body: String,
    /// When it was authored, in Unix seconds.
    pub authored: i64,
    /// The files it changed.
    pub files: Vec<GitCommitFile>,
}

impl Record for GitCommit {
    const NAME: &'static str = "GitCommit";
    type Args = GitCommitArgs;
    type Value = Self;
}

/// A file a commit changed.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitFile {
    /// From the repository's top level; the new path of a renamed file.
    pub path: String,
    /// Lines added; none for a binary file.
    pub added: Option<u32>,
    /// Lines removed; none for a binary file.
    pub removed: Option<u32>,
}

/// Which page of the main checkout's history.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitHistoryArgs {
    /// The repository's name.
    pub repo: String,
    /// The id of the commit the page continues after: the last one of the page before.
    pub after: String,
}

/// A page of the history, after a commit.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitHistoryPage {
    /// The next commits, the newest first.
    pub commits: Vec<GitCommitRow>,
    /// Whether the history goes on after them.
    pub has_more: bool,
}

impl Record for GitHistoryPage {
    const NAME: &'static str = "GitHistoryPage";
    type Args = GitHistoryArgs;
    type Value = Self;
}

/// Which conflicted file of the main checkout.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ConflictFileArgs {
    /// The repository's name.
    pub repo: String,
    /// The file, from the checkout's top level.
    pub path: String,
}

/// A conflicted text file of the main checkout, for the editor.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ConflictFile {
    /// The file, from the checkout's top level.
    pub path: String,
    /// Its text as it is on disk, with git's conflict markers.
    pub text: String,
    /// What a save over it names, to be refused when the file changed since.
    pub hash: String,
}

impl Record for ConflictFile {
    const NAME: &'static str = "ConflictFile";
    type Args = ConflictFileArgs;
    type Value = Self;
}
