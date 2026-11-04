//! Ending a stopped pull or merge: a conflict's side taken whole, then Continue or Abort, and the
//! merge of a branch into the one checked out. A merge or a continue that stops on a conflict
//! succeeds: [`Git::stopped`] then shows it.

use std::collections::BTreeMap;

use gix::index::entry::Stage;
use gix::state::InProgress;

use super::commit::refused;
use super::{Git, GitError, OnOutput, StoppedKind, process, read_error};

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
        let Some(stages) = self.conflicts()?.remove(path) else {
            return Err(GitError::Refused(format!("{path} has no conflict.")));
        };
        let side = match resolution {
            Resolution::Ours => Some(("--ours", Stage::Ours)),
            Resolution::Theirs => Some(("--theirs", Stage::Theirs)),
            Resolution::Delete => None,
        };
        let paths = [path.to_string()];
        match side {
            Some((side, stage)) if stages.contains(&stage) => {
                self.write_paths(&["checkout", side], &paths)?;
                self.write_paths(&["add"], &paths)
            }
            _ => self.write_paths(&["rm", "--quiet"], &paths),
        }
    }

    /// Stages each conflicted file whose conflicts are all resolved, refusing while one still
    /// holds markers, then continues the stopped rebase or merge. A stash put back with conflicts
    /// has nothing to continue: its files are staged, and the stash kept.
    pub fn continue_stopped(&self, on_output: OnOutput) -> Result<(), GitError> {
        let Some(stopped) = self.stopped() else {
            return Err(nothing_stopped());
        };
        let paths: Vec<String> = self.conflicts()?.into_keys().collect();
        let mut left = 0;
        for path in &paths {
            match std::fs::read(self.root.join(path)) {
                Ok(text) if has_markers(&text) => left += 1,
                Ok(_) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => return Err(read_error(path.as_str())(error)),
            }
        }
        match left {
            0 => {}
            1 => return Err(GitError::Refused("1 file still conflicts.".to_string())),
            n => return Err(GitError::Refused(format!("{n} files still conflict."))),
        }
        self.write_paths(&["add", "--all"], &paths)?;
        if stopped.kind == StoppedKind::Stash {
            return Ok(());
        }
        self.run_stop(&[self.operation(), "--continue"], on_output)
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
    /// an option. Refused while a pull or a merge is stopped.
    pub fn merge_branch(&self, branch: &str, on_output: OnOutput) -> Result<(), GitError> {
        match self.stopped().map(|stopped| stopped.kind) {
            Some(StoppedKind::Pull) => return Err(refused("pull")),
            Some(StoppedKind::Merge) => return Err(refused("merge")),
            Some(StoppedKind::Stash) | None => {}
        }
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
        match self.repo.state() {
            Some(
                InProgress::Rebase | InProgress::RebaseInteractive | InProgress::ApplyMailboxRebase,
            ) => "rebase",
            _ => "merge",
        }
    }

    /// Each conflicted file of the index, read from disk, with the stages it holds.
    fn conflicts(&self) -> Result<BTreeMap<String, Vec<Stage>>, GitError> {
        let index = self.repo.open_index().map_err(read_error("the index"))?;
        let mut conflicts: BTreeMap<String, Vec<Stage>> = BTreeMap::new();
        for entry in index.entries() {
            if entry.stage() != Stage::Unconflicted {
                let path = entry.path(&index).to_string();
                conflicts.entry(path).or_default().push(entry.stage());
            }
        }
        Ok(conflicts)
    }
}

fn nothing_stopped() -> GitError {
    GitError::Refused("Nothing is stopped: there is nothing to continue or abort.".to_string())
}

/// Whether a file still holds one of git's conflict markers: task 2's `Conflict::is_resolved`
/// replaces it at the wave's merge (ruling R4).
fn has_markers(text: &[u8]) -> bool {
    text.split(|byte| *byte == b'\n')
        .any(|line| line.starts_with(b"<<<<<<< ") || line.starts_with(b">>>>>>> "))
}
