//! The Git page's views: the main checkout's sync, changes, conflicts, the first page of its
//! history, and the repository's worktrees, in one read; the sidebar's count; and a file's diff, a
//! commit, a page of the history, and a conflicted file, each read when the page asks.
//!
//! A page's group is the main checkout, or a feature's worktree by the feature's folder: the web
//! never names a path to act on, [`group_root`] maps the group to its checkout.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::UNIX_EPOCH;

use super::{Result, find, refused};
use crate::cache;
use crate::files::document::hash;
use crate::git::{
    CommitInfo, ConflictKind, DiffOf, FileChange, FileState, Git, Mark, ObjectId, Staged,
    StoppedKind, WorktreeRecord,
};
use crate::steps::StepName;
use crate::view::feature_title;
use crate::workspace::{Feature, Workspace};

mod views;

pub use views::{
    ChangeGroupView, CommitRowView, ConflictFileView, ConflictView, FileChangeView, GitAt,
    GitCommitView, GitDiffView, GitHistoryPageView, GitPageView, GitSummaryView, StoppedView,
    WorktreeView,
};

/// The commits a page of the history holds.
const HISTORY_PAGE: usize = 50;

/// The Git page.
pub fn git_page(repo: &Path) -> Result<GitPageView> {
    let (git, workspace) = open_any(repo)?;
    let main = Git::open(&git.main_root())?;
    let state = main.checkout_state()?;
    let name = state
        .branch
        .clone()
        .or_else(|| state.detached.clone())
        .unwrap_or_else(|| "HEAD".to_string());
    let mut groups = vec![ChangeGroupView {
        folder: None,
        name,
        files: state.files.iter().map(file_view).collect(),
    }];
    let mut records = main.worktree_records()?;
    records.sort_by(|a, b| a.path.cmp(&b.path));
    let mut worktrees = Vec::new();
    for record in records {
        let feature = workspace.as_deref().and_then(|w| feature_on(w, &record));
        let changes = !record.missing && has_changes(&record.path);
        if let Some(feature) = feature.filter(|_| changes) {
            groups.push(ChangeGroupView {
                folder: Some(feature.folder.clone()),
                name: feature_title(feature),
                files: Git::open(&record.path)?
                    .checkout_state()?
                    .files
                    .iter()
                    .map(file_view)
                    .collect(),
            });
        }
        worktrees.push(worktree_view(&main, &record, feature, changes));
    }
    let mut history = rows(main.history_page(None, HISTORY_PAGE + 1)?);
    let has_more_history = history.len() > HISTORY_PAGE;
    history.truncate(HISTORY_PAGE);
    Ok(GitPageView {
        id: "git".to_string(),
        has_remote: state.has_remote,
        ahead: state.ahead,
        behind: state.behind,
        fetched_at: main
            .fetched_at()
            .and_then(|at| at.duration_since(UNIX_EPOCH).ok())
            .map(|at| at.as_secs() as i64),
        stopped: state.stopped.map(|stopped| StoppedView {
            kind: match stopped.kind {
                StoppedKind::Pull => "pull",
                StoppedKind::Merge => "merge",
                StoppedKind::Stash => "stash",
            }
            .to_string(),
            ours: stopped.ours,
            theirs: stopped.theirs,
            stash: stopped.stash,
        }),
        conflicts: state
            .conflicts
            .iter()
            .map(|conflict| ConflictView {
                path: conflict.path.clone(),
                kind: conflict_kind(conflict.kind).to_string(),
                is_binary: conflict.is_binary,
                is_resolved: conflict.is_resolved,
            })
            .collect(),
        branches: merge_candidates(&main, state.branch.as_deref())?,
        branch: state.branch,
        detached: state.detached,
        groups,
        history,
        has_more_history,
        worktrees,
    })
}

/// The sidebar's count, without counting any file's lines.
pub fn git_summary(repo: &Path) -> Result<GitSummaryView> {
    let (git, workspace) = open_any(repo)?;
    let main = Git::open(&git.main_root())?;
    let mut changes = main.changed_count()?;
    if let Some(workspace) = workspace.as_deref() {
        for record in main.worktree_records()? {
            if record.missing || feature_on(workspace, &record).is_none() {
                continue;
            }
            let worktree = Git::open(&record.path)?;
            if worktree.has_local_changes()? {
                changes += worktree.changed_count()?;
            }
        }
    }
    let branch = main.current_branch().or_else(|| main.rebasing());
    let behind = branch
        .and_then(|branch| Some((main.tip(&branch)?, main.remote_tip(&branch)?)))
        .map_or(0, |(local, remote)| main.behind(local, remote) as u32);
    Ok(GitSummaryView {
        id: "git".to_string(),
        changes,
        behind,
    })
}

