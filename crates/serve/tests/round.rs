//! The round's page and writes, on the example's round in a temporary repository: each write lands
//! in the round's file, a stale one is refused, and nothing is ever committed.

mod support;

use std::fs;
use std::process::Command;

use support::Server;
use support::repo::{FOLDER, Fixture, fixture, settings};

const EXAMPLE: &str = include_str!(
    "../../../skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/clarifications-01.md"
);

/// The example's round, waiting for answers, with Q4 answered "A" and Q5 blank.
fn waiting_round() -> String {
    EXAMPLE.replacen("status: answered", "status: awaiting-human", 1)
}

fn head(fixture: &Fixture) -> String {
    let output = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .current_dir(&fixture.worktree)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .output()
        .unwrap();
    String::from_utf8(output.stdout).unwrap()
}

fn on_disk(fixture: &Fixture) -> String {
    fs::read_to_string(
        fixture
            .worktree
            .join("specs")
            .join(FOLDER)
            .join("clarifications-01.md"),
    )
    .unwrap()
}

fn base() -> String {
    format!("/todo/{FOLDER}")
}

#[test]
fn the_round_page_draws_each_question_and_its_options() {
    let f = fixture(&[("clarifications-01.md", waiting_round())]);
    let server = Server::with(settings(&f));
    let answer = server.get(&format!("{}/round", base()));
    assert_eq!(answer.status(), 200);
    let page = answer.into_body().read_to_string().unwrap();
    assert!(
        page.contains("How should users pick when a task repeats?"),
        "{page}"
    );
    assert!(page.contains("★ Recommended"));
    assert!(
        page.contains("data-combine=\"1\""),
        "Q1 says its options combine"
    );
    // Q2 is answered C: its follow-up on B is not asked.
    let follow_up = page.find("id=\"Q2.B\"").unwrap();
    assert!(page[follow_up..follow_up + 200].contains("hidden"));
    assert!(page.contains("Settled without you"));
    for word in [
        "clarifications-01.md",
        "awaiting-human",
        "commit",
        "**Answer:**",
    ] {
        assert!(!page.contains(word), "the page says {word}");
    }
}

#[test]
fn an_answer_is_written_at_once_and_nothing_is_committed() {
    let f = fixture(&[("clarifications-01.md", waiting_round())]);
    let before = head(&f);
    let server = Server::with(settings(&f));
    let answer = server.write(
        &format!("{}/answer", base()),
        r#"{"id":"Q4","letters":["B"],"comment":"UTC is fine.","previous":"A"}"#,
    );
    assert_eq!(answer.status(), 200);
    let body = answer.into_body().read_to_string().unwrap();
    assert!(body.contains("\"answer\":\"B: UTC is fine.\""), "{body}");
    assert!(on_disk(&f).contains("**Answer:** B: UTC is fine."));
    assert_eq!(head(&f), before);
}

#[test]
fn an_answer_over_one_that_changed_is_refused() {
    let f = fixture(&[("clarifications-01.md", waiting_round())]);
    let server = Server::with(settings(&f));
    let answer = server.write(
        &format!("{}/answer", base()),
        r#"{"id":"Q4","letters":["B"],"comment":"","previous":"C"}"#,
    );
    assert_eq!(answer.status(), 409);
    assert!(on_disk(&f).contains("**Answer:** A\n"));
}

#[test]
fn a_write_from_another_site_is_refused() {
    let f = fixture(&[("clarifications-01.md", waiting_round())]);
    let server = Server::with(settings(&f));
    let answer = server.post(
        &format!("{}/answer", base()),
        &[("origin", "https://evil.example")],
        r#"{"id":"Q4","letters":["B"],"previous":"A"}"#,
    );
    assert_eq!(answer.status(), 403);
}

#[test]
fn sending_the_answers_records_the_round_answered_without_a_commit() {
    let f = fixture(&[("clarifications-01.md", waiting_round())]);
    let before = head(&f);
    let server = Server::with(settings(&f));
    let blank = server.write(
        &format!("{}/answer", base()),
        r#"{"id":"Q4","letters":[],"comment":"","previous":"A"}"#,
    );
    assert_eq!(blank.status(), 200);
    let refused = server.write(&format!("{}/submit", base()), "{}");
    assert_eq!(refused.status(), 422, "Q4 has no answer");
    let filled = server.write(
        &format!("{}/answer", base()),
        r#"{"id":"Q4","letters":["A"],"comment":"","previous":""}"#,
    );
    assert_eq!(filled.status(), 200);
    let sent = server.write(&format!("{}/submit", base()), "{}");
    assert_eq!(sent.status(), 200);
    let body = sent.into_body().read_to_string().unwrap();
    assert!(body.contains("Tell your session to continue."), "{body}");
    let text = on_disk(&f);
    assert!(text.contains("status: answered"));
    assert!(text.contains("Answered on "));
    assert_eq!(head(&f), before);
}

#[test]
fn a_comment_on_a_settled_point_goes_in_the_notes() {
    let f = fixture(&[("clarifications-01.md", waiting_round())]);
    let server = Server::with(settings(&f));
    let answer = server.write(
        &format!("{}/settled", base()),
        r#"{"subject":"Skipping one occurrence","number":0,"text":"Add a skip later.","previous":""}"#,
    );
    assert_eq!(answer.status(), 200);
    assert!(
        on_disk(&f).contains("- **Skipping one occurrence**: Add a skip later."),
        "{}",
        on_disk(&f)
    );
}
