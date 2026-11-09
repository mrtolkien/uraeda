//! The behind rule: whether a branch lacks changes of the default branch it must catch up with,
//! before its pull request is ready for review. It owns the list of the default branch's own files,
//! which never make a branch behind, and keeps its answers in memory by the pair of tips, so a read
//! with no tip moved computes no diff.

use std::cell::Cell;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use crate::actions::default_round::DefaultRound;
use crate::actions::{inbox, priorities};
use crate::decisions::candidates::CHECK_DIR;
use crate::git::{Git, ObjectId};
use crate::steps::CatchUp;
use crate::target::{NOTES, PROPOSALS};
use crate::workspace::{folder_slug, path_folder};

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
/// branch's own: answered once per pair of commits. A read git failed is not behind, and is not
/// kept: the next read tries again.
fn behind(git: &Git, tip: ObjectId, target: ObjectId) -> bool {
    if let Some(known) = answers().get(&(tip, target)) {
        return *known;
    }
    let Some(answer) = compute(git, tip, target) else {
        return false;
    };
    let mut answers = answers();
    if answers.len() >= KEPT {
        answers.clear();
    }
    answers.insert((tip, target), answer);
    answer
}

/// The behind rule, without the memo: `tip` does not hold `target`, their histories meet, and the
/// diff from where they meet to `target` changes a file the default branch does not own. `None`
/// when git fails to read the histories or the diff.
fn compute(git: &Git, tip: ObjectId, target: ObjectId) -> Option<bool> {
    if git.is_ancestor(target, tip) {
        return Some(false);
    }
    let Some(base) = git.merge_base(tip, target).ok()? else {
        return Some(false);
    };
    DIFFS.with(|diffs| diffs.set(diffs.get() + 1));
    let paths = git.changed_paths(base, target).ok()?;
    Some(paths.iter().any(|path| !default_branch_own(path)))
}

/// Whether the default branch alone writes the file at `path`, from the top level, so a branch
/// lacking a change of it needs no catch-up: the priorities, the inbox and its triage, the
/// decisions check and its candidates, the proposal and note files, and a started folder's
/// `proposal.md`, a dated feature's or change's, which the start renames from `specs/proposals/`.
pub fn default_branch_own(path: &str) -> bool {
    let files = [
        priorities::PATH,
        inbox::PATH,
        DefaultRound::Triage.path(),
        DefaultRound::DecisionsCheck.path(),
    ];
    if files.contains(&path) {
        return true;
    }
    let in_check = path
        .strip_prefix(CHECK_DIR)
        .is_some_and(|rest| rest.starts_with('/'));
    if in_check
        || [PROPOSALS, NOTES]
            .iter()
            .any(|folder| path.starts_with(folder))
    {
        return true;
    }
    path_folder(path)
        .is_some_and(|(_, folder, inside)| inside == "proposal.md" && folder_slug(folder).is_some())
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
