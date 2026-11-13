//! The core's views of git, as the protocol's records: the same facts, with what only the
//! server knows, who works in a checkout and why the last fetch failed, and an `id` for each
//! item of a list, so a list changes item by item.

use uraeda_core::api::{
    ChangeGroupView, CommitRowView, ConflictFileView, ConflictView, FileChangeView, GitCommitView,
    GitDiffView, GitHistoryPageView, GitPageView, GitSummaryView, StoppedView, WorktreeView,
};
use uraeda_core::changes::ChangedFile;
use uraeda_protocol::{
    ConflictFile, GitCommit, GitCommitFile, GitCommitRow, GitConflict, GitDiff, GitFile, GitGroup,
    GitHistoryPage, GitPage, GitStopped, GitSummary, GitWorktree,
};

/// The `id` of the main checkout's group: no feature's folder is `.`.
const MAIN: &str = ".";

/// What the server alone knows of a repository's page.
pub(super) struct Known {
    /// Whether a chat's agent works in the main checkout.
    pub chat_works: bool,
    /// The folders of the features whose agent works.
    pub working: Vec<String>,
    /// Why the last fetch failed.
    pub fetch_failure: Option<String>,
}

impl Known {
    /// Whether the agent of the feature in `folder` works.
    fn works(&self, folder: Option<&String>) -> bool {
        folder.is_some_and(|folder| self.working.contains(folder))
    }
}

pub(super) fn page(view: GitPageView, known: Known) -> GitPage {
    let groups = view.groups.into_iter();
    let worktrees = view.worktrees.into_iter();
    GitPage {
        agent_working: known.chat_works,
        branch: view.branch,
        detached: view.detached,
        has_remote: view.has_remote,
        ahead: view.ahead,
        behind: view.behind,
        fetched_at: view.fetched_at,
        groups: groups.map(|group| self::group(group, &known)).collect(),
        worktrees: worktrees.map(|tree| worktree(tree, &known)).collect(),
        fetch_failure: known.fetch_failure,
        stopped: view.stopped.map(stopped),
        conflicts: view.conflicts.into_iter().map(conflict).collect(),
        history: rows(view.history),
        has_more_history: view.has_more_history,
        branches: view.branches,
    }
}

fn stopped(view: StoppedView) -> GitStopped {
    GitStopped {
        kind: view.kind,
        ours: view.ours,
        theirs: view.theirs,
        stash: view.stash,
    }
}

fn group(view: ChangeGroupView, known: &Known) -> GitGroup {
    GitGroup {
        id: view.folder.clone().unwrap_or_else(|| MAIN.to_owned()),
        is_working: known.works(view.folder.as_ref()),
        folder: view.folder,
        name: view.name,
        files: view.files.into_iter().map(file).collect(),
        default_message: view.default_message,
    }
}

fn file(view: FileChangeView) -> GitFile {
    GitFile {
        id: view.path.clone(),
        path: view.path,
        state: view.state,
        staged: view.staged,
        added: view.added,
        removed: view.removed,
    }
}

fn conflict(view: ConflictView) -> GitConflict {
    GitConflict {
        id: view.path.clone(),
        path: view.path,
        kind: view.kind,
        is_binary: view.is_binary,
        is_resolved: view.is_resolved,
    }
}

fn rows(views: Vec<CommitRowView>) -> Vec<GitCommitRow> {
    let row = |view: CommitRowView| GitCommitRow {
        id: view.id,
        short: view.short,
        subject: view.subject,
        authored: view.authored,
        mark: view.mark,
    };
    views.into_iter().map(row).collect()
}

fn worktree(view: WorktreeView, known: &Known) -> GitWorktree {
    GitWorktree {
        id: view.path.clone(),
        path: view.path,
        name: view.name,
        branch: view.branch,
        is_working: known.works(view.folder.as_ref()),
        folder: view.folder,
        state: view.state,
    }
}

pub(super) fn summary(view: &GitSummaryView) -> GitSummary {
    GitSummary {
        changes: view.changes,
        behind: view.behind,
    }
}

pub(super) fn diff(view: GitDiffView) -> GitDiff {
    // A file's size is a whole number of bytes, which the core holds as a float for JavaScript.
    #[expect(
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss,
        reason = "a size in bytes is whole and not negative"
    )]
    let bytes = |size: f64| size as u64;
    GitDiff {
        path: view.path,
        text: view.text,
        binary_before: view.binary_before.map(bytes),
        binary_after: view.binary_after.map(bytes),
        added: view.added,
        removed: view.removed,
        is_capped: view.is_capped,
    }
}

pub(super) fn commit(view: GitCommitView) -> GitCommit {
    let file = |file: ChangedFile| GitCommitFile {
        path: file.path,
        added: file.added,
        removed: file.removed,
    };
    GitCommit {
        id: view.id,
        subject: view.subject,
        body: view.body,
        authored: view.authored,
        files: view.files.into_iter().map(file).collect(),
    }
}

pub(super) fn history(view: GitHistoryPageView) -> GitHistoryPage {
    GitHistoryPage {
        commits: rows(view.commits),
        has_more: view.has_more,
    }
}

pub(super) fn conflict_file(view: ConflictFileView) -> ConflictFile {
    ConflictFile {
        path: view.path,
        text: view.text,
        hash: view.hash,
    }
}
