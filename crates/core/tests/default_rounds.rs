//! The two rounds on the default branch, the triage and the decisions check, answered by the same
//! code: each writes its own file, hash, and commit subject, and never the other's.

mod common;

use common::repo::TestRepo;
use uraeda_core::actions::default_round::DefaultRound;
use uraeda_core::api;

const TRIAGE: &str = "specs/INBOX-TRIAGE.md";
const CHECK: &str = "specs/DECISIONS-CHECK.md";

/// A repository on `main` with the fixture's triage and a check of the same text under the check's
/// name and title, committed together.
fn repo_with_both_files() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/INBOX.md",
        &std::fs::read_to_string(common::fixture("repo/main/specs/INBOX.md")).unwrap(),
    );
    let triage = std::fs::read_to_string(common::fixture("INBOX-TRIAGE.md")).unwrap();
    repo.write(TRIAGE, &triage);
    repo.write(
        CHECK,
        &triage.replace("# Inbox triage", "# Decisions check"),
    );
    repo.commit("chore: propose a triage and a check");
    repo
}

fn letters(picked: &[&str]) -> Vec<String> {
    picked.iter().map(|letter| letter.to_string()).collect()
}

/// The hash of the round as it is now, which a save is based on.
fn base(repo: &TestRepo, round: DefaultRound) -> String {
    api::read_round(repo.path(), round)
        .unwrap()
        .map(|view| view.current.document.hash)
        .unwrap_or_default()
}

fn answer_all(repo: &TestRepo, round: DefaultRound) {
    for (id, letter) in [("Q1", "A"), ("Q2", "B"), ("Q3", "A")] {
        api::save_round_answer(
            repo.path(),
            round,
            id,
            &letters(&[letter]),
            "",
            "",
            &base(repo, round),
        )
        .unwrap();
    }
}

#[test]
fn each_round_has_its_own_file_id_and_subject() {
    assert_eq!(DefaultRound::Triage.path(), TRIAGE);
    assert_eq!(DefaultRound::DecisionsCheck.path(), CHECK);
    assert_eq!(
        DefaultRound::from_id("inbox-triage"),
        Some(DefaultRound::Triage)
    );
    assert_eq!(
        DefaultRound::from_id("decisions-check"),
        Some(DefaultRound::DecisionsCheck)
    );
    assert_eq!(DefaultRound::from_id("spec"), None);
    assert!(api::default_round("spec").is_err());
}

#[test]
fn a_write_to_the_triage_never_touches_a_waiting_check() {
    let repo = repo_with_both_files();
    let check_before = repo.read(CHECK);

    api::save_round_answer(
        repo.path(),
        DefaultRound::Triage,
        "Q1",
        &letters(&["A"]),
        "",
        "",
        &base(&repo, DefaultRound::Triage),
    )
    .unwrap();

    assert_eq!(repo.read(CHECK), check_before);
    assert!(repo.read(TRIAGE).contains("**Answer:** A\n"));
}

#[test]
fn a_write_to_the_check_never_touches_a_waiting_triage() {
    let repo = repo_with_both_files();
    let triage_before = repo.read(TRIAGE);

    api::save_round_notes(
        repo.path(),
        DefaultRound::DecisionsCheck,
        "Merge them.",
        "",
        &base(&repo, DefaultRound::DecisionsCheck),
    )
    .unwrap();

    assert_eq!(repo.read(TRIAGE), triage_before);
    assert!(repo.read(CHECK).contains("Merge them."));
}

#[test]
fn each_round_commits_with_its_own_subject() {
    let repo = repo_with_both_files();

    for (round, path, subject) in [
        (
            DefaultRound::Triage,
            TRIAGE,
            "chore: answer the inbox triage",
        ),
        (
            DefaultRound::DecisionsCheck,
            CHECK,
            "chore: answer the decisions check",
        ),
    ] {
        answer_all(&repo, round);
        api::submit_round(repo.path(), round, &base(&repo, round)).unwrap();

        assert_eq!(repo.subjects("main")[0], subject);
        assert_eq!(repo.changed_in("HEAD"), [path]);
    }
}

