//! Fetching, pulling, and pushing the checked-out branch, always from and to `origin` and naming
//! the branch, so a branch with no upstream set works too. Each runs through the one write runner,
//! which never prompts; a push never forces (see `specs/decisions/git.md`).

use std::time::Duration;

use super::process::{self, Failure};
use super::{Git, GitError, OnOutput};

/// How long a fetch may take before it is stopped: a remote that never answers, as a hung ssh
/// connection, would else hold every write queued after it.
pub const FETCH_DEADLINE: Duration = Duration::from_secs(120);

/// How long a pull or a push may take before it is stopped, longer than a fetch's: a big push
/// over a slow link takes minutes, and a pull's rebase runs hooks.
pub const SYNC_DEADLINE: Duration = Duration::from_secs(600);

/// What git prints when it needed credentials it could not ask for.
const CREDENTIAL_FAILURES: [&str; 5] = [
    "terminal prompts disabled",
    "could not read Username",
    "Authentication failed",
    "Permission denied (publickey)",
    "Could not read from remote repository",
];

/// Said after git's line when a remote needed credentials.
const CREDENTIAL_HINT: &str =
    " The server runs git without a terminal: give it a credential helper or an ssh-agent.";

impl Git {
    /// Fetches `origin`, pruning the branches it deleted, stopped after [`FETCH_DEADLINE`]. Without
    /// an `origin`, does nothing. Runs on a detached `HEAD` too: it changes no branch.
    pub fn fetch(&self, on_output: OnOutput) -> Result<(), GitError> {
        self.fetch_within(FETCH_DEADLINE, on_output)
    }

    /// [`Git::fetch`], stopped after `deadline`.
    pub fn fetch_within(&self, deadline: Duration, on_output: OnOutput) -> Result<(), GitError> {
        if !self.has_origin() {
            return Ok(());
        }
        let fetch = ["fetch", "--prune", "origin"];
        sync_within(&fetch, &self.root, on_output, deadline)
            .map(drop)
            .map_err(|failure| remote_error(failure, "fetch", deadline))
    }

    /// Pulls the checked-out branch from `origin`, rebasing when the configuration says neither
    /// how to pull nor how to fast-forward, else as it says. A pull that stops on a conflict
    /// succeeds: [`Git::stopped`] then shows it.
    pub fn pull(&self, on_output: OnOutput) -> Result<(), GitError> {
        self.pull_within(SYNC_DEADLINE, on_output)
    }

    /// [`Git::pull`], stopped after `deadline`.
    pub fn pull_within(&self, deadline: Duration, on_output: OnOutput) -> Result<(), GitError> {
        let branch = self.branch_to_sync("pull from")?;
        let mut pull = vec!["pull", "--no-edit"];
        if self.rebases_by_default(&branch) {
            pull.push("--rebase");
        }
        pull.extend(["origin", "--end-of-options", branch.as_str()]);
        let was_stopped = self.stopped().is_some();
        match sync_within(&pull, &self.root, on_output, deadline) {
            Ok(_) => Ok(()),
            // A fresh read: the pull rewrote the index this `Git` may hold. A pull stopped at its
            // deadline fails even when its rebase is left in progress, which the page shows.
            Err(failure)
                if !matches!(failure, Failure::Deadline)
                    && !was_stopped
                    && Git::open(&self.root).is_ok_and(|git| git.stopped().is_some()) =>
            {
                Ok(())
            }
            Err(failure) => Err(remote_error(failure, "pull", deadline)),
        }
    }

    /// Pushes the checked-out branch to `origin`, never forced: when `origin` has commits the
    /// branch lacks, it is refused, saying to pull first.
    pub fn push(&self, on_output: OnOutput) -> Result<(), GitError> {
        self.push_within(SYNC_DEADLINE, on_output)
    }

    /// [`Git::push`], stopped after `deadline`.
    pub fn push_within(&self, deadline: Duration, on_output: OnOutput) -> Result<(), GitError> {
        let branch = self.branch_to_sync("push to")?;
        let push = [
            "push",
            "--porcelain",
            "origin",
            "--end-of-options",
            branch.as_str(),
        ];
        match sync_within(&push, &self.root, on_output, deadline) {
            Ok(_) => Ok(()),
            Err(Failure::Exit { output, .. }) if is_rejected(&output) => Err(GitError::Refused(
                format!("origin has commits {branch} lacks: pull first."),
            )),
            Err(failure) => Err(remote_error(failure, "push", deadline)),
        }
    }

