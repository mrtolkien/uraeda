//! What a checkout holds, read through gix: its branch and the commits it has to pull and to push
//! against `origin`, the operation it stopped in, its changed files with how much of each is
//! staged, and its conflicts, from the index's stages.

use std::collections::BTreeMap;

use gix::diff::index::Change;
use gix::index::entry::Stage;
use gix::status::index_worktree::iter::Summary;

use super::diff::{is_binary as is_binary_blob, line_counts, on_disk, starts_binary};
use super::{Git, GitError, ObjectId, Stopped, read_error};

/// The largest file, in bytes, whose lines the state counts: a bigger one is listed without counts,
/// as a binary one is, so a big text file is not diffed on every read of the page.
pub(super) const COUNT_CAP: usize = 1 << 20;

/// How a file differs from `HEAD`: an untracked file, or one staged as added, is `New`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FileState {
    Modified,
    New,
    Deleted,
}

/// How much of a file's change is staged: all of it, some, as when it changed again since, or
/// none.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Staged {
    No,
    Yes,
    Partly,
}

/// A changed file, not conflicted.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FileChange {
    /// From the repository's top level, as itself, never quoted.
    pub path: String,
    pub state: FileState,
    pub staged: Staged,
    /// Lines added and removed from `HEAD` to the file on disk; `None` for a binary file, or one
    /// past 1 MiB, its lines never counted on a read.
    pub added: Option<u32>,
    pub removed: Option<u32>,
}

/// How a file conflicts, git's `UU AA DU UD DD AU UA`, by the side that did it: `DeletedOurs` is
/// deleted on `ours`, git's stage 2, and changed on `theirs`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ConflictKind {
    BothChanged,
    BothAdded,
    DeletedOurs,
    DeletedTheirs,
    BothDeleted,
    AddedOurs,
    AddedTheirs,
}

/// A conflicted file.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Conflict {
    pub path: String,
    pub kind: ConflictKind,
    /// A side is binary, so its sides are taken whole, without the editor.
    pub is_binary: bool,
    /// A text both sides have whose file on disk holds no marker line, `<<<<<<< ` nor
    /// `>>>>>>> `. A binary or a delete conflict is never resolved here: git writes it no markers,
    /// so only taking a side whole resolves it, which takes it out of the conflicts.
    pub is_resolved: bool,
}

/// What a checkout holds.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CheckoutState {
    /// The branch checked out, or the one a stopped rebase replays.
    pub branch: Option<String>,
    /// `HEAD`'s 7-character id when it is detached and nothing is stopped.
    pub detached: Option<String>,
    /// Whether the repository has an `origin` remote.
    pub has_remote: bool,
    /// Commits the branch has that `origin/<branch>` lacks, 0 without one.
    pub ahead: u32,
    /// Commits `origin/<branch>` has that the branch lacks, 0 without one.
    pub behind: u32,
    pub stopped: Option<Stopped>,
    /// Sorted by path; a conflicted file is only in `conflicts`.
    pub files: Vec<FileChange>,
    /// Sorted by path.
    pub conflicts: Vec<Conflict>,
}

/// A changed file before its lines are counted: how it differs from `HEAD` in the index, and in
/// the working tree from the index.
#[derive(Default)]
struct Row {
    staged: Option<FileState>,
    unstaged: Option<FileState>,
}

impl Row {
    /// How the file on disk differs from `HEAD`.
    fn state(&self) -> FileState {
        match (self.staged, self.unstaged) {
            (_, Some(FileState::Deleted)) => FileState::Deleted,
            (Some(FileState::Deleted), Some(_)) => FileState::Modified,
            (Some(staged), _) => staged,
            (None, unstaged) => unstaged.unwrap_or(FileState::Modified),
        }
    }

    fn staged(&self) -> Staged {
        match (self.staged, self.unstaged) {
            (Some(_), None) => Staged::Yes,
            (Some(_), Some(_)) => Staged::Partly,
            (None, _) => Staged::No,
        }
    }
}

impl Git {
    /// What this checkout holds, each file's lines counted.
    pub fn checkout_state(&self) -> Result<CheckoutState, GitError> {
        let stopped = self.stopped();
        let branch = self.current_branch().or_else(|| self.rebasing());
        let detached = match (&branch, &stopped) {
            (None, None) => self.head().map(|id| id.to_hex_with_len(7).to_string()),
            _ => None,
        };
        let (ahead, behind) = branch.as_deref().map_or((0, 0), |branch| self.sync(branch));
        let conflicts = self.conflicts()?;
        let mut files = Vec::new();
        for (path, row) in self.rows(&conflicts)? {
            // A binary file on disk is told from its first bytes, and a big one from its size,
            // never read whole.
            let big = std::fs::symlink_metadata(self.root.join(&path))
                .is_ok_and(|meta| meta.len() > COUNT_CAP as u64);
            let counts = if big || starts_binary(&self.root, &path) {
                None
            } else {
                let before = self.at_head(&path)?.unwrap_or_default();
                if before.len() > COUNT_CAP {
                    None
                } else {
                    line_counts(&before, &on_disk(&self.root, &path)?.unwrap_or_default())
                }
            };
            files.push(FileChange {
                state: row.state(),
                staged: row.staged(),
                added: counts.map(|(added, _)| added),
                removed: counts.map(|(_, removed)| removed),
                path,
            });
        }
        Ok(CheckoutState {
            has_remote: self.has_origin(),
            branch,
            detached,
            ahead,
            behind,
            stopped,
            files,
            conflicts,
        })
    }

