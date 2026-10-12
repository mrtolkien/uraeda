//! Temporary git repositories for integration tests, shared by the core's and the CLI's tests.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use tempfile::TempDir;

/// A repository in a temporary folder, on `main` with one commit, whose pre-commit hook counts its
/// runs. The folder also holds `origin.git` once a branch is pushed, and the worktrees tests add.
pub struct TestRepo {
    dir: TempDir,
    path: PathBuf,
}

#[allow(dead_code)]
impl TestRepo {
    pub fn new() -> TestRepo {
        let dir = TempDir::new().expect("a temporary folder");
        let path = fs::canonicalize(dir.path()).unwrap().join("repo");
        fs::create_dir(&path).unwrap();
        let repo = TestRepo { dir, path };
        repo.git(&["init", "--quiet", "--initial-branch", "main"]);
        for (key, value) in [
            ("user.name", "Test"),
            ("user.email", "test@example.com"),
            ("commit.gpgSign", "false"),
            ("core.hooksPath", ".git/hooks"),
        ] {
            repo.git(&["config", key, value]);
        }
        repo.set_hook("echo run >> \"$(git rev-parse --git-common-dir)/hook-runs\"");
        repo.write("README.md", "# Test\n");
        repo.commit("chore: start");
        repo
    }

    /// The repository's working tree.
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// The temporary folder holding the repository, for worktrees and the remote.
    pub fn parent(&self) -> &Path {
        self.dir.path()
    }

    /// Replaces the pre-commit hook's script.
    pub fn set_hook(&self, script: &str) {
        let hook = self.path.join(".git/hooks/pre-commit");
        fs::create_dir_all(hook.parent().unwrap()).unwrap();
        fs::write(&hook, format!("#!/bin/sh\n{script}\n")).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&hook, fs::Permissions::from_mode(0o755)).unwrap();
        }
    }

    pub fn write(&self, path: &str, text: &str) {
        let file = self.path.join(path);
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(file, text).unwrap();
    }

    pub fn read(&self, path: &str) -> String {
        fs::read_to_string(self.path.join(path)).unwrap()
    }

    pub fn exists(&self, path: &str) -> bool {
        self.path.join(path).exists()
    }

    pub fn remove(&self, path: &str) {
        fs::remove_file(self.path.join(path)).unwrap();
    }

    /// Commits every change, without counting as a hook run.
    pub fn commit(&self, message: &str) {
        self.git(&["add", "--all"]);
        self.git(&["commit", "--quiet", "--no-verify", "--message", message]);
    }

    /// Commits a file on another branch, and comes back to the current one.
    pub fn add_on_branch(&self, branch: &str, path: &str, text: &str) {
        let current = self.current_branch();
        self.switch(branch);
        self.write(path, text);
        self.commit(&format!("chore: add {path}"));
        self.switch(&current);
    }

    pub fn branch(&self, name: &str) {
        self.git(&["branch", name]);
    }

    pub fn switch(&self, name: &str) {
        self.git(&["switch", "--quiet", name]);
    }

    pub fn switch_new(&self, name: &str) {
        self.git(&["switch", "--quiet", "--create", name]);
    }

    /// Pushes a branch to `origin`, created next to the repository on first use, then fetches.
    pub fn push(&self, branch: &str) {
        let origin = self.dir.path().join("origin.git");
        if !origin.exists() {
            run_git(
                self.dir.path(),
                &["init", "--quiet", "--bare", "origin.git"],
            );
            self.git(&["remote", "add", "origin", origin.to_str().unwrap()]);
        }
        self.git(&["push", "--quiet", "origin", branch]);
        self.git(&["fetch", "--quiet", "origin"]);
    }

    pub fn delete_branch(&self, name: &str) {
        self.git(&["branch", "--quiet", "-D", name]);
    }

    /// The commit subjects of a branch, newest first.
    pub fn subjects(&self, branch: &str) -> Vec<String> {
        self.git(&["log", "--format=%s", branch])
            .lines()
            .map(String::from)
            .collect()
    }

    /// The files a commit changed, sorted, a rename as its two paths.
    pub fn changed_in(&self, commit: &str) -> Vec<String> {
        let mut files: Vec<String> = self
            .git(&["show", "--name-only", "--no-renames", "--format=", commit])
            .lines()
            .filter(|line| !line.is_empty())
            .map(String::from)
            .collect();
        files.sort();
        files
    }

    pub fn current_branch(&self) -> String {
        self.git(&["branch", "--show-current"]).trim().to_string()
    }

    /// `git status --porcelain`, empty when the working tree is clean.
    pub fn porcelain(&self) -> String {
        self.git(&["status", "--porcelain"])
    }

    pub fn hook_runs(&self) -> usize {
        fs::read_to_string(self.path.join(".git/hook-runs"))
            .map(|runs| runs.lines().count())
            .unwrap_or(0)
    }

    /// Runs git in the repository, and returns its stdout. Panics when git fails.
    pub fn git(&self, args: &[&str]) -> String {
        run_git(&self.path, args)
    }
}

fn run_git(dir: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .expect("git runs");
    assert!(
        output.status.success(),
        "git {}: {}",
        args.join(" "),
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout).unwrap()
}
