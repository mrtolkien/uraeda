//! The writes of a start: the proposal file's move, its commit with the proposal, and the feature's
//! or the change's branch.

use std::fs;

use super::plan::Plan;
use super::{Source, Start, StartError, partial};
use crate::actions::expand::with_nested;

impl Start<'_> {
    /// What is left to do by hand once the proposal file is in the dated folder.
    fn left_after_write(&self, plan: &Plan) -> Vec<String> {
        vec![
            plan.commit_left(self.default),
            plan.branch_left(self.switch),
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
    /// proposal file's removal.
    pub(super) fn commit_start(&self, plan: &Plan, done: &str) -> Result<(), StartError> {
        let done = [done.to_string()];
        let proposal = format!("{}/proposal.md", plan.destination);
        if !plan.nested.is_empty()
            && let Err(error) = fs::read_to_string(self.root.join(&proposal)).and_then(|text| {
                let carried = with_nested(&text, &proposal, &plan.nested);
                fs::write(self.root.join(&proposal), carried)
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
        // Written, so a failed commit stays here: switching back could carry the staged files away.
        if let Err(error) = self.at.commit(&paths, &plan.start_subject, None) {
            return Err(partial(&done, self.left_after_write(plan), error));
        }
        Ok(())
    }

    /// The feature's or the change's branch, from the start commit, switched to or in its new
    /// worktree.
    pub(super) fn create_branch(&self, plan: &Plan, done: &[String]) -> Result<(), StartError> {
        let created = if self.switch {
            self.at.switch_new(&plan.branch, self.default)
        } else {
            self.git.exclude_worktrees().and_then(|()| {
                self.at
                    .add_worktree_new(&plan.worktree, &plan.branch, self.default)
            })
        };
        created.map_err(|error| partial(done, vec![plan.branch_left(self.switch)], error))
    }
}
