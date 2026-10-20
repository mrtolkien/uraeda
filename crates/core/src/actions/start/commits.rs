//! The writes of a start: the draft's move, its commit with the entry, and the feature's or the
//! change's branch.

use std::fs;

use super::plan::Plan;
use super::{Source, Start, StartError, partial};

impl Start<'_> {
    /// What is left to do by hand once the draft is in the dated folder.
    fn left_after_write(&self, plan: &Plan) -> Vec<String> {
        vec![
            plan.commit_left(self.default),
            plan.branch_left(self.switch),
        ]
    }

    /// Moves the draft's files into the dated folder, on the default branch: each move, from and
    /// to.
    pub(super) fn move_draft(
        &self,
        draft: &str,
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
            let to = if plan.folder_draft {
                format!(
                    "{}/{}",
                    plan.destination,
                    file.strip_prefix(&format!("{draft}/")).unwrap_or(file)
                )
            } else {
                format!("{}/proposal.md", plan.destination)
            };
            // The draft as it is here, uncommitted edits included.
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
        if plan.folder_draft {
            let _ = fs::remove_dir_all(root.join(draft));
        }
        Ok(moves)
    }

    /// The start commit, on the default branch: the entry, and the dated folder with the draft's
    /// removal.
    pub(super) fn commit_start(&self, plan: &Plan, done: &str) -> Result<(), StartError> {
        let done = [done.to_string()];
        if let Err(error) = fs::write(self.root.join("specs/PRIORITIES.md"), &plan.priorities) {
            let mut left = vec!["move the entry to the top of Now in specs/PRIORITIES.md".into()];
            left.extend(self.left_after_write(plan));
            return Err(partial(&done, left, error));
        }
        // Folders as pathspecs, so files git ignores, like `.DS_Store`, stay out of the commit.
        let mut paths = vec!["specs/PRIORITIES.md".to_string(), plan.destination.clone()];
        if let Source::Draft(draft) = self.source
            && !plan.tracked.is_empty()
        {
            paths.push(draft.to_string());
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
