//! Decisions as the workflow reads them: what a branch changes, the ledger of the default branch,
//! a decision edited after its spec's approval, and a decisions check's candidates.

use uraeda_core::actions::default_round::DefaultRound;
use uraeda_core::api;
use uraeda_core::check::check;
use uraeda_core::workspace::{Problem, Severity};

use crate::common::repo::TestRepo;
use crate::common::texts::{decision, spec};
use crate::common::{fixture, repository_file};

const FOLDER: &str = "2026-10-10-feature";
const SPEC: &str = "specs/2026-10-10-feature/spec.md";

fn decision_path(name: &str) -> String {
    format!("specs/decisions/{name}.md")
}

fn text(path: &str) -> String {
    std::fs::read_to_string(fixture(path)).unwrap()
}

/// `main` with the decisions `a`, `b`, and `c`, and a feature branch from it, its spec listing
/// `a`, with the checkout left on `main`.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    for name in ["a", "b", "c"] {
        repo.write(&decision_path(name), &decision("active"));
    }
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    let listed = "- **Changed: [a](../decisions/a.md)**. It changes.\n\nRelied on:";
    repo.write(
        SPEC,
        &spec("awaiting-human", 1, 1).replace("Relied on:", listed),
    );
    repo.commit("spec");
    repo.switch("main");
    repo
}

#[test]
fn a_branch_shows_the_decisions_it_changed_and_not_mains_own_moves() {
    let repo = repo();
    repo.switch(FOLDER);
    repo.write(
        &decision_path("a"),
        &decision("proposed").replace("A choice.", "Another choice."),
    );
    repo.remove(&decision_path("b"));
    repo.write(&decision_path("d"), &decision("proposed"));
    repo.commit("work");
    repo.switch("main");
    repo.write(
        &decision_path("c"),
        &decision("active").replace("A choice.", "Main moved on."),
    );
    repo.commit("main moves on");

    let changes = api::read_file(repo.path(), FOLDER, "spec.md")
        .unwrap()
        .decision_changes;

    let kinds: Vec<(&str, &str, bool)> = changes
        .iter()
        .map(|c| (c.name.as_str(), c.kind.as_str(), c.listed))
        .collect();
    assert_eq!(
        kinds,
        [
            ("a", "changed", true),
            ("b", "removed", false),
            ("d", "new", false)
        ]
    );
}

#[test]
fn a_decision_is_read_as_the_branch_has_it() {
    let repo = repo();
    repo.switch(FOLDER);
    repo.write(
        &decision_path("a"),
        &decision("proposed").replace("A choice.", "Another choice."),
    );
    repo.commit("work");
    repo.switch("main");

    let read = api::read_decision(repo.path(), FOLDER, "a").unwrap();

    assert_eq!(read.change.kind, "changed");
    for name in ["", "../x", "a/b", ".hidden", "missing"] {
        assert!(
            api::read_decision(repo.path(), FOLDER, name).is_err(),
            "{name:?}"
        );
    }
}

#[test]
fn the_ledger_holds_the_constitution_and_every_decision_of_the_default_branch() {
    let repo = TestRepo::new();
    repo.write(
        "specs/CONSTITUTION.md",
        &repository_file("specs/CONSTITUTION.md"),
    );
    repo.write(
        "specs/decisions/git.md",
        &repository_file("specs/decisions/git.md"),
    );
    repo.write(
        "specs/decisions/broken.md",
        "---\nstatus: [active\n---\n\n# Broken\n",
    );
    repo.write("specs/decisions/binary.md", "");
    std::fs::write(
        repo.path().join("specs/decisions/binary.md"),
        b"\xff\xfe\x00 not text",
    )
    .unwrap();
    repo.commit("docs: decisions");
    repo.switch_new("2026-10-10-feature");
    repo.write("specs/decisions/on-a-branch.md", &decision("proposed"));
    repo.commit("docs: a decision of a feature");
    repo.switch("main");

    let ledger = api::read_ledger(repo.path()).unwrap();

    let constitution = ledger.constitution.expect("a constitution");
    assert!(constitution.version.is_some() && !constitution.principles.is_empty());
    let names: Vec<&str> = ledger.decisions.iter().map(|d| d.name.as_str()).collect();
    assert!(
        names.contains(&"git") && !names.contains(&"on-a-branch"),
        "{names:?}"
    );
    let git = ledger.decisions.iter().find(|d| d.name == "git").unwrap();
    assert_eq!(git.status.as_deref(), Some("active"));
    assert!(!git.rules.is_empty(), "the rules are read");
    let broken = ledger
        .decisions
        .iter()
        .find(|d| d.name == "broken")
        .unwrap();
    assert!(
        broken.problem.is_some(),
        "a decision that cannot be read names its problem"
    );
    let binary = ledger
        .decisions
        .iter()
        .find(|d| d.name == "binary")
        .unwrap();
    assert!(binary.problem.is_some());
}

// A decision edited on a branch after its spec's approval is reported, as a warning.

fn unapproved(repo: &TestRepo, target: &str) -> Vec<Problem> {
    check(repo.path(), &repo.path().join(target))
        .unwrap()
        .into_iter()
        .filter(|problem| problem.rule == "decision.unapproved")
        .collect()
}

