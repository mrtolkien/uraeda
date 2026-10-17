//! `ura check` warns when a decision changes on a branch after its spec's approval.

mod common;

use common::repo::TestRepo;
use common::texts::{decision, spec};
use uraeda_core::check::check;
use uraeda_core::workspace::{Problem, Severity};

const SPEC: &str = "specs/2026-10-10-feature/spec.md";
const GIT: &str = "specs/decisions/git.md";

/// The `decision.unapproved` warnings, as the CLI prints them.
fn unapproved(problems: &[Problem]) -> Vec<String> {
    problems
        .iter()
        .filter(|p| p.rule == "decision.unapproved")
        .map(|p| {
            let prefix = match p.severity {
                Severity::Error => "",
                Severity::Warning => "warning: ",
            };
            match p.line {
                Some(line) => format!("{prefix}{}:{line}: {}", p.file, p.message),
                None => format!("{prefix}{}: {}", p.file, p.message),
            }
        })
        .collect()
}

fn warnings(repo: &TestRepo, target: &str) -> Vec<String> {
    unapproved(&check(repo.path(), &repo.path().join(target)).unwrap())
}

/// A repository whose `main` holds `git.md`, on a feature branch whose spec waits for review.
fn feature() -> TestRepo {
    let repo = TestRepo::new();
    repo.write(GIT, &decision("active"));
    repo.write("specs/decisions/stack.md", &decision("active"));
    repo.commit("docs: decisions");
    repo.switch_new("2026-10-10-feature");
    repo.write(SPEC, &spec("awaiting-human", 1, 0));
    repo.commit("docs(feature): spec");
    repo
}

fn approve(repo: &TestRepo) {
    repo.write(SPEC, &spec("approved", 1, 0));
    repo.commit("docs(feature): approve the spec");
}

#[test]
fn a_decision_edited_after_the_approval_is_reported() {
    let repo = feature();
    repo.write(
        GIT,
        &decision("proposed").replace("A choice.", "A first choice."),
    );
    repo.commit("docs(feature): propose git");
    approve(&repo);
    repo.write(
        GIT,
        &decision("proposed").replace("A choice.", "Another choice."),
    );
    repo.commit("docs(feature): edit git");
    assert_eq!(
        warnings(&repo, "specs"),
        ["warning: specs/decisions/git.md: git.md changed after the spec's approval"]
    );
    assert_eq!(
        warnings(&repo, "specs/2026-10-10-feature"),
        ["warning: specs/decisions/git.md: git.md changed after the spec's approval"]
    );
}

#[test]
fn an_uncommitted_edit_after_the_approval_is_reported() {
    let repo = feature();
    approve(&repo);
    repo.write(
        GIT,
        &decision("active").replace("A choice.", "Another choice."),
    );
    assert_eq!(
        warnings(&repo, "specs"),
        ["warning: specs/decisions/git.md: git.md changed after the spec's approval"]
    );
}

#[test]
fn activating_a_decision_is_not_a_change() {
    let repo = feature();
    repo.write(
        GIT,
        &decision("proposed").replace("A choice.", "A new choice."),
    );
    repo.commit("docs(feature): propose git");
    approve(&repo);
    repo.write(
        GIT,
        &decision("active")
            .replace("A choice.", "A new choice.")
            .replace("approved-by:", "approved-by: Ada"),
    );
    repo.commit("docs(feature): activate git");
    assert_eq!(warnings(&repo, "specs"), Vec::<String>::new());
}

#[test]
fn edits_before_the_approval_are_approved() {
    let repo = feature();
    repo.write(
        GIT,
        &decision("proposed").replace("A choice.", "A first choice."),
    );
    repo.commit("docs(feature): propose git");
    approve(&repo);
    assert_eq!(warnings(&repo, "specs"), Vec::<String>::new());
}

#[test]
fn the_approval_is_the_first_commit_reading_approved() {
    let repo = feature();
    approve(&repo);
    repo.write(
        GIT,
        &decision("active").replace("A choice.", "Another choice."),
    );
    repo.commit("docs(feature): edit git");
    repo.write(
        SPEC,
        &spec("approved", 1, 0).replace("A feature.", "A feature, reworded."),
    );
    repo.commit("docs(feature): reword the approved spec");
    assert_eq!(
        warnings(&repo, "specs"),
        ["warning: specs/decisions/git.md: git.md changed after the spec's approval"]
    );
}