/// The diff of the file at `path`, capped past 1,000 lines unless `whole`.
pub fn git_diff(repo: &Path, at: &GitAt, path: &str, whole: bool) -> Result<GitDiffView> {
    let git = Git::discover(repo)?;
    let (diff, of) = match &at.commit {
        Some(commit) => {
            let main = Git::open(&git.main_root())?;
            let id = commit_id(&main, commit)?;
            (
                main.file_diff(DiffOf::Commit(id), path, whole)?,
                id.to_string(),
            )
        }
        None => {
            let root = match at.folder.as_deref() {
                None => git.main_root(),
                Some(folder) => {
                    let (_, workspace) = super::open(repo)?;
                    group_root(&git, &workspace, Some(folder))?
                }
            };
            let checkout = Git::open(&root)?;
            let path = checkout.checked(path)?;
            let diff = checkout.file_diff(DiffOf::Worktree, path, whole)?;
            (diff, at.folder.clone().unwrap_or_default())
        }
    };
    Ok(GitDiffView {
        id: format!("{of}:{}", diff.path),
        path: diff.path,
        text: diff.text,
        binary_before: diff.binary.map(|(before, _)| before as f64),
        binary_after: diff.binary.map(|(_, after)| after as f64),
        added: diff.added,
        removed: diff.removed,
        is_capped: diff.is_capped,
    })
}

/// A commit of the main checkout's history, with the files it changed.
pub fn git_commit(repo: &Path, id: &str) -> Result<GitCommitView> {
    let main = Git::open(&Git::discover(repo)?.main_root())?;
    let commit = main.commit_files(commit_id(&main, id)?)?;
    Ok(GitCommitView {
        id: commit.id.to_string(),
        subject: commit.subject,
        body: commit.body,
        authored: commit.authored,
        files: commit.files,
    })
}

/// The page of the main checkout's history after the commit `after`.
pub fn git_history(repo: &Path, after: &str) -> Result<GitHistoryPageView> {
    let main = Git::open(&Git::discover(repo)?.main_root())?;
    let id = commit_id(&main, after)?;
    let mut commits = rows(main.history_page(Some(id), HISTORY_PAGE + 1)?);
    let has_more = commits.len() > HISTORY_PAGE;
    commits.truncate(HISTORY_PAGE);
    Ok(GitHistoryPageView {
        id: after.to_string(),
        commits,
        has_more,
    })
}

/// A conflicted text file of the main checkout, as it is on disk. Refused for a file that is not
/// conflicted, or binary.
pub fn conflict_file(repo: &Path, path: &str) -> Result<ConflictFileView> {
    let root = Git::discover(repo)?.main_root();
    let main = Git::open(&root)?;
    let state = main.checkout_state()?;
    let conflict = state
        .conflicts
        .iter()
        .find(|conflict| conflict.path == path)
        .ok_or_else(|| refused(format!("{path} has no conflict.")))?;
    if conflict.is_binary {
        return Err(refused(format!(
            "{path} is binary: take a side whole instead."
        )));
    }
    let bytes = std::fs::read(root.join(&conflict.path)).unwrap_or_default();
    let text = String::from_utf8(bytes)
        .map_err(|_| refused(format!("{path} is not text: take a side whole instead.")))?;
    Ok(ConflictFileView {
        id: path.to_string(),
        path: path.to_string(),
        hash: hash(&text),
        text,
    })
}

/// The checkout a page's group acts on: the main checkout for no folder, else the worktree of the
/// feature at `folder`, which must exist. Anything else is refused.
pub(crate) fn group_root(
    git: &Git,
    workspace: &Workspace,
    folder: Option<&str>,
) -> Result<PathBuf> {
    let Some(folder) = folder else {
        return Ok(git.main_root());
    };
    let feature = find(workspace, folder)?;
    git.worktree_records()?
        .into_iter()
        .find(|record| {
            !record.missing && feature_on(workspace, record).is_some_and(|f| f.folder == folder)
        })
        .map(|record| record.path)
        .ok_or_else(|| refused(format!("{} has no worktree.", feature.folder)))
}

