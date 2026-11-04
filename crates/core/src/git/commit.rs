//! What is staged, and the commit of an action's files: the writes to the index, through the
//! system `git` binary, as the git decision says.

use std::path::Path;

use super::{Git, GitError, ObjectId, StoppedKind, process, read_error};

/// What a commit staged, for [`Git::commit_stage`]: the paths `git add` took, and whether they
/// are committed alone.
pub struct Stage {
    added: Vec<String>,
    only: bool,
}

/// Called with each line `git commit` and its hooks print, as they print it.
pub type OnOutput<'a> = Option<&'a dyn Fn(&str)>;

impl Git {
    /// The configured `core.hooksPath`, made absolute from the main working tree when it is
    /// relative and this is a linked worktree, where git would resolve it from here instead.
    fn hooks_override(&self) -> Option<String> {
        let configured = self
            .repo
            .config_snapshot()
            .string("core.hooksPath")
            .map(|value| value.to_string())?;
        let main = self.main_root();
        (Path::new(&configured).is_relative() && main != self.root)
            .then(|| main.join(configured).to_string_lossy().into_owned())
    }

    /// Restores a file to its version at `HEAD` in this working tree and its index, dropping staged
    /// changes too.
    pub fn restore(&self, path: &str) -> Result<(), GitError> {
        self.run("checkout", &["checkout", "--quiet", "HEAD", "--", path])
    }

    /// The files staged here: those whose index entry differs from `HEAD`, sorted.
    pub fn staged_files(&self) -> Result<Vec<String>, GitError> {
        let mut files = Vec::new();
        for item in self.status_items("the index", gix::status::UntrackedFiles::None)? {
            let item = item.map_err(read_error("the index"))?;
            if let gix::status::Item::TreeIndex(change) = &item {
                files.push(change.location().to_string());
            }
        }
        files.sort();
        files.dedup();
        Ok(files)
    }

    /// Commits `paths` as they are in the working tree, running the hooks, which may reformat
    /// them, or amends the latest commit with them when `amend` is set. Refuses when other files
    /// are staged, which the commit would carry along.
    pub fn commit(
        &self,
        paths: &[String],
        subject: &str,
        body: Option<&str>,
        amend: bool,
    ) -> Result<(), GitError> {
        self.commit_streaming(paths, subject, body, amend, None)
    }

    /// Commits `paths` as [`Git::commit`] does, `on_output` given git's output as it comes.
    pub fn commit_streaming(
        &self,
        paths: &[String],
        subject: &str,
        body: Option<&str>,
        amend: bool,
        on_output: OnOutput,
    ) -> Result<(), GitError> {
        let staged = self.stage(paths, false)?;
        self.commit_stage(&staged, subject, body, amend, on_output)
            // A refused commit takes back what it staged, so nothing it held blocks or rides along.
            .inspect_err(|_| drop(self.unstage_stage(&staged)))
    }

    /// Stages `paths` for a commit, alone when `only` is set: other staged files then stay staged,
    /// out of the commit. Without `only`, refuses when other files are staged, which the commit
    /// would carry along.
    pub fn stage(&self, paths: &[String], only: bool) -> Result<Stage, GitError> {
        if only {
            let mut add = vec!["add", "--"];
            add.extend(paths.iter().map(String::as_str));
            self.run("add", &add)?;
            return Ok(Stage {
                added: paths.to_vec(),
                only: true,
            });
        }
        let staged = self.staged_files()?;
        let others = others_staged(&staged, paths);
        if !others.is_empty() {
            return Err(GitError::OtherStagedFiles(others));
        }
        let added: Vec<String> = self
            .addable(paths, &staged)?
            .into_iter()
            .map(str::to_string)
            .collect();
        if !added.is_empty() {
            let mut add = vec!["add", "--all", "--"];
            add.extend(added.iter().map(String::as_str));
            self.run("add", &add)?;
        }
        Ok(Stage { added, only: false })
    }

    /// Runs `git commit` with the hooks over what `stage` staged, or amends the latest commit with
    /// it when `amend` is set. A refused commit leaves it staged: [`Git::unstage_stage`] takes it
    /// back.
    pub fn commit_stage(
        &self,
        stage: &Stage,
        subject: &str,
        body: Option<&str>,
        amend: bool,
        on_output: OnOutput,
    ) -> Result<(), GitError> {
        let mut extra = if amend { vec!["--amend"] } else { Vec::new() };
        if !stage.only {
            return self.commit_staged(&extra, subject, body, on_output);
        }
        extra.extend(["--only", "--"]);
        extra.extend(stage.added.iter().map(String::as_str));
        self.commit_staged(&extra, subject, body, on_output)?;
        // The hooks ran over a temporary index: what they reformatted is committed, and in the
        // working tree, but not in this index, which takes it from the commit. Best effort: the
        // commit landed, and a caller reading an error would undo its files.
        drop(self.unstage_stage(stage));
        Ok(())
    }

