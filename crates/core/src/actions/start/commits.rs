//! The writes of a start: the proposal file's move, its commit with the proposal, and the feature's
//! or the change's branch.

use std::fs;

use super::plan::Plan;
use super::restore::{Written, written_in};
use super::{Source, Start, StartError, StartProgress, partial};
use crate::actions::expand::with_nested;
use crate::cache::WriteGuard;
use crate::git::{Git, GitError, ObjectId};

impl Start<'_> {
    /// What is left to do by hand once the proposal file is in the dated folder.
    fn left_after_write(&self, plan: &Plan) -> Vec<String> {
        vec![
            plan.commit_left(self.default),
            plan.branch_left(self.run.switch),
        ]
    }

    /// Moves the proposal file's files into the dated folder, on the default branch: each move,
    /// from and to.
    pub(super) fn move_proposal(
        &self,
        proposal: &str,
        plan: &Plan,
    ) -> Result<Vec<(String, String)>, StartError> {
        let left = || {
            let mut left = vec![plan.write_left.clone()];
            left.extend(self.left_after_write(plan));
            left
        };
        let root = self.root;
        let mut moves = Vec::new();
        for file in &plan.files {
            let to = if plan.postponed {
                format!(
                    "{}/{}",
                    plan.destination,
                    file.strip_prefix(&format!("{proposal}/")).unwrap_or(file)
                )
            } else {
                format!("{}/proposal.md", plan.destination)
            };
            // The proposal file as it is here, uncommitted edits included.
            let moved = match root.join(&to).parent() {
                Some(parent) => fs::create_dir_all(parent),
                None => Ok(()),
            }
            .and_then(|()| fs::rename(root.join(file), root.join(&to)));
            if let Err(error) = moved {
                // Nothing moved yet: a plain refusal, which switches back.
                if moves.is_empty() {
                    return Err(error.into());
                }
                let done: Vec<String> = moves
                    .iter()
                    .map(|(from, to): &(String, String)| format!("the move of {from} to {to}"))
                    .collect();
                return Err(partial(&done, left(), error));
            }
            moves.push((file.clone(), to));
        }
        if plan.postponed {
            let _ = fs::remove_dir_all(root.join(proposal));
        }
        Ok(moves)
    }

    /// The start commit, on the default branch: the proposal, and the dated folder with the
    /// proposal file's removal. A hook's refusal puts back what the start wrote, `moves` included,
    /// when the start asked for it. `held`, the write lock, is released once the files are staged,
    /// before the hooks run, and taken again to take back the stage and put the files back.
    pub(super) fn commit_start(
        &self,
        plan: &Plan,
        done: &str,
        moves: &[(String, String)],
        held: Option<WriteGuard>,
    ) -> Result<(), StartError> {
        let done = [done.to_string()];
        let proposal = format!("{}/proposal.md", plan.destination);
        // The proposal's text before its nested lines, which a refused commit puts back.
        let mut proposal_before = None;
        if !plan.nested.is_empty()
            && let Err(error) = fs::read_to_string(self.root.join(&proposal)).and_then(|text| {
                let carried = with_nested(&text, &proposal, &plan.nested);
                fs::write(self.root.join(&proposal), carried)?;
                proposal_before = Some(text);
                Ok(())
            })
        {
            let mut left = vec![
                format!("add the proposal's nested lines in Now to the end of {proposal}'s What"),
                "move the proposal to the top of Now in specs/PRIORITIES.md".into(),
            ];
            left.extend(self.left_after_write(plan));
            return Err(partial(&done, left, error));
        }
        if let Err(error) = fs::write(self.root.join("specs/PRIORITIES.md"), &plan.priorities) {
            let mut left =
                vec!["move the proposal to the top of Now in specs/PRIORITIES.md".into()];
            left.extend(self.left_after_write(plan));
            return Err(partial(&done, left, error));
        }
        // Folders as pathspecs, so files git ignores, like `.DS_Store`, stay out of the commit.
        let mut paths = vec!["specs/PRIORITIES.md".to_string(), plan.destination.clone()];
        if let Source::Proposal(proposal) = self.source
            && !plan.tracked.is_empty()
        {
            paths.push(proposal.to_string());
        }
        paths.sort();
        // What the start left in the dated folder, which a refused commit removes only unchanged.
        let written = if self.run.restore {
            written_in(self.root, &plan.destination)
        } else {
            Written::new()
        };
        let head = self.at.head();
        // Written, so a failed staging stays here: switching back could carry the staged files
        // away.
        let stage = self
            .at
            .stage(&paths, false)
            .map_err(|error| partial(&done, self.left_after_write(plan), error))?;
        // Other writes, saves included, run while the hooks do: they change the working tree, not
        // the snapshot staged, and the put back below leaves any path they changed.
        drop(held);
        self.report(StartProgress::Committing);
        let on_output = |line: &str| self.report(StartProgress::Output(line.to_string()));
        let streamed = self.run.on_step.map(|_| &on_output as &dyn Fn(&str));
        let Err(error) = self
            .at
            .commit_stage(&stage, &plan.start_subject, None, false, streamed)
        else {
            return Ok(());
        };
        let _lock = self.run.lock();
        // A refused commit takes back what it staged, so nothing it held blocks or rides along.
        drop(self.at.unstage_stage(&stage));
        match error {
            GitError::Command {
                subcommand,
                message,
                output,
            } if subcommand == "commit" && self.run.restore && self.head_is(head) => {
                let left = self.put_back(plan, moves, &written, proposal_before.as_deref());
                refused(message, output, &left)
            }
            error => Err(partial(&done, self.left_after_write(plan), error)),
        }
    }

    /// Whether `HEAD` is still `head`: a failed commit that moved it committed something, so its
    /// files are not put back.
    fn head_is(&self, head: Option<ObjectId>) -> bool {
        Git::open(self.root).is_ok_and(|git| git.head() == head)
    }

    /// The feature's or the change's branch, from the start commit, switched to or in its new
    /// worktree.
    pub(super) fn create_branch(&self, plan: &Plan, done: &[String]) -> Result<(), StartError> {
        let created = if self.run.switch {
            self.at.switch_new(&plan.branch, self.default)
        } else {
            self.git.exclude_worktrees().and_then(|()| {
                self.at
                    .add_worktree_new(&plan.worktree, &plan.branch, self.default)
            })
        };
        created.map_err(|error| partial(done, vec![plan.branch_left(self.run.switch)], error))
    }
}

/// A start commit refused by a hook, its files put back but `left`, those changed during the
/// commit.
fn refused(message: String, output: String, left: &[String]) -> Result<(), StartError> {
    if left.is_empty() {
        return Err(StartError::Hook { message, output });
    }
    let left = left
        .iter()
        .map(|path| format!("check {path}: changed during the commit, left as it is"))
        .collect();
    let done = ["the start's other files put back as they were".to_string()];
    Err(partial(
        &done,
        left,
        format!("git commit failed: {message}"),
    ))
}
