//! `ura clean`: the worktree and the branch merged features left behind, removed when the human
//! asks, never at the cost of their work.

use std::process::ExitCode;

use uraeda_core::actions::clean::{self, Cleaned, Did, Left, Leftover, WhyLeft};
use uraeda_core::steps::StepName;
use uraeda_core::target::{Purpose, Target};
use uraeda_core::workspace::{Feature, Workspace, branch_folder};

use crate::output;
use crate::status;

/// Merged features with a worktree or a branch left, in folder order.
pub fn candidates(workspace: &Workspace) -> Vec<&Feature> {
    let mut features: Vec<&Feature> = workspace
        .features
        .iter()
        .filter(|f| f.step.name == StepName::Done && status::leftovers(f).is_some())
        .collect();
    features.sort_by(|a, b| a.folder.cmp(&b.folder));
    features
}

pub fn run(target: Option<String>, all: bool, dry_run: bool) -> Result<ExitCode, String> {
    let (git, workspace) = output::workspace()?;
    let candidates = candidates(&workspace);
    let chosen: Vec<&Feature> = match (&target, all) {
        (Some(target), _) => match output::target(&workspace, Some(target), Purpose::Inspect)? {
            Target::Feature(index) | Target::File(index, _) => vec![&workspace.features[index]],
            Target::Draft(draft) => return Err(format!("{draft} is not started")),
        },
        (None, true) => candidates.clone(),
        (None, false) => {
            // The current branch's feature, when it has something to clean.
            let current = workspace
                .current_branch
                .as_deref()
                .and_then(branch_folder)
                .and_then(|(_, folder)| candidates.iter().find(|f| f.folder == folder));
            match (current, candidates.as_slice()) {
                (Some(feature), _) => vec![*feature],
                (None, [one]) => vec![*one],
                (None, []) => vec![],
                (None, several) => {
                    let names: Vec<String> = several
                        .iter()
                        .map(|f| format!("  {}", status::name(f)))
                        .collect();
                    return Err(format!(
                        "{} merged features have a worktree or a branch left: name one, or pass --all\n{}",
                        several.len(),
                        names.join("\n")
                    ));
                }
            }
        }
    };
    if chosen.is_empty() {
        println!("Nothing to clean: no merged feature has a worktree or a branch left.");
        return Ok(ExitCode::SUCCESS);
    }
    let default = workspace
        .default_branch
        .clone()
        .unwrap_or_else(|| "main".into());
    let mut left = false;
    for feature in chosen {
        let cleaned =
            clean::clean(&git, &workspace, feature, dry_run).map_err(|e| e.to_string())?;
        left |= !cleaned.left.is_empty();
        print!("{}", render(&cleaned, &default));
    }
    Ok(if left {
        ExitCode::FAILURE
    } else {
        ExitCode::SUCCESS
    })
}

fn render(cleaned: &Cleaned, default: &str) -> String {
    let mut text = format!("{}\n", cleaned.name);
    for did in &cleaned.did {
        let line = match (did, cleaned.dry_run) {
            (Did::RemovedWorktree(path), false) => format!("removed the worktree {path}"),
            (Did::RemovedWorktree(path), true) => format!("would remove the worktree {path}"),
            (Did::PrunedWorktree(path), false) => {
                format!("pruned the record of the missing worktree {path}")
            }
            (Did::PrunedWorktree(path), true) => {
                format!("would prune the record of the missing worktree {path}")
            }
            (Did::DeletedBranch(branch), false) => format!("deleted the branch {branch}"),
            (Did::DeletedBranch(branch), true) => format!("would delete the branch {branch}"),
        };
        text.push_str(&wrap(&line));
    }
    for left in &cleaned.left {
        text.push_str(&wrap(&left_line(left, default)));
    }
    text
}

fn left_line(left: &Left, default: &str) -> String {
    match (&left.what, &left.why) {
        (Leftover::Worktree(path), WhyLeft::Changes) => format!(
            "left the worktree {path}: it has uncommitted or untracked files. Commit or remove them, then run ura clean again"
        ),
        (Leftover::Worktree(path), WhyLeft::Locked) => format!(
            "left the worktree {path}: the worktree is locked. Unlock it with git worktree unlock, then run ura clean again"
        ),
        (Leftover::Worktree(path), WhyLeft::YouAreInIt) => {
            format!("left the worktree {path}: you are in it. Run ura clean from the main checkout")
        }
        (Leftover::Worktree(path), WhyLeft::Outside(at)) => {
            format!("left the worktree {path}: checked out in {at}, remove that worktree yourself")
        }
        (Leftover::Branch(branch), WhyLeft::WorktreeLeft) => {
            format!("left the branch {branch}: its worktree is still there")
        }
        (Leftover::Branch(branch), WhyLeft::CheckedOutHere) => format!(
            "left the branch {branch}: your checkout is on it. Switch it to {default}, then run ura clean again"
        ),
        (Leftover::Branch(branch), WhyLeft::Unmerged { count, bases }) => {
            let commits = if *count == 1 {
                "1 commit is".to_string()
            } else {
                format!("{count} commits are")
            };
            let where_ = match bases.as_slice() {
                [one] => format!("not on {one}"),
                [first, second] => format!("on neither {first} nor {second}"),
                _ => format!("not on {}", bases.join(", ")),
            };
            let them = if *count == 1 { "it is" } else { "they are" };
            format!(
                "left the branch {branch}: {commits} {where_}. Delete it with git branch -D {branch} if {them} not needed"
            )
        }
        (Leftover::Worktree(path), _) => format!("left the worktree {path}"),
        (Leftover::Branch(branch), _) => format!("left the branch {branch}"),
    }
}

/// A line indented by two spaces, wrapped at 100 columns with the same indent.
fn wrap(line: &str) -> String {
    let mut text = String::new();
    let mut current = String::from(" ");
    for word in line.split(' ') {
        if current.len() + 1 + word.len() > 100 && !current.trim().is_empty() {
            text.push_str(&current);
            text.push('\n');
            current = String::from(" ");
        }
        current.push(' ');
        current.push_str(word);
    }
    text.push_str(&current);
    text.push('\n');
    text
}
