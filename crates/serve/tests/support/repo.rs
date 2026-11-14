//! Temporary repositories made with the git CLI: a main checkout on `main`, and a worktree whose
//! branch holds a feature folder. Only tests run git: the crate reads it with gix.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use tempfile::TempDir;
use uraeda_serve::Settings;

pub const FOLDER: &str = "2026-10-10-recurring-tasks";

pub fn git(dir: &Path, args: &[&str]) {
    let output = Command::new("git")
        .args(args)
        .current_dir(dir)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_SYSTEM", "/dev/null")
        .env("GIT_AUTHOR_NAME", "Test")
        .env("GIT_AUTHOR_EMAIL", "test@example.com")
        .env("GIT_COMMITTER_NAME", "Test")
        .env("GIT_COMMITTER_EMAIL", "test@example.com")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "git {args:?}: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

pub struct Fixture {
    pub _dir: TempDir,
    pub main: PathBuf,
    pub worktree: PathBuf,
}

/// A main checkout on `main`, and a worktree whose branch holds a feature folder with the files
/// given.
pub fn fixture(files: &[(&str, String)]) -> Fixture {
    let dir = TempDir::new().unwrap();
    let base = fs::canonicalize(dir.path()).unwrap();
    let main = base.join("todo");
    fs::create_dir(&main).unwrap();
    git(&main, &["init", "--quiet", "--initial-branch", "main"]);
    fs::create_dir(main.join("specs")).unwrap();
    fs::write(main.join("specs/PRIORITIES.md"), "# Priorities\n").unwrap();
    git(&main, &["add", "."]);
    git(&main, &["commit", "--quiet", "-m", "chore: start"]);
    let worktree = base.join("todo-recurring");
    git(
        &main,
        &[
            "worktree",
            "add",
            "--quiet",
            "-b",
            FOLDER,
            worktree.to_str().unwrap(),
        ],
    );
    let folder = worktree.join("specs").join(FOLDER);
    fs::create_dir_all(&folder).unwrap();
    fs::write(folder.join("proposal.md"), "# Recurring tasks\n").unwrap();
    for (name, text) in files {
        fs::write(folder.join(name), text).unwrap();
    }
    git(&worktree, &["add", "."]);
    git(&worktree, &["commit", "--quiet", "-m", "docs: files"]);
    Fixture {
        _dir: dir,
        main,
        worktree,
    }
}

pub fn settings(fixture: &Fixture) -> Settings {
    Settings {
        repositories: vec![fixture.main.clone()],
        ..Settings::default()
    }
}