    /// The branch a pull or a push syncs with `origin`: refused without an `origin`, while a pull
    /// or a merge is stopped, and on a detached `HEAD`. `to` ends "There is no remote to …".
    fn branch_to_sync(&self, to: &str) -> Result<String, GitError> {
        if !self.has_origin() {
            return Err(GitError::Refused(format!("There is no remote to {to}.")));
        }
        self.ensure_not_stopped()?;
        self.branch_to_write()
    }

    /// The branch checked out, for a write that moves it: refused on a detached `HEAD`, naming
    /// the default branch.
    pub(super) fn branch_to_write(&self) -> Result<String, GitError> {
        self.current_branch().ok_or_else(|| {
            let default = self.default_branch().unwrap_or_else(|| "main".to_string());
            GitError::Refused(format!("{default} is not checked out: HEAD is detached."))
        })
    }

    /// Whether this repository has an `origin`.
    pub(super) fn has_origin(&self) -> bool {
        self.repo.find_remote("origin").is_ok()
    }

    /// Whether a pull of `branch` passes `--rebase`: when none of `pull.rebase`, `pull.ff`, and
    /// `branch.<branch>.rebase` is set, which git would refuse on diverged branches.
    fn rebases_by_default(&self, branch: &str) -> bool {
        let config = self.repo.config_snapshot();
        let branch_rebase = format!("branch.{branch}.rebase");
        // A key set without a value, like `[pull] rebase`, has no string but is true.
        let is_set = |key: &str| config.string(key).is_some() || config.boolean(key).is_some();
        !["pull.rebase", "pull.ff", branch_rebase.as_str()]
            .into_iter()
            .any(is_set)
    }
}

/// Whether `git push --porcelain` printed a ref `origin` rejected for lacking its commits, as
/// `!`, a tab, `refs/heads/main:refs/heads/main`, a tab, `[rejected] (fetch first)`. A hook's
/// refusal reads `[remote rejected]`, and keeps git's message.
fn is_rejected(output: &str) -> bool {
    output
        .lines()
        .any(|line| line.starts_with('!') && line.contains("\t[rejected]"))
}

/// `duration` in words, in whole minutes from one minute up, else in seconds: "2 minutes".
fn duration_text(duration: Duration) -> String {
    let seconds = duration.as_secs();
    let (count, unit) = if seconds >= 60 && seconds.is_multiple_of(60) {
        (seconds / 60, "minute")
    } else {
        (seconds, "second")
    };
    let plural = if count == 1 { "" } else { "s" };
    format!("{count} {unit}{plural}")
}

/// Runs `git` with `args` in `dir` to talk to `origin`, stopped after `deadline`.
fn sync_within(
    args: &[&str],
    dir: &std::path::Path,
    on_output: OnOutput,
    deadline: Duration,
) -> Result<Vec<u8>, Failure> {
    process::git_write_within(args, dir, on_output.unwrap_or(&|_| {}), deadline)
}

/// The error of `git <subcommand>` talking to `origin`: git's, with the credential hint after its
/// line when the remote needed credentials git could not ask for, or the stop at `deadline`.
pub(super) fn remote_error(failure: Failure, subcommand: &str, deadline: Duration) -> GitError {
    match failure {
        Failure::Deadline => GitError::Command {
            subcommand: subcommand.to_string(),
            message: format!(
                "origin gave no answer in {}, so the {subcommand} was stopped.",
                duration_text(deadline)
            ),
            output: String::new(),
        },
        Failure::Exit { message, output }
            if CREDENTIAL_FAILURES
                .iter()
                .any(|failure| output.contains(failure)) =>
        {
            GitError::Command {
                subcommand: subcommand.to_string(),
                message: format!("{message}{CREDENTIAL_HINT}"),
                output,
            }
        }
        failure => failure.into_git(subcommand),
    }
}