/// The repository, with its workspace when it has `specs/`: the page reads git alone without one.
fn open_any(repo: &Path) -> Result<(Git, Option<Arc<Workspace>>)> {
    let git = Git::discover(repo)?;
    let workspace = cache::read(&git)
        .ok()
        .map(|read| Arc::clone(&read.workspace));
    Ok((git, workspace))
}

/// The feature whose branch a worktree has checked out, merged ones included.
fn feature_on<'a>(workspace: &'a Workspace, record: &WorktreeRecord) -> Option<&'a Feature> {
    let branch = record.branch.as_deref()?;
    workspace.features.iter().find(|feature| {
        feature.branch.as_deref().or(feature.left_branch.as_deref()) == Some(branch)
    })
}

/// Whether a worktree has changes: one that cannot be read counts as having some, so nothing
/// offers to remove it.
fn has_changes(root: &Path) -> bool {
    Git::open(root)
        .and_then(|git| git.has_local_changes())
        .unwrap_or(true)
}

fn worktree_view(
    main: &Git,
    record: &WorktreeRecord,
    feature: Option<&Feature>,
    changes: bool,
) -> WorktreeView {
    let main_root = main.root();
    let state = if record.missing {
        "missing"
    } else if changes {
        "changes"
    } else if record.locked {
        "locked"
    } else if feature.is_some_and(|feature| feature.step.name == StepName::Done) {
        "merged"
    } else {
        "clean"
    };
    let folder_name = record
        .path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    WorktreeView {
        path: record
            .path
            .strip_prefix(main_root)
            .unwrap_or(&record.path)
            .to_string_lossy()
            .into_owned(),
        name: feature.map_or(folder_name, feature_title),
        branch: record.branch.clone(),
        folder: feature.map(|feature| feature.folder.clone()),
        state: state.to_string(),
    }
}

fn file_view(file: &FileChange) -> FileChangeView {
    FileChangeView {
        path: file.path.clone(),
        state: match file.state {
            FileState::Modified => "modified",
            FileState::New => "new",
            FileState::Deleted => "deleted",
        }
        .to_string(),
        staged: match file.staged {
            Staged::No => "no",
            Staged::Yes => "yes",
            Staged::Partly => "partly",
        }
        .to_string(),
        added: file.added,
        removed: file.removed,
    }
}

fn conflict_kind(kind: ConflictKind) -> &'static str {
    match kind {
        ConflictKind::BothChanged => "both-changed",
        ConflictKind::BothAdded => "both-added",
        ConflictKind::DeletedOurs => "deleted-ours",
        ConflictKind::DeletedTheirs => "deleted-theirs",
        ConflictKind::BothDeleted => "both-deleted",
        ConflictKind::AddedOurs => "added-ours",
        ConflictKind::AddedTheirs => "added-theirs",
    }
}

fn rows(commits: Vec<(CommitInfo, Mark)>) -> Vec<CommitRowView> {
    commits
        .into_iter()
        .map(|(commit, mark)| CommitRowView {
            id: commit.id.to_string(),
            short: commit.id.to_hex_with_len(7).to_string(),
            subject: commit.subject,
            authored: commit.authored,
            mark: match mark {
                Mark::None => "",
                Mark::ToPull => "pull",
                Mark::ToPush => "push",
            }
            .to_string(),
        })
        .collect()
}

/// The other local branches, then `origin`'s, each sorted.
fn merge_candidates(git: &Git, current: Option<&str>) -> Result<Vec<String>> {
    let branches = git.branches()?;
    let local = branches
        .iter()
        .filter(|branch| branch.local.is_some() && Some(branch.name.as_str()) != current)
        .map(|branch| branch.name.clone());
    let remote = branches
        .iter()
        .filter(|branch| branch.remote.is_some())
        .map(|branch| format!("origin/{}", branch.name));
    Ok(local.chain(remote).collect())
}

/// The commit a full or short id names.
fn commit_id(git: &Git, id: &str) -> Result<ObjectId> {
    let hex = !id.is_empty() && id.bytes().all(|byte| byte.is_ascii_hexdigit());
    hex.then(|| git.resolve(id))
        .flatten()
        .ok_or_else(|| refused(format!("no commit {id}")))
}