#[test]
fn a_save_based_on_the_other_rounds_hash_is_refused() {
    let repo = repo_with_both_files();
    let triage_hash = base(&repo, DefaultRound::Triage);
    let check_before = repo.read(CHECK);

    let error = api::save_round_answer(
        repo.path(),
        DefaultRound::DecisionsCheck,
        "Q1",
        &letters(&["A"]),
        "",
        "",
        &triage_hash,
    )
    .unwrap_err();

    assert_eq!(error.code, "conflict");
    assert_eq!(repo.read(CHECK), check_before);
}

#[test]
fn a_missing_round_reads_as_none() {
    let repo = repo_with_both_files();
    repo.remove(CHECK);
    repo.commit("chore: drop the check");

    assert_eq!(
        api::read_round(repo.path(), DefaultRound::DecisionsCheck).unwrap(),
        None
    );
    assert!(
        api::read_round(repo.path(), DefaultRound::Triage)
            .unwrap()
            .is_some()
    );
}

#[test]
fn dismissing_the_triage_deletes_it_alone_in_its_own_commit() {
    let repo = repo_with_both_files();
    let check_before = repo.read(CHECK);
    // A note added since, and not committed: someone's work, which the dismissal leaves as it is.
    repo.write("specs/INBOX.md", "# Inbox\n\n- A new note\n");

    api::dismiss_round(
        repo.path(),
        DefaultRound::Triage,
        &base(&repo, DefaultRound::Triage),
    )
    .unwrap();

    assert!(!repo.exists(TRIAGE));
    assert_eq!(repo.subjects("main")[0], "chore: dismiss the inbox triage");
    assert_eq!(repo.changed_in("HEAD"), [TRIAGE]);
    assert_eq!(repo.read(CHECK), check_before);
    assert_eq!(repo.read("specs/INBOX.md"), "# Inbox\n\n- A new note\n");
    // The inbox has no triage left, so a new one can be asked for.
    assert!(
        api::read_round(repo.path(), DefaultRound::Triage)
            .unwrap()
            .is_none()
    );
    assert_eq!(api::read_inbox(repo.path()).unwrap().triage, None);
}

#[test]
fn dismissing_a_triage_changed_since_it_was_read_is_refused() {
    let repo = repo_with_both_files();
    let read = base(&repo, DefaultRound::Triage);
    answer_all(&repo, DefaultRound::Triage);
    let answered = repo.read(TRIAGE);

    let error = api::dismiss_round(repo.path(), DefaultRound::Triage, &read).unwrap_err();

    assert!(error.to_string().contains("INBOX-TRIAGE.md"), "{error}");
    assert_eq!(repo.read(TRIAGE), answered);
    assert_eq!(
        repo.subjects("main")[0],
        "chore: propose a triage and a check"
    );
}

#[test]
fn the_decisions_check_cannot_be_dismissed() {
    let repo = repo_with_both_files();
    let check_before = repo.read(CHECK);

    let error = api::dismiss_round(
        repo.path(),
        DefaultRound::DecisionsCheck,
        &base(&repo, DefaultRound::DecisionsCheck),
    )
    .unwrap_err();

    assert!(error.to_string().contains("cannot be dismissed"), "{error}");
    assert_eq!(repo.read(CHECK), check_before);
}

#[test]
fn a_triage_never_committed_is_not_dismissed() {
    let repo = repo_with_both_files();
    repo.git(&["rm", "--quiet", "--cached", TRIAGE]);
    repo.git(&[
        "commit",
        "--quiet",
        "--no-verify",
        "-m",
        "chore: forget the triage",
    ]);
    let text = repo.read(TRIAGE);

    let error = api::dismiss_round(
        repo.path(),
        DefaultRound::Triage,
        &base(&repo, DefaultRound::Triage),
    )
    .unwrap_err();

    assert!(error.to_string().contains("never committed"), "{error}");
    assert_eq!(repo.read(TRIAGE), text);
}

#[test]
fn a_triage_already_gone_is_refused_in_words() {
    let repo = repo_with_both_files();
    let read = base(&repo, DefaultRound::Triage);
    api::dismiss_round(repo.path(), DefaultRound::Triage, &read).unwrap();

    let error = api::dismiss_round(repo.path(), DefaultRound::Triage, &read).unwrap_err();

    assert!(
        error.to_string().contains("No inbox triage waits"),
        "{error}"
    );
    assert_eq!(repo.subjects("main")[0], "chore: dismiss the inbox triage");
}
