//! What the runner reads from the core before a run: the feature's next step, and the directory
//! the agent works in.

mod common;

use std::path::Path;

use common::repo::TestRepo;
use common::texts::{clarifications, proposal, record};
use uraeda_core::api;

const FOLDER: &str = "2026-10-11-web-ui";
const DIR: &str = "specs/2026-10-11-web-ui";

/// A repository on `main`, and a feature branch with its proposal and `round` as round 01.
fn repo_with_round(round: &str) -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", "# Priorities\n\n## Now\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write(&format!("{DIR}/proposal.md"), &proposal());
    repo.write(&format!("{DIR}/clarifications-01.md"), round);
    repo.commit("discovery: round 01");
    repo.switch("main");
    repo
}

/// A branch whose round 01 is answered: the next step is the spec, for an agent.
fn repo_with_answered_round() -> TestRepo {
    repo_with_round(&clarifications("answered", "Answered.", &["A", "B"]))
}

#[test]
fn next_step_gives_the_reference_of_an_agent_step() {
    let repo = repo_with_answered_round();

    let next = api::next_step(repo.path(), FOLDER).unwrap();

    assert_eq!(next.folder, FOLDER);
    assert_eq!(next.step.name, "spec");
    assert_eq!(next.step.waits_on, "agent");
    assert_eq!(
        next.step.reference.as_deref(),
        Some("skills/uraeda/references/spec.md")
    );
    assert_eq!(next.step.file, None);
    assert_eq!(next.branch.as_deref(), Some(FOLDER));
    assert_eq!(
        Path::new(&next.main_root),
        repo.path().canonicalize().unwrap()
    );
}

#[test]
fn next_step_of_a_gate_names_its_file() {
    let repo = repo_with_round(&clarifications(
        "awaiting-human",
        "Two questions.",
        &["", ""],
    ));

    let next = api::next_step(repo.path(), FOLDER).unwrap();

    assert_eq!(next.step.name, "human-gate");
    assert_eq!(next.step.waits_on, "human");
    assert_eq!(next.step.file.as_deref(), Some("clarifications-01.md"));
    assert_eq!(next.step.reference, None);
}

#[test]
fn next_step_of_an_unknown_folder_is_refused() {
    let repo = repo_with_answered_round();

    let error = api::next_step(repo.path(), "2026-10-12-nothing").unwrap_err();

    assert_eq!(error.code, "refused");
    assert_eq!(error.message, "no feature 2026-10-12-nothing");
}

#[test]
fn work_dir_creates_the_worktree_of_a_branch_not_checked_out() {
    let repo = repo_with_answered_round();

    let dir = api::work_dir(repo.path(), FOLDER).unwrap();

    let expected = repo.path().join(".worktrees").join(FOLDER);
    assert_eq!(Path::new(&dir), expected);
    assert!(expected.join(DIR).join("proposal.md").exists());
    assert_eq!(repo.current_branch(), "main");
}

#[test]
fn work_dir_reuses_the_checkout_that_has_the_branch() {
    let repo = repo_with_answered_round();
    repo.switch(FOLDER);

    let dir = api::work_dir(repo.path(), FOLDER).unwrap();

    assert_eq!(Path::new(&dir), repo.path());
    assert!(!repo.exists(".worktrees"));
}

#[test]
fn main_root_of_a_worktree_is_the_main_checkout() {
    let repo = repo_with_answered_round();
    let worktree = api::work_dir(repo.path(), FOLDER).unwrap();
    let main = repo.path().canonicalize().unwrap();

    assert_eq!(
        Path::new(&api::main_root(Path::new(&worktree)).unwrap()),
        main
    );
    assert_eq!(Path::new(&api::main_root(repo.path()).unwrap()), main);
}

#[test]
fn work_dir_of_a_merged_feature_is_refused() {
    let repo = repo_with_answered_round();
    repo.switch(FOLDER);
    repo.git(&["rm", "-r", "--quiet", DIR]);
    repo.write(
        &format!("specs/done/{FOLDER}.md"),
        &record("feature", "Web UI"),
    );
    repo.commit("finish: web UI");
    repo.switch("main");
    repo.git(&["merge", "--quiet", "--no-ff", "--no-edit", FOLDER]);
    repo.delete_branch(FOLDER);

    let error = api::work_dir(repo.path(), FOLDER).unwrap_err();

    assert_eq!(error.code, "refused");
    assert_eq!(error.message, format!("{FOLDER} has no branch"));
    assert!(!repo.exists(".worktrees"));
}
