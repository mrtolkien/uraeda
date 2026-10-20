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
    /// The command runs inside the worktree.
    YouAreInIt,
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

/// The cleanup of one merged feature or change.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Cleaned {
    /// The folder, or `change/<folder>` for a change.
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
    // Every read and write goes through the main checkout: the caller's working tree may be the
    // worktree removed below.
    let here = git.root().to_path_buf();
    let main_root = git.main_root();
    let git = &Git::open(&main_root)?;
    let branch = folder_branch(feature.kind, &feature.folder);
    let mut cleaned = Cleaned {
        name: match feature.kind {
            Kind::Feature => feature.folder.clone(),
            Kind::Change => branch.clone(),
        },
        did: Vec::new(),
        left: Vec::new(),
        dry_run,
    };

    // The worktree.
    let mut worktree_left = false;
    match worktree(git, &main_root, &here, &branch, dry_run)? {
        Some(Ok(did)) => cleaned.did.push(did),
        Some(Err(left)) => {
            worktree_left = true;
            cleaned.left.push(left);
        }
        None => {}
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
        if git
            .branches()?
            .iter()
            .any(|b| b.name == default && b.local.is_some())
        {
            bases.push(default.clone());
        }
        if git.remote_tip(&default).is_some() {
            bases.push(format!("origin/{default}"));
        }
        if bases.is_empty() {
            return Err(ActionError::Refused(format!(
                "cannot tell whether {branch} is merged: no {default} branch, local or on origin"
            )));
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

/// Removes a branch's worktree from `main_root`, the main checkout, or prunes its record when its
/// folder is gone, never forced; or says why it stays: locked, outside `.worktrees/`, holding
/// `here`, the caller's working tree, or with local changes. `None` when the branch has none. On a
/// dry run, says what it would do.
pub(crate) fn worktree(
    git: &Git,
    main_root: &Path,
    here: &Path,
    branch: &str,
    dry_run: bool,
) -> Result<Option<Result<Did, Left>>, ActionError> {
    let record = git
        .worktree_records()?
        .into_iter()
        .find(|record| record.branch.as_deref() == Some(branch));
    let Some(record) = record else {
        return Ok(None);
    };
    let path = relative(main_root, &record.path);
    let why = if record.locked {
        Some(WhyLeft::Locked)
    } else if record.missing {
        None
    } else if !record.path.starts_with(main_root.join(".worktrees")) {
        Some(WhyLeft::Outside(path.clone()))
    } else if here.starts_with(&record.path) {
        Some(WhyLeft::YouAreInIt)
    } else if Git::open(&record.path)?.has_local_changes()? {
        Some(WhyLeft::Changes)
    } else {
        None
    };
    Ok(Some(match why {
        Some(why) => Err(Left {
            what: Leftover::Worktree(path),
            why,
        }),
        None if record.missing => {
            if !dry_run {
                git.prune_worktrees()?;
            }
            Ok(Did::PrunedWorktree(path))
        }
        None => {
            if !dry_run {
                git.remove_worktree(&record.path)?;
            }
            Ok(Did::RemovedWorktree(path))
        }
    }))
}

/// A path from the main checkout, with `..` for a path outside it: `.worktrees/x`, `../elsewhere`.
fn relative(base: &Path, path: &Path) -> String {
    let base: Vec<_> = base.components().collect();
    let target: Vec<_> = path.components().collect();
    let common = base.iter().zip(&target).take_while(|(a, b)| a == b).count();
    let mut parts: Vec<String> = vec!["..".to_string(); base.len() - common];
    parts.extend(
        target[common..]
            .iter()
            .map(|c| c.as_os_str().to_string_lossy().into_owned()),
    );
    parts.join("/")
}
