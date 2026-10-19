//! Answering a round of questions: answers are written on the feature's branch, never over a change
//! made elsewhere, committed through the user's hooks, and a submitted round is a record.

use uraeda_core::actions::default_round::DefaultRound;
use uraeda_core::api;

use crate::common::fixture;
use crate::common::repo::TestRepo;
use crate::common::texts::{clarifications, proposal};

pub(crate) const FOLDER: &str = "2026-10-11-web-ui";
const ROUND: &str = "specs/2026-10-11-web-ui/clarifications-01.md";

pub(crate) fn letters(picked: &[&str]) -> Vec<String> {
    picked.iter().map(ToString::to_string).collect()
}

/// `main` with a feature branch whose round of two questions waits for the human.
pub(crate) fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.write(
        ROUND,
        &clarifications("awaiting-human", "2 questions, about 4 minutes.", &["", ""]),
    );
    repo.commit("discovery(web-ui): web UI");
    repo.switch("main");
    repo
}

pub(crate) fn read(repo: &TestRepo) -> uraeda_core::view::FileView {
    api::read_file(repo.path(), FOLDER, "clarifications-01.md").unwrap()
}

pub(crate) fn worktree_round(repo: &TestRepo) -> String {
    repo.read(&format!(".worktrees/{FOLDER}/{ROUND}"))
}

fn waits_on(repo: &TestRepo) -> String {
    api::read_feature(repo.path(), FOLDER)
        .unwrap()
        .step
        .waits_on
}

#[test]
fn answers_are_written_on_the_features_branch_then_the_round_is_submitted() {
    let repo = repo();

    api::save_answer(repo.path(), FOLDER, "Q1", &letters(&["A"]), "", "").unwrap();
    api::save_answer(
        repo.path(),
        FOLDER,
        "Q2",
        &letters(&["A", "B"]),
        "but only on mobile",
        "",
    )
    .unwrap();
    api::save_notes(repo.path(), FOLDER, "Nothing else.", "").unwrap();

    assert_eq!(
        repo.current_branch(),
        "main",
        "the human's checkout is not switched"
    );
    let saved = worktree_round(&repo);
    assert!(saved.contains("**Answer:** A\n") && saved.contains("but only on mobile"));
    assert_eq!(
        waits_on(&repo),
        "human",
        "saved answers are not committed answers"
    );
    let commits = repo.subjects(FOLDER).len();

    api::submit_answers(repo.path(), FOLDER, Some("clarifications-01.md"), false).unwrap();

    assert_eq!(repo.subjects(FOLDER).len(), commits + 1);
    assert_eq!(repo.changed_in(FOLDER), [ROUND]);
    assert_eq!(read(&repo).status.as_deref(), Some("answered"));
    assert_eq!(waits_on(&repo), "agent");
    assert_eq!(repo.current_branch(), "main");
}

#[test]
fn a_round_with_a_blank_answer_is_not_submitted() {
    let repo = repo();
    api::save_answer(repo.path(), FOLDER, "Q1", &letters(&["A"]), "", "").unwrap();
    let commits = repo.subjects(FOLDER).len();

    let result = api::submit_answers(repo.path(), FOLDER, None, false);

    assert!(result.is_err());
    assert_eq!(repo.subjects(FOLDER).len(), commits);
    assert_eq!(read(&repo).status.as_deref(), Some("awaiting-human"));
}

#[test]
fn an_answer_is_refused_over_a_change_made_elsewhere_or_with_markdown_structure() {
    let repo = repo();
    api::save_answer(repo.path(), FOLDER, "Q1", &letters(&["A"]), "", "").unwrap();
    let before = worktree_round(&repo);

    let stale = api::save_answer(
        repo.path(),
        FOLDER,
        "Q1",
        &letters(&["B"]),
        "",
        "something else",
    );
    let heading = api::save_answer(repo.path(), FOLDER, "Q2", &[], "# heading", "");
    let notes = api::save_notes(repo.path(), FOLDER, "# heading", "");

    assert!(stale.is_err() && heading.is_err() && notes.is_err());
    assert_eq!(worktree_round(&repo), before);
}

#[test]
fn a_commit_the_hook_refuses_keeps_the_answers_and_can_be_tried_again() {
    let repo = repo();
    api::save_answer(repo.path(), FOLDER, "Q1", &letters(&["A"]), "", "").unwrap();
    api::save_answer(repo.path(), FOLDER, "Q2", &letters(&["B"]), "", "").unwrap();
    repo.set_hook("echo refused >&2; exit 1");
    let commits = repo.subjects(FOLDER).len();

    let refused = api::submit_answers(repo.path(), FOLDER, None, false);

    assert!(refused.is_err());
    assert_eq!(
        repo.subjects(FOLDER).len(),
        commits,
        "nothing was committed"
    );
    assert!(
        worktree_round(&repo).contains("**Answer:** A\n"),
        "the answers are kept"
    );

    repo.set_hook("exit 0");
    api::retry_commit(repo.path(), FOLDER, "clarifications-01.md").unwrap();

    assert_eq!(repo.subjects(FOLDER).len(), commits + 1);
    assert_eq!(waits_on(&repo), "agent");
}

