//! The operation a checkout stopped in, on a conflict, and its two sides named by branch, whatever
//! git calls "ours": during a rebase, git's stage 2 is the branch rebased onto. Every write but
//! ending the stop is refused while it lasts, with one text, [`Git::ensure_not_stopped`]'s.
//!
//! gix reads which operation is in progress, but has no API for a rebase's `head-name` and
//! `onto`, nor for `MERGE_HEAD`'s id: those are read from git's folder with `std::fs`.

use gix::state::InProgress;

use super::{Git, GitError, ObjectId};

/// What stopped: a pull, as a rebase or a merge of the branch's `origin` tip; a merge of another
/// branch; or a stash put back with conflicts, which leaves no operation to continue or abort.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StoppedKind {
    Pull,
    Merge,
    Stash,
}

/// A stopped operation and its sides: `ours` is git's stage 2, `theirs` its stage 3, each a branch
/// name like `origin/main`, else a short id. `stash` names the stash a conflicted one kept.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Stopped {
    pub kind: StoppedKind,
    pub ours: String,
    pub theirs: String,
    pub stash: Option<String>,
}

impl Git {
    /// The operation this checkout stopped in, read from git's folder and the index: a rebase is a
    /// pull, onto `ours`, replaying `theirs`; a merge is a pull when it merges the branch's
    /// `origin` tip, else a merge; conflicts with no operation are a stash put back. Any other
    /// operation, or none, is `None`.
    pub fn stopped(&self) -> Option<Stopped> {
        if self.is_rebasing() {
            return Some(self.stopped_rebase());
        }
        match self.repo.state() {
            Some(InProgress::Merge) => Some(self.stopped_merge()),
            Some(_) => None,
            None => self.has_conflicts().then(|| Stopped {
                kind: StoppedKind::Stash,
                ours: self.here(),
                theirs: "the stash".to_string(),
                stash: self.has_stash().then(|| "stash@{0}".to_string()),
            }),
        }
    }

    /// Refuses while a pull or a merge is stopped here: a commit would land on a rebase's detached
    /// `HEAD` or end a merge, a sync or a merge would start over it, and an action's write would
    /// be left in the way of Continue. A stash put back with conflicts refuses nothing.
    pub fn ensure_not_stopped(&self) -> Result<(), GitError> {
        let operation = match self.stopped().map(|stopped| stopped.kind) {
            Some(StoppedKind::Pull) => "pull",
            Some(StoppedKind::Merge) => "merge",
            Some(StoppedKind::Stash) | None => return Ok(()),
        };
        Err(GitError::Refused(format!(
            "A {operation} is stopped: continue or abort it first."
        )))
    }

    /// Whether a rebase is in progress here, of any kind git has.
    pub(super) fn is_rebasing(&self) -> bool {
        matches!(
            self.repo.state(),
            Some(
                InProgress::Rebase | InProgress::RebaseInteractive | InProgress::ApplyMailboxRebase,
            )
        )
    }

    /// The branch a stopped rebase replays, which detached `HEAD`: still the branch this checkout
    /// holds, for an action that writes on it.
    pub fn rebasing(&self) -> Option<String> {
        let name = self.rebase_file("head-name")?;
        let name = name.strip_prefix("refs/heads/")?;
        Some(name.to_string())
    }

    /// A file of a stopped rebase's folder, trimmed: `rebase-merge/` or `rebase-apply/`.
    fn rebase_file(&self, name: &str) -> Option<String> {
        ["rebase-merge", "rebase-apply"].iter().find_map(|folder| {
            let text = std::fs::read_to_string(self.repo.git_dir().join(folder).join(name));
            text.ok().map(|text| text.trim().to_string())
        })
    }

    /// A stopped rebase: `theirs` is the branch replayed, from `head-name`; `ours` the commit it
    /// is replayed onto, named `origin/<branch>` when it is that branch's tip.
    fn stopped_rebase(&self) -> Stopped {
        let branch = self.rebasing();
        let onto = self
            .rebase_file("onto")
            .and_then(|id| ObjectId::from_hex(id.as_bytes()).ok());
        let ours = match (&branch, onto) {
            (Some(branch), Some(onto)) if self.remote_tip(branch) == Some(onto) => {
                format!("origin/{branch}")
            }
            (_, Some(onto)) => self.name_of(onto),
            (_, None) => "the upstream".to_string(),
        };
        Stopped {
            kind: StoppedKind::Pull,
            ours,
            theirs: branch.unwrap_or_else(|| self.here()),
            stash: None,
        }
    }

    /// A stopped merge into the branch checked out: a pull when `MERGE_HEAD` is its `origin` tip.
    fn stopped_merge(&self) -> Stopped {
        let merged = std::fs::read_to_string(self.repo.git_dir().join("MERGE_HEAD"))
            .ok()
            .and_then(|text| {
                let id = text.lines().next()?.trim().to_string();
                ObjectId::from_hex(id.as_bytes()).ok()
            });
        let branch = self.current_branch();
        let pull = branch
            .as_ref()
            .is_some_and(|branch| merged.is_some() && self.remote_tip(branch) == merged);
        let theirs = match (&branch, merged) {
            (Some(branch), Some(_)) if pull => format!("origin/{branch}"),
            (_, Some(merged)) => self.name_of(merged),
            (_, None) => "the merged branch".to_string(),
        };
        Stopped {
            kind: if pull {
                StoppedKind::Pull
            } else {
                StoppedKind::Merge
            },
            ours: self.here(),
            theirs,
            stash: None,
        }
    }

    /// The branch checked out, else `HEAD`'s short id.
    fn here(&self) -> String {
        self.current_branch()
            .or_else(|| self.head().map(short))
            .unwrap_or_else(|| "HEAD".to_string())
    }

    /// The local branch whose tip is `id`, else the `origin` branch, else its short id.
    fn name_of(&self, id: ObjectId) -> String {
        let branches = self.branches().unwrap_or_default();
        let local = branches.iter().find(|branch| branch.local == Some(id));
        let remote = || {
            branches
                .iter()
                .find(|branch| branch.remote == Some(id))
                .map(|branch| format!("origin/{}", branch.name))
        };
        local
            .map(|branch| branch.name.clone())
            .or_else(remote)
            .unwrap_or_else(|| short(id))
    }

    /// Whether `refs/stash` exists: a stash put back with conflicts is kept there.
    fn has_stash(&self) -> bool {
        self.repo
            .try_find_reference("refs/stash")
            .ok()
            .flatten()
            .is_some()
    }

    /// Whether the index holds an entry of a conflict's stages.
    fn has_conflicts(&self) -> bool {
        self.repo.index_or_empty().is_ok_and(|index| {
            index
                .entries()
                .iter()
                .any(|entry| entry.stage() != gix::index::entry::Stage::Unconflicted)
        })
    }
}

fn short(id: ObjectId) -> String {
    id.to_hex_with_len(7).to_string()
}
