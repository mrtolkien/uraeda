mod common;

use common::repo::TestRepo;
use uraeda_core::actions::default_round::DefaultRound;
use uraeda_core::api;

const TRIAGE: &str = "specs/INBOX-TRIAGE.md";

/// A repository on `main` with the fixture's inbox and its triage, committed.
fn triage_repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/INBOX.md",
        &std::fs::read_to_string(common::fixture("repo/main/specs/INBOX.md")).unwrap(),
    );
    repo.write(
        TRIAGE,
        &std::fs::read_to_string(common::fixture("INBOX-TRIAGE.md")).unwrap(),
    );
    repo.commit("chore: propose an inbox triage");
    repo
}

/// The hash of the triage as it is now, which a save is based on: the page read all of it.
fn base(repo: &TestRepo) -> String {
    api::read_round(repo.path(), DefaultRound::Triage)
        .unwrap()
        .map(|triage| triage.current.document.hash)
        .unwrap_or_default()
}

fn letters(picked: &[&str]) -> Vec<String> {
    picked.iter().map(|letter| letter.to_string()).collect()
}

/// The text of question `id` in a triage's text, up to the next question or the notes.
fn question<'a>(text: &'a str, id: &str) -> &'a str {
    let start = text.find(&format!("## {id}:")).unwrap();
    let rest = &text[start..];
    let end = ["\n## ", "\n**Notes:**"]
        .iter()
        .filter_map(|marker| rest[1..].find(marker).map(|at| at + 2))
        .min()
        .unwrap_or(rest.len());
    &rest[..end]
}

#[test]
fn without_a_triage_there_is_none_to_read() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");

    assert_eq!(
        api::read_round(repo.path(), DefaultRound::Triage).unwrap(),
        None
    );
}

/// The triage reads as a round of questions, outside any feature.
#[test]
fn the_triage_reads_as_a_round_of_questions() {
    let repo = triage_repo();

    let triage = api::read_round(repo.path(), DefaultRound::Triage)
        .unwrap()
        .unwrap();

    assert_eq!(triage.id, "inbox-triage");
    assert_eq!(triage.folder, "");
    assert_eq!(triage.name, "INBOX-TRIAGE.md");
    assert_eq!(triage.path, TRIAGE);
    assert_eq!(triage.kind, "clarifications");
    // Committed alone, with no folder for its images: the page offers no attach.
    assert!(!triage.takes_images);
    assert_eq!(triage.status.as_deref(), Some("awaiting-human"));
    let round = triage.current.items.clarifications.unwrap();
    let ids: Vec<_> = round.questions.iter().map(|q| q.id.as_str()).collect();
    assert_eq!(ids, ["Q1", "Q2", "Q3"]);
    assert_eq!(triage.committed, None);
}

/// US4 2: an answer is written under its question, in the triage, not in a feature's round.
#[test]
fn an_answer_is_written_under_its_question() {
    let repo = triage_repo();

    let saved = api::save_round_answer(
        repo.path(),
        DefaultRound::Triage,
        "Q1",
        &letters(&["A"]),
        "",
        "",
        &base(&repo),
    )
    .unwrap();

    let text = repo.read(TRIAGE);
    assert!(
        question(&text, "Q1").ends_with("**Answer:** A\n\n"),
        "{text}"
    );
    assert!(question(&text, "Q2").ends_with("**Answer:**\n\n"), "{text}");
    assert!(text.ends_with("**Notes:**\n"), "{text}");
    let round = saved.current.items.clarifications.unwrap();
    assert_eq!(round.questions[0].answer, "A");
    assert_eq!(saved.id, "inbox-triage");
    assert!(saved.committed.is_some(), "the answer is not committed");
    assert_eq!(repo.porcelain(), " M specs/INBOX-TRIAGE.md\n");
}