#[test]
fn a_submitted_round_is_a_record_that_takes_no_more_answers() {
    let repo = repo();
    api::save_answer(repo.path(), FOLDER, "Q1", &letters(&["A"]), "", "").unwrap();
    api::save_answer(repo.path(), FOLDER, "Q2", &letters(&["B"]), "", "").unwrap();
    api::submit_answers(repo.path(), FOLDER, None, false).unwrap();
    let before = worktree_round(&repo);

    let writes = [
        api::save_answer(repo.path(), FOLDER, "Q1", &letters(&["B"]), "", "A"),
        api::save_notes(repo.path(), FOLDER, "More.", ""),
        api::add_settled_comment(repo.path(), FOLDER, "A point", "Text."),
        api::submit_answers(repo.path(), FOLDER, None, false),
    ];

    assert!(writes.iter().all(Result::is_err));
    assert_eq!(worktree_round(&repo), before);
}

#[test]
fn settled_points_take_comments_that_survive_the_free_notes() {
    let repo = repo();

    api::add_settled_comment(repo.path(), FOLDER, "A point", "Keep it.").unwrap();
    api::add_settled_comment(repo.path(), FOLDER, "A point", "Also this.").unwrap();
    let stale = api::edit_settled_comment(
        repo.path(),
        FOLDER,
        1,
        "A point",
        "Drop it.",
        "Not what is there",
    );
    api::edit_settled_comment(
        repo.path(),
        FOLDER,
        1,
        "A point",
        "Keep it, say so.",
        "Keep it.",
    )
    .unwrap();
    api::save_notes(repo.path(), FOLDER, "Free notes.", "").unwrap();
    let unknown = api::add_settled_comment(repo.path(), FOLDER, "No such point", "Text.");
    let heading = api::add_settled_comment(repo.path(), FOLDER, "A point", "Fine.\n# Heading");

    assert!(stale.is_err() && unknown.is_err() && heading.is_err());
    let text = worktree_round(&repo);
    assert!(
        text.contains("Keep it, say so.")
            && text.contains("Also this.")
            && text.contains("Free notes.")
    );
    api::remove_settled_comment(repo.path(), FOLDER, 1, "A point", "Keep it, say so.").unwrap();
    let text = worktree_round(&repo);
    assert!(!text.contains("Keep it, say so.") && text.contains("Also this."));
}

fn default_repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/INBOX.md",
        &std::fs::read_to_string(fixture("repo/main/specs/INBOX.md")).unwrap(),
    );
    let triage = std::fs::read_to_string(fixture("INBOX-TRIAGE.md")).unwrap();
    repo.write("specs/INBOX-TRIAGE.md", &triage);
    repo.write(
        "specs/DECISIONS-CHECK.md",
        &triage.replace("# Inbox triage", "# Decisions check"),
    );
    repo.commit("chore: propose a triage and a check");
    repo
}

fn base(repo: &TestRepo, round: DefaultRound) -> String {
    api::read_round(repo.path(), round)
        .unwrap()
        .map(|view| view.current.document.hash)
        .unwrap_or_default()
}

#[test]
fn the_triage_and_the_decisions_check_are_answered_on_the_default_branch_each_alone() {
    let repo = default_repo();
    let check_before = repo.read("specs/DECISIONS-CHECK.md");

    for (id, letter) in [("Q1", "A"), ("Q2", "B"), ("Q3", "A")] {
        let hash = base(&repo, DefaultRound::Triage);
        api::save_round_answer(
            repo.path(),
            DefaultRound::Triage,
            id,
            &letters(&[letter]),
            "",
            "",
            &hash,
        )
        .unwrap();
    }
    assert_eq!(
        repo.read("specs/DECISIONS-CHECK.md"),
        check_before,
        "the other round is untouched"
    );
    let stale = api::save_round_answer(
        repo.path(),
        DefaultRound::Triage,
        "Q1",
        &letters(&["B"]),
        "",
        "",
        "an old hash",
    );
    assert!(stale.is_err());
    let commits = repo.subjects("main").len();

    let hash = base(&repo, DefaultRound::Triage);
    api::submit_round(repo.path(), DefaultRound::Triage, &hash).unwrap();

    assert_eq!(repo.subjects("main").len(), commits + 1);
    assert_eq!(repo.changed_in("main"), ["specs/INBOX-TRIAGE.md"]);
    assert_eq!(repo.read("specs/DECISIONS-CHECK.md"), check_before);
}
