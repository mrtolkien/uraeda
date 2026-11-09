//! The behind rule: whether a branch lacks changes of the default branch it must catch up with,
//! before its pull request is ready for review. It owns the list of the default branch's own files,
//! which never make a branch behind, and keeps its answers in memory by the pair of tips, so a read
//! with no tip moved computes no diff.

use std::cell::Cell;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use crate::actions::default_round::DefaultRound;
use crate::actions::priorities;
use crate::git::{Git, ObjectId};
use crate::steps::CatchUp;
use crate::target::{NOTES, PROPOSALS};

/// The inbox, from the top level, on the default branch.
const INBOX: &str = "specs/INBOX.md";
/// The decisions check's folder of candidates, from the top level.
const DECISIONS_CHECK: &str = "specs/decisions-check/";
/// The most answers kept: past it, they are forgotten and computed again.
const KEPT: usize = 4_096;

/// What `branch` must catch up with: the tip of `origin/<default>`, or of the local default branch
/// in a repository without it, when the branch lacks it and the commits it lacks change any file
/// but the default branch's own. `None` when it is not behind, or git cannot tell. The branch holds
/// the tip when its local tip or `origin/<branch>` does: GitHub's "Update branch", or a push from
/// another clone, catches up the remote branch before the local one.
pub fn catch_up(git: &Git, branch: &str) -> Option<CatchUp> {
    let default = git.default_branch()?;
    if default == branch {
        return None;
    }
    let target = git
        .remote_tip(&default)
        .or_else(|| git.resolve(&format!("refs/heads/{default}")))?;
    let tips = [
        git.resolve(&format!("refs/heads/{branch}")),
        git.remote_tip(branch),
    ];
    let mut tips = tips.into_iter().flatten().peekable();
    tips.peek()?;
    if !tips.all(|tip| behind(git, tip, target)) {
        return None;
    }
    let subject = git.subject(target).ok()?;
    Some(CatchUp {
        branch: default,
        commit: target.to_string(),
        subject,
    })
}

/// Whether the commit `tip` lacks `target`, and the changes it lacks touch any file but the default
/// branch's own: answered once per pair of commits.
fn behind(git: &Git, tip: ObjectId, target: ObjectId) -> bool {
    if let Some(known) = answers().get(&(tip, target)) {
        return *known;
    }
    let answer = compute(git, tip, target);
    let mut answers = answers();
    if answers.len() >= KEPT {
        answers.clear();
    }
    answers.insert((tip, target), answer);
    answer
}

/// The behind rule, without the memo: `tip` does not hold `target`, their histories meet, and the
/// diff from where they meet to `target` changes a file the default branch does not own.
fn compute(git: &Git, tip: ObjectId, target: ObjectId) -> bool {
    if git.is_ancestor(target, tip) {
        return false;
    }
    let Ok(Some(base)) = git.merge_base(tip, target) else {
        return false;
    };
    DIFFS.with(|diffs| diffs.set(diffs.get() + 1));
    git.changed_paths(base, target)
        .is_ok_and(|paths| paths.iter().any(|path| !default_branch_own(path)))
}

/// Whether the default branch alone writes the file at `path`, from the top level, so a branch
/// lacking a change of it needs no catch-up: the priorities, the inbox and its triage, the
/// decisions check and its candidates, the proposal and note files, and a started folder's
/// `proposal.md`, which the start renames from `specs/proposals/`.
pub fn default_branch_own(path: &str) -> bool {
    let files = [
        priorities::PATH,
        INBOX,
        DefaultRound::Triage.path(),
        DefaultRound::DecisionsCheck.path(),
    ];
    if files.contains(&path) {
        return true;
    }
    if [DECISIONS_CHECK, PROPOSALS, NOTES]
        .iter()
        .any(|folder| path.starts_with(folder))
    {
        return true;
    }
    let Some(rest) = path.strip_prefix("specs/") else {
        return false;
    };
    let folder = rest.strip_prefix("changes/").unwrap_or(rest);
    folder
        .strip_suffix("/proposal.md")
        .is_some_and(|folder| !folder.is_empty() && !folder.contains('/'))
}

/// The diffs the behind rule computed on this thread since it started, for SC-005's test: by
/// thread, so tests running beside it in the same process do not count.
pub fn diffs() -> u64 {
    DIFFS.with(Cell::get)
}

thread_local! {
    static DIFFS: Cell<u64> = const { Cell::new(0) };
}

/// The behind rule's answers, by the branch's tip and the default branch's.
fn answers() -> std::sync::MutexGuard<'static, HashMap<(ObjectId, ObjectId), bool>> {
    static ANSWERS: OnceLock<Mutex<HashMap<(ObjectId, ObjectId), bool>>> = OnceLock::new();
    ANSWERS
        .get_or_init(Mutex::default)
        .lock()
        .unwrap_or_else(|poison| poison.into_inner())
}