    /// Takes back what `stage` staged, the working tree kept.
    pub fn unstage_stage(&self, stage: &Stage) -> Result<(), GitError> {
        let paths: Vec<&str> = stage.added.iter().map(String::as_str).collect();
        self.unstage(&paths)
    }

    /// Commits `paths` alone, files as they are in the working tree, running the hooks, or amends
    /// the latest commit with them when `amend` is set: other staged files stay staged, out of the
    /// commit. A refused commit takes back what it staged.
    pub fn commit_only(
        &self,
        paths: &[String],
        subject: &str,
        body: Option<&str>,
        amend: bool,
    ) -> Result<(), GitError> {
        self.commit_only_streaming(paths, subject, body, amend, None)
    }

    /// Commits `paths` alone as [`Git::commit_only`] does, `on_output` given git's output as it
    /// comes.
    pub fn commit_only_streaming(
        &self,
        paths: &[String],
        subject: &str,
        body: Option<&str>,
        amend: bool,
        on_output: OnOutput,
    ) -> Result<(), GitError> {
        let staged = self.stage(paths, true)?;
        self.commit_stage(&staged, subject, body, amend, on_output)
            .inspect_err(|_| drop(self.unstage_stage(&staged)))
    }

    /// Commits what is staged, the Git page's commit, with `message` as typed, through the hooks
    /// and signing as configured, and returns the new commit. Refuses an empty message, and an
    /// index with nothing staged. A commit the hooks refuse leaves its files staged.
    pub fn commit_index(&self, message: &str, on_output: OnOutput) -> Result<ObjectId, GitError> {
        if message.trim().is_empty() {
            return Err(GitError::Refused(
                "Write a commit message first.".to_string(),
            ));
        }
        if self.staged_files()?.is_empty() {
            return Err(GitError::Refused("Nothing is staged.".to_string()));
        }
        self.commit_staged(&[], message, None, on_output)?;
        self.head().ok_or_else(|| GitError::Read {
            what: "HEAD".to_string(),
            message: "no commit after the commit".to_string(),
        })
    }

    /// Runs `git commit` with the hooks, `extra` after its message, its output streamed to
    /// `on_output` when one is given. Every commit goes through it, and none while a pull or a
    /// merge is stopped: a rebase's would land on its detached `HEAD`, a merge's would end it.
    fn commit_staged(
        &self,
        extra: &[&str],
        subject: &str,
        body: Option<&str>,
        on_output: OnOutput,
    ) -> Result<(), GitError> {
        match self.stopped().map(|stopped| stopped.kind) {
            Some(StoppedKind::Pull) => return Err(refused("pull")),
            Some(StoppedKind::Merge) => return Err(refused("merge")),
            Some(StoppedKind::Stash) | None => {}
        }
        let hooks = self
            .hooks_override()
            .map(|path| format!("core.hooksPath={path}"));
        let mut commit = Vec::new();
        if let Some(hooks) = &hooks {
            commit.extend(["-c", hooks.as_str()]);
        }
        commit.extend(["commit", "--quiet", "--message", subject]);
        if let Some(body) = body {
            commit.extend(["--message", body]);
        } else if subject.contains('\n') {
            // A message of several lines is the human's, typed: committed as typed.
            commit.push("--cleanup=verbatim");
        }
        commit.extend(extra);
        process::git_write(&commit, &self.root, on_output)
            .map(drop)
            .map_err(|failure| failure.into_git("commit"))
    }

    /// Resets the index entries of `paths`, files or folders, to `HEAD`, the working tree kept.
    pub fn unstage(&self, paths: &[&str]) -> Result<(), GitError> {
        if paths.is_empty() {
            return Ok(());
        }
        let mut reset = vec!["reset", "--quiet", "--"];
        reset.extend(paths);
        self.run("reset", &reset)
    }
}

/// The staged files that are neither one of `paths` nor inside a folder of `paths`.
pub fn others_staged(staged: &[String], paths: &[String]) -> Vec<String> {
    staged
        .iter()
        .filter(|file| {
            !paths.iter().any(|path| {
                *file == path || file.starts_with(&format!("{}/", path.trim_end_matches('/')))
            })
        })
        .cloned()
        .collect()
}

/// The refusal of a commit, or a merge, while `operation` is stopped.
pub(super) fn refused(operation: &str) -> GitError {
    GitError::Refused(format!(
        "A {operation} is stopped: continue or abort it first."
    ))
}