    /// How many files changed or conflict here, without counting their lines.
    pub fn changed_count(&self) -> Result<u32, GitError> {
        let conflicts = self.conflicts()?;
        Ok((self.rows(&conflicts)?.len() + conflicts.len()) as u32)
    }

    /// The commits `branch` has to push and to pull against `origin/<branch>`.
    fn sync(&self, branch: &str) -> (u32, u32) {
        let local = self
            .repo
            .try_find_reference(format!("refs/heads/{branch}").as_str())
            .ok()
            .flatten()
            .and_then(|mut reference| reference.peel_to_id().ok().map(|id| id.detach()));
        match (local, self.remote_tip(branch)) {
            (Some(local), Some(remote)) => (
                self.behind(remote, local) as u32,
                self.behind(local, remote) as u32,
            ),
            _ => (0, 0),
        }
    }

    /// Each changed file not in `conflicts`, by path: `HEAD` to the index, and the index to the
    /// working tree, untracked files included.
    fn rows(&self, conflicts: &[Conflict]) -> Result<BTreeMap<String, Row>, GitError> {
        let mut rows: BTreeMap<String, Row> = BTreeMap::new();
        let what = "the working tree";
        for item in self.status_items(what, gix::status::UntrackedFiles::Files)? {
            for (path, state, staged) in changes(item.map_err(read_error(what))?) {
                let row = rows.entry(path).or_default();
                *(if staged {
                    &mut row.staged
                } else {
                    &mut row.unstaged
                }) = Some(state);
            }
        }
        rows.retain(|path, _| conflicts.iter().all(|conflict| &conflict.path != path));
        Ok(rows)
    }

    /// The index's conflicted files, by path, each kind from the stages it holds.
    pub(super) fn conflicts(&self) -> Result<Vec<Conflict>, GitError> {
        let index = self
            .repo
            .index_or_empty()
            .map_err(read_error("the index"))?;
        let mut stages: BTreeMap<String, [Option<ObjectId>; 3]> = BTreeMap::new();
        for entry in index.entries() {
            let slot = match entry.stage() {
                Stage::Unconflicted => continue,
                Stage::Base => 0,
                Stage::Ours => 1,
                Stage::Theirs => 2,
            };
            let path = entry.path(&index).to_string();
            stages.entry(path).or_default()[slot] = Some(entry.id);
        }
        let mut conflicts = Vec::new();
        for (path, [base, ours, theirs]) in stages {
            let kind = match (base.is_some(), ours.is_some(), theirs.is_some()) {
                (true, true, true) => ConflictKind::BothChanged,
                (false, true, true) => ConflictKind::BothAdded,
                (true, false, true) => ConflictKind::DeletedOurs,
                (true, true, false) => ConflictKind::DeletedTheirs,
                (true, false, false) => ConflictKind::BothDeleted,
                (false, true, false) => ConflictKind::AddedOurs,
                (false, false, _) => ConflictKind::AddedTheirs,
            };
            let mut is_binary = false;
            for id in [base, ours, theirs].into_iter().flatten() {
                let blob = self.repo.find_blob(id).map_err(read_error(path.as_str()))?;
                is_binary |= is_binary_blob(&blob.data);
            }
            let both = matches!(kind, ConflictKind::BothChanged | ConflictKind::BothAdded);
            let is_resolved = both
                && !is_binary
                && !on_disk(&self.root, &path)?.is_some_and(|text| holds_markers(&text));
            conflicts.push(Conflict {
                path,
                kind,
                is_binary,
                is_resolved,
            });
        }
        Ok(conflicts)
    }
}

/// Whether a file holds a line of git's conflict markers, `<<<<<<< ` or `>>>>>>> `: a conflict
/// not resolved yet.
pub(crate) fn holds_markers(text: &[u8]) -> bool {
    text.split(|byte| *byte == b'\n')
        .any(|line| line.starts_with(b"<<<<<<< ") || line.starts_with(b">>>>>>> "))
}

/// The files a status item changes, each with how, and whether in the index (`true`) or in the
/// working tree.
fn changes(item: gix::status::Item) -> Vec<(String, FileState, bool)> {
    match item {
        gix::status::Item::TreeIndex(change) => match change {
            Change::Addition { location, .. } => vec![(location.to_string(), FileState::New, true)],
            Change::Deletion { location, .. } => {
                vec![(location.to_string(), FileState::Deleted, true)]
            }
            Change::Modification { location, .. } => {
                vec![(location.to_string(), FileState::Modified, true)]
            }
            Change::Rewrite {
                source_location,
                location,
                ..
            } => vec![
                (source_location.to_string(), FileState::Deleted, true),
                (location.to_string(), FileState::New, true),
            ],
        },
        gix::status::Item::IndexWorktree(item) => {
            let state = match item.summary() {
                Some(Summary::Removed) => FileState::Deleted,
                Some(Summary::Added | Summary::IntentToAdd) => FileState::New,
                Some(Summary::Modified | Summary::TypeChange) => FileState::Modified,
                _ => return Vec::new(),
            };
            vec![(item.rela_path().to_string(), state, false)]
        }
    }
}
