//! Cleaning a merged feature: its worktree under `.worktrees/` and its local branch, unless that
//! would lose work (see `specs/decisions/git.md`). Decides everything from what git records, never
//! from git's messages, and prints nothing.

use std::path::Path;

use crate::actions::ActionError;
use crate::git::Git;
use crate::steps::StepName;
use crate::workspace::{Feature, Kind, Workspace, folder_branch};

/// What the cleanup did, or would do on a dry run.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Did {
    RemovedWorktree(String),
    PrunedWorktree(String),
    DeletedBranch(String),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Leftover {
    Worktree(String),
    Branch(String),
}

/// Why something was left.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum WhyLeft {
    /// The worktree has uncommitted or untracked files.
    Changes,
    Locked,
    /// Checked out outside `.worktrees/`, at this path.
    Outside(String),
    /// The branch's worktree is still there.
    WorktreeLeft,
    /// The main checkout is on the branch.
    CheckedOutHere,
    /// Commits on none of the bases.
    Unmerged {
        count: usize,
        bases: Vec<String>,
    },
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Left {
    pub what: Leftover,
    pub why: WhyLeft,
}

/// The cleanup of one merged feature or bug.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Cleaned {
    /// The folder, or `fix/<folder>` for a bug.
    pub name: String,
    pub did: Vec<Did>,
    pub left: Vec<Left>,
    pub dry_run: bool,
}

/// Removes a merged feature's worktree and local branch, or, on a dry run, says what it would do.
pub fn clean(
    git: &Git,
    workspace: &Workspace,
    feature: &Feature,
    dry_run: bool,
) -> Result<Cleaned, ActionError> {
    if feature.step.name != StepName::Done {
        return Err(ActionError::Refused(format!(
            "{} is not merged: only merged features are cleaned",
            feature.folder
        )));
    }
    let branch = folder_branch(feature.kind, &feature.folder);
    let mut cleaned = Cleaned {
        name: match feature.kind {
            Kind::Feature => feature.folder.clone(),
            Kind::Bug => branch.clone(),
        },
        did: Vec::new(),
        left: Vec::new(),
        dry_run,
    };
    let main_root = git.main_root();
    let shown = |path: &Path| {
        path.strip_prefix(&main_root)
            .map_or_else(|_| path.to_string_lossy(), |p| p.to_string_lossy())
            .into_owned()
    };

    // The worktree.
    let mut worktree_left = false;
    let record = git
        .worktree_records()?
        .into_iter()
        .find(|record| record.branch.as_deref() == Some(branch.as_str()));
    if let Some(record) = record {
        let path = shown(&record.path);
        let why = if record.missing {
            None
        } else if !record.path.starts_with(main_root.join(".worktrees")) {
            Some(WhyLeft::Outside(path.clone()))
        } else if record.locked {
            Some(WhyLeft::Locked)
        } else if Git::open(&record.path)?.has_local_changes()? {
            Some(WhyLeft::Changes)
        } else {
            None
        };
        match why {
            Some(why) => {
                worktree_left = true;
                cleaned.left.push(Left {
                    what: Leftover::Worktree(path),
                    why,
                });
            }
            None if record.missing => {
                if !dry_run {
                    git.prune_worktrees()?;
                }
                cleaned.did.push(Did::PrunedWorktree(path));
            }
            None => {
                if !dry_run {
                    git.remove_worktree(&record.path)?;
                }
                cleaned.did.push(Did::RemovedWorktree(path));
            }
        }
    }

    // The branch.
    let local = git
        .branches()?
        .into_iter()
        .any(|b| b.name == branch && b.local.is_some());
    if !local {
        return Ok(cleaned);
    }
    let checked_out_here = Git::open(&main_root)?.current_branch().as_deref() == Some(&branch);
    let why = if checked_out_here {
        Some(WhyLeft::CheckedOutHere)
    } else if worktree_left {
        Some(WhyLeft::WorktreeLeft)
    } else {
        let default = workspace
            .default_branch
            .clone()
            .unwrap_or_else(|| "main".into());
        let mut bases = Vec::new();
        if git.tip(&default).is_some() {
            bases.push(default.clone());
        }
        if git.remote_tip(&default).is_some() {
            bases.push(format!("origin/{default}"));
        }
        let names: Vec<&str> = bases.iter().map(String::as_str).collect();
        let count = git.unmerged_commits(&branch, &names)?;
        (count > 0).then_some(WhyLeft::Unmerged { count, bases })
    };
    match why {
        Some(why) => cleaned.left.push(Left {
            what: Leftover::Branch(branch),
            why,
        }),
        None => {
            if !dry_run {
                git.delete_branch(&branch)?;
            }
            cleaned.did.push(Did::DeletedBranch(branch));
        }
    }
    Ok(cleaned)
}