/// A repository whose `main` holds the decision `git`, on a feature branch whose spec waits for review.
fn feature_with_decision() -> TestRepo {
    let repo = TestRepo::new();
    repo.write(&decision_path("git"), &decision("active"));
    repo.commit("docs: decisions");
    repo.switch_new(FOLDER);
    repo.write(SPEC, &spec("awaiting-human", 1, 0));
    repo.commit("docs(feature): spec");
    repo
}

fn approve(repo: &TestRepo) {
    repo.write(SPEC, &spec("approved", 1, 0));
    repo.commit("docs(feature): approve the spec");
}

#[test]
fn a_decision_edited_after_the_approval_is_reported_whether_committed_or_not() {
    let repo = feature_with_decision();
    repo.write(
        &decision_path("git"),
        &decision("proposed").replace("A choice.", "A first choice."),
    );
    repo.commit("docs(feature): propose git");
    approve(&repo);
    assert!(
        unapproved(&repo, "specs").is_empty(),
        "an edit before the approval is approved"
    );

    repo.write(
        &decision_path("git"),
        &decision("proposed").replace("A choice.", "Another choice."),
    );
    assert_eq!(unapproved(&repo, "specs").len(), 1, "uncommitted");
    repo.commit("docs(feature): edit git");
    let found = unapproved(&repo, "specs");
    assert_eq!(found.len(), 1, "committed");
    assert_eq!(
        found[0].severity,
        Severity::Warning,
        "a warning, not an error"
    );
    assert_eq!(
        unapproved(&repo, "specs/2026-10-10-feature").len(),
        1,
        "also from the feature's folder"
    );
}

#[test]
fn activating_a_decision_after_the_approval_is_not_a_change() {
    let repo = feature_with_decision();
    repo.write(
        &decision_path("git"),
        &decision("proposed").replace("A choice.", "A new choice."),
    );
    repo.commit("docs(feature): propose git");
    approve(&repo);

    repo.write(
        &decision_path("git"),
        &decision("active")
            .replace("A choice.", "A new choice.")
            .replace("approved-by:", "approved-by: Ada"),
    );
    repo.commit("docs(feature): activate git");

    assert!(unapproved(&repo, "specs").is_empty());
}

// A decisions check on the default branch: its candidates are checked as decisions.

const CHECK: &str = "specs/DECISIONS-CHECK.md";
const CANDIDATE: &str = "specs/decisions-check/q1-a/ui-components.md";

fn check_repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/decisions/ui-components.md",
        &repository_file("skills/uraeda/assets/example/specs/decisions/ui-components.md"),
    );
    repo.write(CHECK, &text("DECISIONS-CHECK.md"));
    repo.write(CANDIDATE, &text("decisions-check/q1-a/ui-components.md"));
    repo.commit("chore: propose a check");
    repo
}

fn rules(problems: &[Problem]) -> Vec<String> {
    problems
        .iter()
        .map(|p| format!("{}: {}", p.file, p.rule))
        .collect()
}

#[test]
fn a_check_shows_each_options_candidate_against_the_active_decision() {
    let repo = check_repo();
    repo.write(
        "specs/decisions-check/q2-b/fresh-topic.md",
        &text("decisions-check/q1-a/ui-components.md"),
    );

    let view = api::read_round(repo.path(), DefaultRound::DecisionsCheck)
        .unwrap()
        .unwrap();

    let found: Vec<(&str, &str, &str)> = view
        .candidates
        .iter()
        .map(|c| {
            (
                c.question.as_str(),
                c.option.as_str(),
                c.change.kind.as_str(),
            )
        })
        .collect();
    assert_eq!(found, [("q1", "a", "changed"), ("q2", "b", "new")]);
    let triage = api::read_round(repo.path(), DefaultRound::Triage).unwrap();
    assert!(
        triage.is_none(),
        "the triage round has no candidates of the check"
    );
}

#[test]
fn candidates_are_checked_as_decisions_and_never_the_constitution() {
    let repo = check_repo();
    assert!(
        check(repo.path(), &repo.path().join("specs"))
            .unwrap()
            .is_empty()
    );

    repo.write(
        CANDIDATE,
        &text("decisions-check/q1-a/ui-components.md").replace("status: proposed", "status: maybe"),
    );
    let bad_status = check(repo.path(), &repo.path().join("specs")).unwrap();
    repo.write(CANDIDATE, &text("decisions-check/q1-a/ui-components.md"));
    repo.write(
        "specs/decisions-check/q1-a/constitution.md",
        "# Constitution\n",
    );
    repo.write("specs/decisions-check/notes/extra.md", "# Extra\n");
    let stray = check(repo.path(), &repo.path().join("specs")).unwrap();

    assert_eq!(bad_status.len(), 1, "{:?}", rules(&bad_status));
    assert_eq!(
        rules(&stray),
        [
            "specs/decisions-check/notes: names.candidate",
            "specs/decisions-check/q1-a/constitution.md: names.candidate"
        ]
    );
}