/// An answer saved over another than the one read is refused as a conflict.
#[test]
fn an_answer_changed_elsewhere_is_refused() {
    let repo = triage_repo();
    api::save_round_answer(
        repo.path(),
        DefaultRound::Triage,
        "Q1",
        &letters(&["A"]),
        "",
        "",
        &base(&repo),
    )
    .unwrap();

    let error = api::save_round_answer(
        repo.path(),
        DefaultRound::Triage,
        "Q1",
        &letters(&["B"]),
        "",
        "",
        &base(&repo),
    )
    .unwrap_err();

    assert_eq!(error.code, "conflict", "{}", error.message);
    assert!(question(&repo.read(TRIAGE), "Q1").contains("**Answer:** A\n"));
}

#[test]
fn the_notes_are_written_last() {
    let repo = triage_repo();

    api::save_round_notes(
        repo.path(),
        DefaultRound::Triage,
        "Keep the CLI notes for later.",
        "",
        &base(&repo),
    )
    .unwrap();

    assert!(
        repo.read(TRIAGE)
            .ends_with("**Notes:** Keep the CLI notes for later.\n")
    );
}

/// From a feature's checkout, the triage is answered on the default branch.
#[test]
fn from_a_feature_branch_answers_go_to_the_default_branch() {
    let repo = triage_repo();
    repo.switch_new("2026-10-14-run-ui");

    api::save_round_answer(
        repo.path(),
        DefaultRound::Triage,
        "Q2",
        &letters(&["B"]),
        "",
        "",
        &base(&repo),
    )
    .unwrap();

    assert!(
        question(&repo.read(".worktrees/main/specs/INBOX-TRIAGE.md"), "Q2")
            .contains("**Answer:** B\n")
    );
    assert!(question(&repo.read(TRIAGE), "Q2").ends_with("**Answer:**\n\n"));
}

/// US4 3: the submission commits the triage answered, its block turned into a record.
#[test]
fn submitting_commits_the_answered_triage() {
    let repo = triage_repo();
    for (id, letter) in [("Q1", "A"), ("Q2", "B"), ("Q3", "A")] {
        api::save_round_answer(
            repo.path(),
            DefaultRound::Triage,
            id,
            &letters(&[letter]),
            "",
            "",
            &base(&repo),
        )
        .unwrap();
    }

    let read = api::read_round(repo.path(), DefaultRound::Triage)
        .unwrap()
        .unwrap();

    let submitted = api::submit_round(
        repo.path(),
        DefaultRound::Triage,
        &read.current.document.hash,
    )
    .unwrap();

    assert_eq!(repo.subjects("main")[0], "chore: answer the inbox triage");
    assert_eq!(repo.changed_in("HEAD"), [TRIAGE]);
    let text = repo.read(TRIAGE);
    assert!(text.starts_with("---\nstatus: answered\n---\n"), "{text}");
    assert!(text.contains("> Answered on "), "{text}");
    assert!(!text.contains("[!IMPORTANT]"), "{text}");
    // The last answer ends at the notes, which have no section before them.
    assert!(text.ends_with("**Answer:** A\n\n**Notes:**\n"), "{text}");
    assert_eq!(submitted.status.as_deref(), Some("answered"));
    assert_eq!(submitted.committed, None);
    assert_eq!(repo.porcelain(), "");
}

/// A triage with a question unanswered is not submitted.
#[test]
fn a_triage_with_blank_answers_is_not_submitted() {
    let repo = triage_repo();
    api::save_round_answer(
        repo.path(),
        DefaultRound::Triage,
        "Q1",
        &letters(&["A"]),
        "",
        "",
        &base(&repo),
    )
    .unwrap();

    let read = api::read_round(repo.path(), DefaultRound::Triage)
        .unwrap()
        .unwrap();

    let error = api::submit_round(
        repo.path(),
        DefaultRound::Triage,
        &read.current.document.hash,
    )
    .unwrap_err();

    assert_eq!(error.message, "Q2 and Q3 have no answer");
    assert_eq!(repo.subjects("main")[0], "chore: propose an inbox triage");
}

/// An answered triage is a record: it takes no more answers.
#[test]
fn an_answered_triage_takes_no_answer() {
    let repo = triage_repo();
    let answered = repo
        .read(TRIAGE)
        .replace("status: awaiting-human", "status: answered");
    repo.write(TRIAGE, &answered);
    repo.commit("chore: answer the inbox triage");

    let error = api::save_round_answer(
        repo.path(),
        DefaultRound::Triage,
        "Q1",
        &letters(&["A"]),
        "",
        "",
        &base(&repo),
    )
    .unwrap_err();

    assert_eq!(error.message, "INBOX-TRIAGE.md is not waiting for answers");
}

