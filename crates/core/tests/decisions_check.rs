//! A decisions check on the default branch and its candidates: the check's view holds each option's
//! candidate against the active decision, and `ura check` validates the files.

mod common;

use common::repo::TestRepo;
use uraeda_core::actions::default_round::DefaultRound;
use uraeda_core::check;
use uraeda_core::view::FileView;
use uraeda_core::{api, workspace::Problem};

const CHECK: &str = "specs/DECISIONS-CHECK.md";
const CANDIDATE: &str = "specs/decisions-check/q1-a/ui-components.md";
const ACTIVE: &str = "specs/decisions/ui-components.md";

fn fixture(path: &str) -> String {
    std::fs::read_to_string(common::fixture(path)).unwrap()
}

/// A repository on `main` with an active decision, the fixture's check, and its candidate.
fn check_repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        ACTIVE,
        &common::repository_file("skills/uraeda/assets/example/specs/decisions/ui-components.md"),
    );
    repo.write(CHECK, &fixture("DECISIONS-CHECK.md"));
    repo.write(CANDIDATE, &fixture("decisions-check/q1-a/ui-components.md"));
    repo.commit("chore: propose a check");
    repo
}

fn view(repo: &TestRepo) -> FileView {
    api::read_round(repo.path(), DefaultRound::DecisionsCheck)
        .unwrap()
        .unwrap()
}

fn problems(repo: &TestRepo) -> Vec<Problem> {
    check::check(repo.path(), &repo.path().join("specs")).unwrap()
}

fn rules(found: &[Problem]) -> Vec<String> {
    found
        .iter()
        .map(|p| format!("{}: {}", p.file, p.rule))
        .collect()
}

#[test]
fn the_view_of_a_check_holds_each_options_candidate_compared_with_the_active_decision() {
    let repo = check_repo();

    let view = view(&repo);

    assert_eq!(view.candidates.len(), 1);
    let candidate = &view.candidates[0];
    assert_eq!(
        (candidate.question.as_str(), candidate.option.as_str()),
        ("q1", "a")
    );
    assert_eq!(candidate.change.name, "ui-components");
    assert_eq!(candidate.change.kind, "changed");
    assert!(
        candidate
            .change
            .sections
            .iter()
            .any(|s| s.parts.iter().any(|p| p.kind != "kept"))
    );
}

#[test]
fn a_candidate_of_a_new_decision_is_new() {
    let repo = check_repo();
    repo.write(
        "specs/decisions-check/q2-b/fresh-topic.md",
        &fixture("decisions-check/q1-a/ui-components.md"),
    );

    let view = view(&repo);

    let new = &view.candidates[1];
    assert_eq!((new.question.as_str(), new.option.as_str()), ("q2", "b"));
    assert_eq!(new.change.kind, "new");
}

#[test]
fn the_view_reads_the_candidates_from_the_tip_when_no_checkout_has_the_default_branch() {
    let repo = check_repo();
    repo.git(&["switch", "--quiet", "--create", "other"]);
    repo.git(&["worktree", "add", "--quiet", "--detach", "../elsewhere"]);
    repo.git(&["switch", "--quiet", "--detach"]);

    let view = view(&repo);

    assert_eq!(view.candidates.len(), 1);
}

#[test]
fn the_triage_has_no_candidates() {
    let repo = check_repo();
    repo.write("specs/INBOX-TRIAGE.md", &fixture("INBOX-TRIAGE.md"));
    repo.commit("chore: a triage too");

    let view = api::read_round(repo.path(), DefaultRound::Triage)
        .unwrap()
        .unwrap();

    assert!(view.candidates.is_empty());
}

#[test]
fn ura_check_reports_nothing_on_a_check_and_its_candidates() {
    let repo = check_repo();

    assert_eq!(rules(&problems(&repo)), Vec::<String>::new());
}

#[test]
fn a_candidate_is_checked_as_a_decision() {
    let repo = check_repo();
    repo.write(
        CANDIDATE,
        &fixture("decisions-check/q1-a/ui-components.md")
            .replace("status: proposed", "status: maybe"),
    );

    assert_eq!(
        rules(&problems(&repo)).len(),
        1,
        "{:?}",
        rules(&problems(&repo))
    );
}

#[test]
fn a_candidate_that_edits_the_constitution_is_a_problem() {
    let repo = check_repo();
    repo.write(
        "specs/decisions-check/q1-a/CONSTITUTION.md",
        "# Constitution\n",
    );

    assert_eq!(
        rules(&problems(&repo)),
        vec!["specs/decisions-check/q1-a/CONSTITUTION.md: names.candidate"]
    );
}

#[test]
fn a_stray_folder_is_reported_and_an_option_with_no_candidate_shows_none() {
    let repo = check_repo();
    repo.write("specs/decisions-check/notes/extra.md", "# Extra\n");

    assert_eq!(
        rules(&problems(&repo)),
        vec!["specs/decisions-check/notes: names.candidate"]
    );
    // Q1's option B and all of Q2 name no candidate: the view holds only option A's.
    let view = view(&repo);
    assert_eq!(view.candidates.len(), 1);
    assert_eq!(view.candidates[0].option, "a");
}

#[test]
fn a_view_without_any_candidate_folder_has_none() {
    let repo = check_repo();
    std::fs::remove_dir_all(repo.path().join("specs/decisions-check")).unwrap();

    assert!(view(&repo).candidates.is_empty());
}

#[test]
fn a_candidate_copied_from_a_decision_is_checked_as_that_decision() {
    let repo = check_repo();
    repo.write(
        "specs/decisions/preview.md",
        &common::repository_file("skills/uraeda/assets/example/specs/decisions/preview.md"),
    );
    repo.write("specs/CONSTITUTION.md", "# Constitution\n");
    // Relative links of a decision resolve from `specs/decisions/`, as if the candidate sat there.
    repo.write(
        CANDIDATE,
        &format!(
            "{}\nSee [preview](preview.md) and [the constitution](../CONSTITUTION.md).\n",
            fixture("decisions-check/q1-a/ui-components.md").trim_end()
        ),
    );
    // `preview.md` takes the preview fields.
    repo.write(
        "specs/decisions-check/q1-b/preview.md",
        &common::repository_file("skills/uraeda/assets/example/specs/decisions/preview.md"),
    );

    let found = check::check(repo.path(), &repo.path().join("specs/decisions-check")).unwrap();

    assert_eq!(rules(&found), Vec::<String>::new());
}

#[test]
fn a_candidate_named_constitution_in_any_case_is_a_problem_and_no_candidate() {
    let repo = check_repo();
    repo.write(
        "specs/decisions-check/q1-a/constitution.md",
        "# Constitution\n",
    );

    assert_eq!(
        rules(&problems(&repo)),
        vec!["specs/decisions-check/q1-a/constitution.md: names.candidate"]
    );
    assert_eq!(view(&repo).candidates.len(), 1);
}
