//! The writes of a start: its two commits, the feature's or the change's branch, and the draft's
//! move.

use std::fs;
use std::path::{Path, PathBuf};

use crate::git::Git;

use super::plan::Plan;
use super::{Source, Start, StartError, partial};

impl Start<'_> {
    /// The start commit, on the default branch.
    pub(super) fn commit_start(&self, plan: &Plan) -> Result<(), StartError> {
        fs::write(self.root.join("specs/PRIORITIES.md"), &plan.priorities)?;
        // Written, so a failed commit stays here: switching back could carry the staged file away.
        if let Err(error) = self.at.commit(
            &["specs/PRIORITIES.md".to_string()],
            &plan.start_subject,
            None,
        ) {
            let left = vec![
                format!(
                    "commit specs/PRIORITIES.md on {} as \"{}\"",
                    self.default, plan.start_subject
                ),
                format!("create the branch {}", plan.branch),
                plan.write_left.clone(),
                plan.commit_left(),
            ];
            return Err(partial(&[], left, error));
        }
        Ok(())
    }

    /// The feature's or the change's branch, switched to or in its new worktree: the working tree
    /// it is in.
    pub(super) fn create_branch(
        &self,
        plan: &Plan,
        done: &[String],
    ) -> Result<PathBuf, StartError> {
        let (folder, branch) = (&plan.folder, &plan.branch);
        let (created, branch_left) = if self.switch {
            (
                self.at.switch_new(branch, self.default),
                format!("create the branch {branch}"),
            )
        } else {
            (
                self.git.exclude_worktrees().and_then(|()| {
                    self.at
                        .add_worktree_new(&plan.worktree, branch, self.default)
                }),
                format!("create the branch {branch} in .worktrees/{folder}"),
            )
        };
        if let Err(error) = created {
            let left = vec![branch_left, plan.write_left.clone(), plan.commit_left()];
            return Err(partial(done, left, error));
        }
        Ok(if self.switch {
            self.root.to_path_buf()
        } else {
            fs::canonicalize(&plan.worktree).unwrap_or(plan.worktree.clone())
        })
    }

    /// Moves the draft's files into the dated folder of `target_root`: each move, from and to.
    pub(super) fn move_draft(
        &self,
        draft: &str,
        plan: &Plan,
        target_root: &Path,
    ) -> Result<Vec<(String, String)>, StartError> {
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
            if let Some(parent) = target_root.join(&to).parent() {
                fs::create_dir_all(parent)?;
            }
            if self.switch {
                fs::rename(root.join(file), target_root.join(&to))?;
            } else {
                // The draft as it is here, uncommitted edits included, goes to the new branch; the
                // default branch keeps its committed version.
                fs::copy(root.join(file), target_root.join(&to))?;
                let _ = fs::remove_file(target_root.join(file));
                if plan.tracked.contains(file) {
                    self.at.restore(file)?;
                } else {
                    fs::remove_file(root.join(file))?;
                }
            }
            moves.push((file.clone(), to));
        }
        if plan.folder_draft {
            let _ = fs::remove_dir_all(target_root.join(draft));
            if !self.switch && plan.tracked.is_empty() {
                let _ = fs::remove_dir_all(root.join(draft));
            }
        }
        Ok(moves)
    }

    /// The proposal commit, on the feature's or the change's branch: a typed change's whole
    /// folder.
    pub(super) fn commit_proposal(
        &self,
        plan: &Plan,
        moves: &[(String, String)],
        target_root: &Path,
        done: &[String],
    ) -> Result<(), StartError> {
        // Folders as pathspecs, so files git ignores, like `.DS_Store`, stay out of the commit.
        let mut paths: Vec<String> = Vec::new();
        if plan.folder_draft || plan.typed.is_some() {
            paths.push(plan.destination.clone());
            if let Source::Draft(draft) = self.source
                && !plan.tracked.is_empty()
            {
                paths.push(draft.to_string());
            }
        } else {
            for (from, to) in moves {
                paths.push(to.clone());
                if plan.tracked.contains(from) {
                    paths.push(from.clone());
                }
            }
        }
        paths.sort();
        let on_branch = Git::open(target_root)?;
        if let Err(error) = on_branch.commit(&paths, &plan.proposal_subject, None) {
            return Err(partial(done, vec![plan.commit_left()], error));
        }
        Ok(())
    }
}
