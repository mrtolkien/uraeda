//! Git, as the sample projects' builders run it: away from the machine's configuration and hooks,
//! every commit dated, so a build gives the same history every time.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

/// When a commit with no time of its own is made: the sample's day, 2026-10-16 at 09:00 UTC.
pub(super) const DATE: &str = "2026-10-16T09:00:00Z";

/// A file a commit writes, by its path from the repository's top level: its bytes, or none to
/// remove it.
pub(super) type Files = Vec<(String, Option<Vec<u8>>)>;

/// A commit of a builder: its message, its files, and its author and committer times.
pub(super) struct Commit {
    pub message: String,
    pub files: Files,
    /// The author's time, RFC 3339: [`DATE`] when none.
    pub at: Option<String>,
    /// The committer's time: `at` when none.
    pub committed: Option<String>,
}

impl Commit {
    /// A commit of text files, at a time.
    pub fn new(message: impl Into<String>, at: Option<String>, files: Files) -> Commit {
        Commit {
            message: message.into(),
            files,
            at,
            committed: None,
        }
    }
}

/// A text file, for [`Files`].
pub(super) fn text(path: impl Into<String>, text: impl Into<String>) -> (String, Option<Vec<u8>>) {
    (path.into(), Some(text.into().into_bytes()))
}

/// A repository being built.
pub(super) struct Repo {
    pub path: PathBuf,
}

impl Repo {
    /// A new repository on `main`, in a folder made for it.
    pub fn init(path: &Path) -> Result<Repo, String> {
        fs::create_dir_all(path).map_err(|error| format!("{}: {error}", path.display()))?;
        let repo = Repo {
            path: path.to_owned(),
        };
        repo.git(&["init", "--quiet", "--initial-branch", "main"])?;
        repo.git(&["config", "user.name", "Sandbox"])?;
        repo.git(&["config", "user.email", "sandbox@uraeda.invalid"])?;
        repo.git(&["config", "commit.gpgsign", "false"])?;
        Ok(repo)
    }

    /// Runs git in the repository, and answers what it printed.
    pub fn git(&self, args: &[&str]) -> Result<String, String> {
        git_in(&self.path, args, None)
    }

    /// Commits everything the checkout shows, at [`DATE`].
    pub fn commit_all(&self, message: &str) -> Result<(), String> {
        self.git(&["add", "--all"])?;
        commit(&self.path, message, DATE, DATE)
    }

    /// Makes a branch from another.
    pub fn branch(&self, name: &str, from: &str) -> Result<(), String> {
        self.git(&["branch", name, from]).map(drop)
    }

    /// Checks a branch out in `.worktrees/<branch>`, as a feature at work is.
    pub fn worktree(&self, branch: &str) -> Result<(), String> {
        // Kept out of `git status`, as Uraeda keeps it.
        let exclude = self.path.join(".git/info/exclude");
        let mut text = fs::read_to_string(&exclude).unwrap_or_default();
        if !text.lines().any(|line| line == "/.worktrees/") {
            text.push_str("/.worktrees/\n");
            fs::create_dir_all(self.path.join(".git/info")).map_err(|error| error.to_string())?;
            fs::write(&exclude, text).map_err(|error| error.to_string())?;
        }
        let folder = format!(".worktrees/{branch}");
        self.git(&["worktree", "add", "--quiet", &folder, branch])
            .map(drop)
    }

    /// Makes commits on a branch, in the worktree that holds it, or one of its own for the
    /// time: the main checkout is left as it is.
    pub fn commits(&self, branch: &str, commits: Vec<Commit>) -> Result<(), String> {
        let current = self.git(&["branch", "--show-current"])?;
        let held = current.trim() == branch;
        let temporary = self.path.join(".git").join("sandbox-worktree");
        let worktree = if held { self.path.clone() } else { temporary };
        if !held {
            let folder = worktree.to_string_lossy().into_owned();
            self.git(&["worktree", "add", "--quiet", &folder, branch])?;
        }
        let made = commits
            .into_iter()
            .try_for_each(|each| write_and_commit(&worktree, each));
        if !held {
            let folder = worktree.to_string_lossy().into_owned();
            self.git(&["worktree", "remove", "--force", &folder])?;
        }
        made
    }
}

/// Writes a commit's files in a checkout, and commits them.
fn write_and_commit(checkout: &Path, each: Commit) -> Result<(), String> {
    for (path, bytes) in &each.files {
        let file = checkout.join(path);
        let written = match bytes {
            Some(bytes) => file
                .parent()
                .map_or(Ok(()), fs::create_dir_all)
                .and_then(|()| fs::write(&file, bytes)),
            None => fs::remove_file(&file),
        };
        written.map_err(|error| format!("{}: {error}", file.display()))?;
    }
    git_in(checkout, &["add", "--all"], None)?;
    let at = each.at.as_deref().unwrap_or(DATE);
    commit(
        checkout,
        &each.message,
        at,
        each.committed.as_deref().unwrap_or(at),
    )
}

/// Commits what is staged, with its times.
fn commit(checkout: &Path, message: &str, at: &str, committed: &str) -> Result<(), String> {
    let args = ["commit", "--quiet", "--no-verify", "--message", message];
    git_in(checkout, &args, Some((at, committed))).map(drop)
}

/// Runs git in a folder, without the machine's configuration, hooks, or upkeep, and answers its
/// output.
pub(super) fn git_in(
    folder: &Path,
    args: &[&str],
    dates: Option<(&str, &str)>,
) -> Result<String, String> {
    let mut command = Command::new("git");
    command
        .args(args)
        .current_dir(folder)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_CONFIG_COUNT", "1")
        .env("GIT_CONFIG_KEY_0", "maintenance.auto")
        .env("GIT_CONFIG_VALUE_0", "false")
        .env("GIT_AUTHOR_NAME", "Sandbox")
        .env("GIT_AUTHOR_EMAIL", "sandbox@uraeda.invalid")
        .env("GIT_COMMITTER_NAME", "Sandbox")
        .env("GIT_COMMITTER_EMAIL", "sandbox@uraeda.invalid");
    for name in [
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_INDEX_FILE",
        "GIT_COMMON_DIR",
    ] {
        command.env_remove(name);
    }
    let (at, committed) = dates.unwrap_or((DATE, DATE));
    command
        .env("GIT_AUTHOR_DATE", at)
        .env("GIT_COMMITTER_DATE", committed);
    let output = command
        .output()
        .map_err(|error| format!("git cannot run: {error}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git {} failed: {}", args.join(" "), stderr.trim()));
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// The folders in a folder, by name.
pub(super) fn sorted(folder: &Path) -> Result<Vec<std::path::PathBuf>, String> {
    let read = fs::read_dir(folder).map_err(|error| format!("{}: {error}", folder.display()))?;
    let mut paths: Vec<_> = read
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .collect();
    paths.sort();
    Ok(paths)
}

/// Copies a folder's files into another, folder by folder.
pub(super) fn copy(from: &Path, to: &Path) -> Result<(), String> {
    fs::create_dir_all(to).map_err(|error| error.to_string())?;
    for path in sorted(from)? {
        let target = to.join(path.file_name().unwrap_or_default());
        if path.is_dir() {
            copy(&path, &target)?;
        } else {
            fs::copy(&path, &target).map_err(|error| format!("{}: {error}", path.display()))?;
        }
    }
    Ok(())
}
