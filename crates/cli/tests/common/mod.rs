#![allow(dead_code, unused_imports)]

#[path = "../../../core/tests/common/repo.rs"]
pub mod repo;
#[path = "../../../core/tests/common/texts.rs"]
pub mod texts;

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

pub use repo::TestRepo;
pub use texts::*;

/// A path inside the repository's shared `fixtures/` folder.
pub fn fixture(path: &str) -> String {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures")
        .join(path)
        .to_string_lossy()
        .into_owned()
}

/// This repository's top level.
pub fn repository() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap()
}

pub struct Output {
    pub stdout: String,
    pub stderr: String,
    pub code: i32,
}

impl Output {
    /// The cells of the stdout line starting with `name`, split on runs of two spaces or more.
    pub fn row(&self, name: &str) -> Vec<String> {
        let line = self
            .stdout
            .lines()
            .find(|line| line.trim_start().starts_with(name))
            .unwrap_or_else(|| panic!("no line for {name} in:\n{}", self.stdout));
        line.trim()
            .split("  ")
            .map(str::trim)
            .filter(|cell| !cell.is_empty())
            .map(String::from)
            .collect()
    }
}

/// Runs the built `ura` in a repository, on 2026-10-11, without a terminal or colours, with the
/// repository's home folder as `HOME`, and git without the machine's configuration.
pub fn ura(repo: &TestRepo, args: &[&str]) -> Output {
    let home = repo.home();
    ura_in(repo.path(), args, &[("HOME", home.to_str().unwrap())])
}

/// Runs the built `ura` in a folder, with extra environment variables. `HOME` is a new temporary
/// folder unless `env` names it, so no test reads or writes the real home folder.
pub fn ura_in(dir: &Path, args: &[&str], env: &[(&str, &str)]) -> Output {
    let home = tempfile::TempDir::new().expect("a temporary folder");
    let mut command = command(dir, args);
    if !env.iter().any(|(name, _)| *name == "HOME") {
        command.env("HOME", home.path());
    }
    run(command.envs(env.iter().copied()))
}

/// Runs the built `ura` in a folder, without `HOME`.
pub fn ura_without_home(dir: &Path, args: &[&str]) -> Output {
    run(command(dir, args).env_remove("HOME"))
}

fn command(dir: &Path, args: &[&str]) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_ura"));
    repo::without_user_git(&mut command)
        .args(args)
        .current_dir(dir)
        .env("URA_TODAY", "2026-10-11")
        .env("NO_COLOR", "1")
        .stdin(Stdio::null());
    command
}

fn run(command: &mut Command) -> Output {
    let output = command.output().expect("ura runs");
    Output {
        stdout: String::from_utf8(output.stdout).unwrap(),
        stderr: String::from_utf8(output.stderr).unwrap(),
        code: output.status.code().unwrap_or(-1),
    }
}

/// The number of files of the skill `ura` embeds, `skills/uraeda/`.
pub fn skill_files() -> usize {
    fn count(dir: &Path) -> usize {
        std::fs::read_dir(dir)
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .map(|path| if path.is_dir() { count(&path) } else { 1 })
            .sum()
    }
    count(&repository().join("skills/uraeda"))
}

/// The repository's `specs/` folder, with a constitution and priorities.
pub fn specs(repo: &TestRepo, priorities: &str) {
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/CONSTITUTION.md", "# Constitution\n");
    repo.write("specs/PRIORITIES.md", priorities);
    repo.commit("chore: specs");
}

/// Commits a feature's files on its own branch, created from `main`, then goes back to `main`.
/// A bug's branch is `fix/<folder>`.
pub fn feature(repo: &TestRepo, folder: &str, files: &[(&str, String)]) {
    branch_with(repo, folder, &feature_path(folder), files);
}

/// Commits files under `dir` on a new branch from `main`, then goes back to `main`.
pub fn branch_with(repo: &TestRepo, branch: &str, dir: &str, files: &[(&str, String)]) {
    repo.switch("main");
    repo.switch_new(branch);
    for (name, text) in files {
        repo.write(&format!("{dir}/{name}"), text);
    }
    repo.commit(&format!("work on {branch}"));
    repo.switch("main");
}

/// Where a feature's or a bug's folder lives: `fix/2026-10-14-x` is `specs/bugs/2026-10-14-x`.
pub fn feature_path(folder: &str) -> String {
    match folder.strip_prefix("fix/") {
        Some(bug) => format!("specs/bugs/{bug}"),
        None => format!("specs/{folder}"),
    }
}

/// On a feature's branch, replaces its folder with its record, and commits; then back on `main`.
pub fn finish(repo: &TestRepo, folder: &str) {
    repo.switch(folder);
    repo.git(&["rm", "-r", "--quiet", &feature_path(folder)]);
    repo.write(
        &format!("specs/done/{folder}.md"),
        &record("feature", "Web UI"),
    );
    repo.commit(&format!("finish: {folder}"));
    repo.switch("main");
}

/// Finishes a feature's branch, and merges it into `main` with a merge commit.
pub fn finish_and_merge(repo: &TestRepo, folder: &str) {
    finish(repo, folder);
    repo.git(&["merge", "--quiet", "--no-ff", "--no-edit", folder]);
}
