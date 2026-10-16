//! What is staged, and the commit of an action's files: the writes to the index, through the
//! system `git` binary, as the git decision says.

use std::path::Path;

use super::{Git, GitError, read_error};

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
    /// them. Refuses when other files are staged, which the commit would carry along.
    pub fn commit(
        &self,
        paths: &[String],
        subject: &str,
        body: Option<&str>,
    ) -> Result<(), GitError> {
        let staged = self.staged_files()?;
        let others = others_staged(&staged, paths);
        if !others.is_empty() {
            return Err(GitError::OtherStagedFiles(others));
        }
        let addable = self.addable(paths, &staged)?;
        if !addable.is_empty() {
            let mut add = vec!["add", "--all", "--"];
            add.extend(addable.iter().copied());
            self.run("add", &add)?;
        }
        self.commit_staged(&[], subject, body)
            // A refused commit takes back what it staged, so nothing it held blocks or rides along.
            .inspect_err(|_| drop(self.unstage(&addable)))
    }

    /// Commits `paths` alone, files as they are in the working tree, running the hooks: other
    /// staged files stay staged, out of the commit. A refused commit takes back what it staged.
    pub fn commit_only(
        &self,
        paths: &[String],
        subject: &str,
        body: Option<&str>,
    ) -> Result<(), GitError> {
        let paths: Vec<&str> = paths.iter().map(String::as_str).collect();
        let mut add = vec!["add", "--"];
        add.extend(&paths);
        self.run("add", &add)?;
        let mut only = vec!["--only", "--"];
        only.extend(&paths);
        self.commit_staged(&only, subject, body)
            .inspect_err(|_| drop(self.unstage(&paths)))
    }

    /// Runs `git commit` with the hooks, `extra` after its message.
    fn commit_staged(
        &self,
        extra: &[&str],
        subject: &str,
        body: Option<&str>,
    ) -> Result<(), GitError> {
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
        }
        commit.extend(extra);
        self.run("commit", &commit)
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
