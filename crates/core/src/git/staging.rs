//! The Git page's writes to the index: staging, unstaging, and discarding the files it names,
//! each path taken literally and refused when it is not in this checkout.

use std::path::{Component, Path};

use super::{Git, GitError, process};

impl Git {
    /// Stages `paths`, files or folders, as they are on disk: a deleted file stages its deletion.
    pub fn stage_paths(&self, paths: &[String]) -> Result<(), GitError> {
        self.write_paths(&["add", "--all"], paths)
    }

    /// Unstages `paths`, files or folders, back to `HEAD`, the working tree kept.
    pub fn unstage_paths(&self, paths: &[String]) -> Result<(), GitError> {
        self.write_paths(&["reset", "--quiet"], paths)
    }

    /// Makes the file at `path` as `HEAD` has it, in the index and on disk. A file `HEAD` lacks,
    /// untracked or staged new, is taken out of the index and deleted, never with `git clean`.
    pub fn discard_path(&self, path: &str) -> Result<(), GitError> {
        let path = self.checked(path)?;
        if let Some(head) = self.head()
            && self.entry_id(head, path).is_some()
        {
            return self.write_paths(&["checkout", "--quiet", "HEAD"], &[path.to_string()]);
        }
        let staged = self.in_index(path)?;
        if !staged && !self.is_untracked(path)? {
            return Err(GitError::Refused(format!(
                "{path} has no changes to discard."
            )));
        }
        if staged {
            self.write_paths(&["reset", "--quiet"], &[path.to_string()])?;
        }
        match std::fs::remove_file(self.root.join(path)) {
            Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(GitError::Read {
                what: path.to_string(),
                message: error.to_string(),
            }),
            _ => Ok(()),
        }
    }

    /// Runs `git <command> -- <paths>`, each path checked and taken literally, never as a
    /// pattern: a file named `*.md` names itself alone. No paths, no command.
    pub(super) fn write_paths(&self, command: &[&str], paths: &[String]) -> Result<(), GitError> {
        if paths.is_empty() {
            return Ok(());
        }
        let mut args = vec!["--literal-pathspecs"];
        args.extend(command);
        args.push("--");
        for path in paths {
            args.push(self.checked(path)?);
        }
        process::git_write(&args, &self.root, None)
            .map(drop)
            .map_err(|failure| failure.into_git(command[0]))
    }

    /// `path` once it is a path inside this checkout, from its top level: not absolute, without
    /// `..`, `.`, or `.git`, and not through a symbolic link to a folder outside.
    pub(crate) fn checked<'a>(&self, path: &'a str) -> Result<&'a str, GitError> {
        let outside = || GitError::Refused(format!("{path} is not in this checkout."));
        let plain = Path::new(path).components().all(|component| {
            matches!(component, Component::Normal(name) if !name.eq_ignore_ascii_case(".git"))
        });
        if path.is_empty() || !plain {
            return Err(outside());
        }
        let folder = self.root.join(path);
        let folder = folder.ancestors().skip(1).find(|folder| folder.exists());
        let inside = folder
            .and_then(|folder| std::fs::canonicalize(folder).ok())
            .is_some_and(|folder| folder.starts_with(&self.root));
        if inside { Ok(path) } else { Err(outside()) }
    }

    /// Whether `path` is a file git does not track and does not ignore.
    fn is_untracked(&self, path: &str) -> Result<bool, GitError> {
        let args = [
            "--literal-pathspecs",
            "ls-files",
            "--others",
            "--exclude-standard",
            "-z",
            "--",
            path,
        ];
        let output = self.output("ls-files", &args)?;
        Ok(output.split('\0').any(|listed| listed == path))
    }
}