/// A triage changed since the page read it is not submitted: the human did not see those answers.
#[test]
fn a_triage_changed_elsewhere_is_not_submitted() {
    let repo = triage_repo();
    for (id, letter) in [("Q1", "A"), ("Q2", "B")] {
        api::save_round_answer(
            repo.path(),
            DefaultRound::Triage,
            id,
            &letters(&[letter]),
            "",
            "",
            &base(&repo),
        )
        .unwrap();
    }
    let read = api::read_round(repo.path(), DefaultRound::Triage)
        .unwrap()
        .unwrap();
    api::save_round_answer(
        repo.path(),
        DefaultRound::Triage,
        "Q3",
        &letters(&["B"]),
        "",
        "",
        &base(&repo),
    )
    .unwrap();

    let error = api::submit_round(
        repo.path(),
        DefaultRound::Triage,
        &read.current.document.hash,
    )
    .unwrap_err();

    assert_eq!(error.code, "conflict", "{}", error.message);
    assert_eq!(repo.subjects("main")[0], "chore: propose an inbox triage");
    assert!(
        repo.read(TRIAGE)
            .starts_with("---\nstatus: awaiting-human\n")
    );
}

/// Two pages on the triage: notes saved over a triage another page answered since are refused,
/// so its answers are never submitted unseen.
#[test]
fn a_save_over_a_triage_changed_elsewhere_is_refused() {
    let repo = triage_repo();
    let seen = base(&repo);
    api::save_round_answer(
        repo.path(),
        DefaultRound::Triage,
        "Q2",
        &letters(&["B"]),
        "",
        "",
        &seen,
    )
    .unwrap();

    let notes = api::save_round_notes(
        repo.path(),
        DefaultRound::Triage,
        "Start with the bug.",
        "",
        &seen,
    )
    .unwrap_err();
    let answer = api::save_round_answer(
        repo.path(),
        DefaultRound::Triage,
        "Q1",
        &letters(&["A"]),
        "",
        "",
        &seen,
    )
    .unwrap_err();

    assert_eq!(notes.code, "conflict", "{}", notes.message);
    assert_eq!(answer.code, "conflict", "{}", answer.message);
    let text = repo.read(TRIAGE);
    assert!(text.ends_with("**Notes:**\n"), "{text}");
    assert!(question(&text, "Q1").ends_with("**Answer:**\n\n"), "{text}");
}

/// A commit the hook refused is tried again: the answered triage is committed alone.
#[test]
fn a_refused_submit_is_committed_by_a_retry() {
    let repo = triage_repo();
    for (id, letter) in [("Q1", "A"), ("Q2", "B"), ("Q3", "A")] {
        api::save_round_answer(
            repo.path(),
            DefaultRound::Triage,
            id,
            &letters(&[letter]),
            "",
            "",
            &base(&repo),
        )
        .unwrap();
    }
    repo.set_hook("echo 'refused'\nexit 1");
    let error = api::submit_round(repo.path(), DefaultRound::Triage, &base(&repo)).unwrap_err();
    assert_eq!(error.code, "hook", "{}", error.message);
    repo.set_hook("exit 0");

    let retried = api::retry_round(repo.path(), DefaultRound::Triage).unwrap();

    assert_eq!(repo.subjects("main")[0], "chore: answer the inbox triage");
    assert_eq!(repo.changed_in("HEAD"), [TRIAGE]);
    assert_eq!(retried.status.as_deref(), Some("answered"));
    assert_eq!(repo.porcelain(), "");
}

/// Only an answered triage the last commit does not hold is committed again.
#[test]
fn a_triage_not_answered_is_not_retried() {
    let repo = triage_repo();

    let error = api::retry_round(repo.path(), DefaultRound::Triage).unwrap_err();

    assert_eq!(error.message, "INBOX-TRIAGE.md has nothing to commit again");
}
