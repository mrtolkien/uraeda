#![allow(dead_code)]

#[path = "../../../core/tests/common/repo.rs"]
pub mod repo;

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

pub use repo::TestRepo;

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

/// Runs the built `ura` in a repository, on 2026-10-11, without a terminal or colours.
pub fn ura(repo: &TestRepo, args: &[&str]) -> Output {
    ura_in(repo.path(), args, &[])
}

/// Runs the built `ura` in a folder, with extra environment variables.
pub fn ura_in(dir: &Path, args: &[&str], env: &[(&str, &str)]) -> Output {
    let output = Command::new(env!("CARGO_BIN_EXE_ura"))
        .args(args)
        .current_dir(dir)
        .env("URA_TODAY", "2026-10-11")
        .env("NO_COLOR", "1")
        .envs(env.iter().copied())
        .stdin(Stdio::null())
        .output()
        .expect("ura runs");
    Output {
        stdout: String::from_utf8(output.stdout).unwrap(),
        stderr: String::from_utf8(output.stderr).unwrap(),
        code: output.status.code().unwrap_or(-1),
    }
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

pub fn proposal() -> String {
    "# Feature\n\n## What\n\nA thing.\n\n## Why\n\nA reason.\n".to_string()
}

fn block(status: &str, first_line: &str) -> String {
    let kind = if status == "awaiting-human" {
        "IMPORTANT"
    } else {
        "NOTE"
    };
    format!("> [!{kind}]\n>\n> {first_line}\n>\n> - A point.\n")
}

/// A round of questions: one question per answer, each with options A and B.
pub fn clarifications(status: &str, first_line: &str, answers: &[&str]) -> String {
    let mut text = format!(
        "---\nstatus: {status}\n---\n\n# Clarifications, round 01: Feature\n\n{}\n## Context\n\nContext.\n",
        block(status, first_line)
    );
    for (index, answer) in answers.iter().enumerate() {
        let separator = if answer.is_empty() { "" } else { " " };
        text.push_str(&format!(
            "\n## Q{}: Question {}?\n\nWhy.\n\n- **A (recommended). One.**\n  - [pro] p\n- **B. Two.**\n  - [con] c\n\n**Answer:**{separator}{answer}\n",
            index + 1,
            index + 1
        ));
    }
    text.push_str("\n## Settled without the human\n\n- **A point** settled.\n\n**Notes:**\n");
    text
}

pub fn spec(status: &str, revision: u32, clarifications: u32) -> String {
    format!(
        "---\nstatus: {status}\nrevision: {revision}\nclarifications: {clarifications}\nrisk-tier: low\n---\n\n# Spec: Feature\n\n{}\nA feature.\n\n## Decisions\n\nRelied on:\n\n- None.\n",
        block(status, "Spec to review, about 20 minutes.")
    )
}

/// A plan whose tasks have `done` of `total` steps checked.
pub fn plan(status: &str, spec_revision: u32, tasks: &[(&str, usize, usize)]) -> String {
    let mut text =
        format!("---\nstatus: {status}\nspec-revision: {spec_revision}\n---\n\n# Plan: Feature\n");
    for (index, (title, done, total)) in tasks.iter().enumerate() {
        text.push_str(&format!("\n## Task {}: {title}\n\n", index + 1));
        for step in 0..*total {
            let mark = if step < *done { "x" } else { " " };
            text.push_str(&format!("- [{mark}] **Step {}: Do**\n", step + 1));
        }
    }
    text
}

pub fn decision(status: &str) -> String {
    format!("---\nstatus: {status}\napproved-by:\n---\n\n# Topic\n\nA choice.\n")
}
