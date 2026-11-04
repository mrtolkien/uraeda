//! Ending a stopped pull or merge: a conflict's side taken whole, then Continue or Abort, and the
//! merge of a branch into the one checked out. A merge or a continue that stops on a conflict
//! succeeds: [`Git::stopped`] then shows it.

use super::{ConflictKind, Git, GitError, OnOutput, StoppedKind, process};

/// How a conflicted file is resolved: git's stage 2 whole, its stage 3 whole, or deleted. A side
/// that deleted the file deletes it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Resolution {
    Ours,
    Theirs,
    Delete,
}

impl Git {
    /// Resolves the conflicted file at `path` as `resolution` says, and stages it. Refuses a file
    /// that is not conflicted.
    pub fn resolve_conflict(&self, path: &str, resolution: Resolution) -> Result<(), GitError> {
        let path = self.checked(path)?;
        let conflicts = self.conflicts()?;
        let Some(conflict) = conflicts.iter().find(|conflict| conflict.path == path) else {
            return Err(GitError::Refused(format!("{path} has no conflict.")));
        };
        let side = match resolution {
            Resolution::Ours => Some(("--ours", has_ours(conflict.kind))),
            Resolution::Theirs => Some(("--theirs", has_theirs(conflict.kind))),
            Resolution::Delete => None,
        };
        let paths = [path.to_string()];
        match side {
            Some((side, true)) => {
                self.write_paths(&["checkout", side], &paths)?;
                self.write_paths(&["add"], &paths)
            }
            _ => self.write_paths(&["rm", "--quiet"], &paths),
        }
    }

    /// Stages each conflicted file, refusing while one is not [`super::Conflict::is_resolved`],
    /// then continues the stopped rebase or merge, skipping a replayed commit the resolution left
    /// empty. A stash put back with conflicts
    /// has nothing to continue: its files are staged, and the stash kept.
    pub fn continue_stopped(&self, on_output: OnOutput) -> Result<(), GitError> {
        let Some(stopped) = self.stopped() else {
            return Err(nothing_stopped());
        };
        let conflicts = self.conflicts()?;
        match conflicts
            .iter()
            .filter(|conflict| !conflict.is_resolved)
            .count()
        {
            0 => {}
            1 => return Err(GitError::Refused("1 file still conflicts.".to_string())),
            n => return Err(GitError::Refused(format!("{n} files still conflict."))),
        }
        let paths: Vec<String> = conflicts
            .into_iter()
            .map(|conflict| conflict.path)
            .collect();
        self.write_paths(&["add", "--all"], &paths)?;
        if stopped.kind == StoppedKind::Stash {
            return Ok(());
        }
        // A resolution that leaves the replayed commit empty, its side taken whole, is skipped:
        // git's apply backend refuses `--continue` on it. A skip may stop again on the next one.
        let operation = self.operation();
        let step = if operation == "rebase" && self.stages_nothing() {
            "--skip"
        } else {
            "--continue"
        };
        self.run_stop(&[operation, step], on_output)
    }

    /// Whether the index holds `HEAD`'s tree, read by git, as the staging just rewrote the index.
    fn stages_nothing(&self) -> bool {
        process::run("git", &["diff", "--cached", "--quiet"], &self.root).is_ok()
    }

    /// Aborts the stopped rebase or merge, which puts back the checkout as it was before, its
    /// autostash included. A stash put back with conflicts has no abort.
    pub fn abort_stopped(&self, on_output: OnOutput) -> Result<(), GitError> {
        match self.stopped().map(|stopped| stopped.kind) {
            None => return Err(nothing_stopped()),
            Some(StoppedKind::Stash) => {
                return Err(GitError::Refused(
                    "A stash put back with conflicts has no abort: resolve its files.".to_string(),
                ));
            }
            Some(StoppedKind::Pull | StoppedKind::Merge) => {}
        }
        let operation = self.operation();
        process::git_write(&[operation, "--abort"], &self.root, on_output)
            .map(drop)
            .map_err(|failure| failure.into_git(operation))
    }

    /// Merges `branch`, local or on `origin`, into the branch checked out, `branch` never read as
    /// an option. Refused while a pull or a merge is stopped, and on a detached `HEAD`.
    pub fn merge_branch(&self, branch: &str, on_output: OnOutput) -> Result<(), GitError> {
        self.ensure_not_stopped()?;
        self.branch_to_write()?;
        let merge = ["merge", "--no-edit", "--end-of-options", branch];
        self.run_stop(&merge, on_output)
    }

    /// Runs a write that may stop on a conflict, which is then no failure.
    fn run_stop(&self, args: &[&str], on_output: OnOutput) -> Result<(), GitError> {
        match process::git_write(args, &self.root, on_output) {
            Ok(_) => Ok(()),
            Err(_) if self.repo.state().is_some() && !self.conflicts()?.is_empty() => Ok(()),
            Err(failure) => Err(failure.into_git(args[0])),
        }
    }

    /// The command of the operation stopped here: `rebase` for a rebase, else `merge`.
    fn operation(&self) -> &'static str {
        if self.is_rebasing() {
            "rebase"
        } else {
            "merge"
        }
    }
}

fn nothing_stopped() -> GitError {
    GitError::Refused("Nothing is stopped: there is nothing to continue or abort.".to_string())
}

/// Whether git's stage 2, `ours`, holds the file.
fn has_ours(kind: ConflictKind) -> bool {
    matches!(
        kind,
        ConflictKind::BothChanged
            | ConflictKind::BothAdded
            | ConflictKind::DeletedTheirs
            | ConflictKind::AddedOurs
    )
}

/// Whether git's stage 3, `theirs`, holds the file.
fn has_theirs(kind: ConflictKind) -> bool {
    matches!(
        kind,
        ConflictKind::BothChanged
            | ConflictKind::BothAdded
            | ConflictKind::DeletedOurs
            | ConflictKind::AddedTheirs
    )
}