#[test]
fn a_spec_waiting_for_review_has_no_approval_commit() {
    let repo = feature();
    repo.write(
        GIT,
        &decision("proposed").replace("A choice.", "A first choice."),
    );
    repo.commit("docs(feature): propose git");
    assert_eq!(warnings(&repo, "specs"), Vec::<String>::new());
}

#[test]
fn a_decision_added_or_deleted_after_the_approval_is_reported() {
    let repo = feature();
    approve(&repo);
    repo.remove("specs/decisions/stack.md");
    repo.write("specs/decisions/tui.md", &decision("proposed"));
    repo.commit("docs(feature): add tui, drop stack");
    assert_eq!(
        warnings(&repo, "specs"),
        [
            "warning: specs/decisions/stack.md: stack.md changed after the spec's approval",
            "warning: specs/decisions/tui.md: tui.md changed after the spec's approval",
        ]
    );
}

#[test]
fn a_spec_approved_before_the_branch_has_no_approval_commit_on_it() {
    let repo = TestRepo::new();
    repo.write(GIT, &decision("active"));
    repo.write(SPEC, &spec("approved", 1, 0));
    repo.commit("docs: an approved spec");
    repo.switch_new("2026-10-10-feature");
    repo.write(
        SPEC,
        &spec("approved", 1, 0).replace("A feature.", "A feature, reworded."),
    );
    repo.commit("docs(feature): reword the spec");
    repo.write(
        GIT,
        &decision("active").replace("A choice.", "Another choice."),
    );
    repo.commit("docs(feature): edit git");
    assert_eq!(warnings(&repo, "specs"), Vec::<String>::new());
}

#[test]
fn the_default_branch_and_a_single_file_report_nothing() {
    let repo = feature();
    approve(&repo);
    repo.write(
        GIT,
        &decision("active").replace("A choice.", "Another choice."),
    );
    repo.commit("docs(feature): edit git");
    assert_eq!(warnings(&repo, SPEC), Vec::<String>::new());
    assert_eq!(warnings(&repo, GIT), Vec::<String>::new());
    repo.git(&["switch", "--quiet", "main"]);
    repo.git(&["merge", "--quiet", "--ff-only", "2026-10-10-feature"]);
    assert_eq!(warnings(&repo, "specs"), Vec::<String>::new());
}

#[test]
fn a_decision_merged_in_from_the_default_branch_is_not_the_branch_s_change() {
    let repo = feature();
    approve(&repo);
    repo.add_on_branch(
        "main",
        GIT,
        &decision("active").replace("A choice.", "Main's choice."),
    );
    repo.add_on_branch("main", "specs/decisions/tui.md", &decision("active"));
    repo.git(&["merge", "--quiet", "--no-edit", "main"]);
    assert_eq!(warnings(&repo, "specs"), Vec::<String>::new());
}

#[test]
fn a_decision_put_back_to_the_default_branch_s_text_after_the_approval_is_reported() {
    let repo = feature();
    repo.write(
        GIT,
        &decision("proposed").replace("A choice.", "A branch choice."),
    );
    repo.commit("docs(feature): propose git");
    approve(&repo);
    repo.write(GIT, &decision("active"));
    repo.commit("docs(feature): put git back");
    assert_eq!(
        warnings(&repo, "specs"),
        ["warning: specs/decisions/git.md: git.md changed after the spec's approval"]
    );
}

#[test]
fn a_decision_added_before_the_approval_then_deleted_is_reported() {
    let repo = feature();
    repo.write("specs/decisions/tui.md", &decision("proposed"));
    repo.commit("docs(feature): propose tui");
    approve(&repo);
    repo.remove("specs/decisions/tui.md");
    repo.commit("docs(feature): drop tui");
    assert_eq!(
        warnings(&repo, "specs"),
        ["warning: specs/decisions/tui.md: tui.md changed after the spec's approval"]
    );
}
