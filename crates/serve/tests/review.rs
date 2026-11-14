//! The review's page and writes, on the example's spec in a temporary repository: comments and
//! verdicts land in the files, what changed since the last review is listed, and nothing is ever
//! committed.

mod support;

use std::fs;
use std::process::Command;

use support::Server;
use support::repo::{FOLDER, Fixture, fixture, git, settings};

const EXAMPLE: &str =
    include_str!("../../../skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/spec.md");

fn waiting_spec() -> String {
    EXAMPLE.replacen("status: approved", "status: awaiting-human", 1)
}

fn head(fixture: &Fixture) -> String {
    let output = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .current_dir(&fixture.worktree)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .output()
        .unwrap();
    String::from_utf8(output.stdout).unwrap().trim().to_string()
}

fn file(fixture: &Fixture, name: &str) -> Option<String> {
    fs::read_to_string(fixture.worktree.join("specs").join(FOLDER).join(name)).ok()
}

fn base(server: &Server) -> String {
    format!("/{}/todo/{FOLDER}/review/spec.md", server.token)
}

/// The line of the first line of text starting with `start` in the spec.
fn line_of(start: &str) -> usize {
    waiting_spec()
        .lines()
        .position(|line| line.starts_with(start))
        .unwrap()
        + 1
}

#[test]
fn the_review_page_draws_the_spec_with_its_lines_and_the_verdict() {
    let f = fixture(&[("spec.md", waiting_spec())]);
    let server = Server::with(settings(&f));
    let answer = server.get(&base(&server));
    assert_eq!(answer.status(), 200);
    let page = answer.into_body().read_to_string().unwrap();
    assert!(page.contains("Approve the spec"), "{page}");
    assert!(page.contains("Tap a passage to comment on it"));
    assert!(page.contains("id=\"review-data\""));
    assert!(!page.contains("Changed since your last review"));
    assert_eq!(
        server
            .get(&format!("/{}/todo/{FOLDER}/review/x.md", server.token))
            .status(),
        404
    );
}

#[test]
fn a_comment_then_a_request_for_changes_without_a_commit() {
    let f = fixture(&[("spec.md", waiting_spec())]);
    let before = head(&f);
    let server = Server::with(settings(&f));
    let refused = server.write(
        &format!("{}/verdict", base(&server)),
        r#"{"verdict":"request-changes"}"#,
    );
    assert_eq!(refused.status(), 422, "changes need a comment");
    let line = line_of("## Edge cases");
    let commented = server.write(
        &format!("{}/comment", base(&server)),
        &format!(r#"{{"lines":[{line},{line}],"text":"Add one for time zones."}}"#),
    );
    assert_eq!(commented.status(), 200);
    let body = commented.into_body().read_to_string().unwrap();
    assert!(body.contains("Add one for time zones."), "{body}");
    let review = file(&f, "spec-review.md").unwrap();
    assert!(review.contains("verdict: pending"), "{review}");
    assert!(
        review.contains(&format!("## C1: Line {line}, under \"Edge cases\"")),
        "{review}"
    );
    let sent = server.write(
        &format!("{}/verdict", base(&server)),
        r#"{"verdict":"request-changes","summary":"Close."}"#,
    );
    assert_eq!(sent.status(), 200);
    assert!(
        file(&f, "spec.md")
            .unwrap()
            .contains("status: changes-requested")
    );
    assert!(
        file(&f, "spec-review.md")
            .unwrap()
            .contains("verdict: changes-requested")
    );
    assert_eq!(head(&f), before);
}

#[test]
fn a_comment_is_edited_then_removed() {
    let f = fixture(&[("spec.md", waiting_spec())]);
    let server = Server::with(settings(&f));
    let comment = |body: &str| server.write(&format!("{}/comment", base(&server)), body);
    assert_eq!(
        comment(r#"{"lines":null,"text":"Fine overall."}"#).status(),
        200
    );
    assert_eq!(
        comment(r#"{"number":1,"text":"Good overall."}"#).status(),
        200
    );
    assert!(
        file(&f, "spec-review.md")
            .unwrap()
            .contains("Good overall.")
    );
    assert_eq!(comment(r#"{"number":1,"text":""}"#).status(), 200);
    assert_eq!(
        file(&f, "spec-review.md"),
        None,
        "the last comment takes the file with it"
    );
}

#[test]
fn approving_sets_the_spec_approved_without_a_commit() {
    let f = fixture(&[("spec.md", waiting_spec())]);
    let before = head(&f);
    let server = Server::with(settings(&f));
    let sent = server.write(
        &format!("{}/verdict", base(&server)),
        r#"{"verdict":"approve"}"#,
    );
    assert_eq!(sent.status(), 200);
    assert!(file(&f, "spec.md").unwrap().contains("status: approved"));
    assert_eq!(head(&f), before);
    let again = server.write(
        &format!("{}/verdict", base(&server)),
        r#"{"verdict":"approve"}"#,
    );
    assert_eq!(again.status(), 409, "the spec no longer waits");
}

#[test]
fn what_changed_since_the_last_review_is_listed() {
    let f = fixture(&[("spec.md", waiting_spec())]);
    let reviewed = head(&f);
    let folder = f.worktree.join("specs").join(FOLDER);
    let short = &reviewed[..7];
    fs::write(
        folder.join("spec-review.md"),
        format!(
            "---\nverdict: changes-requested\ncommit: {short}\n---\n\n# Review: Spec, Recurring \
             tasks\n\n## C1: General\n\nMore edge cases.\n"
        ),
    )
    .unwrap();
    let revised = waiting_spec().replacen(
        "## Edge cases\n",
        "## Edge cases\n\n- A task moved across a time zone keeps its calendar day.\n",
        1,
    );
    fs::write(folder.join("spec.md"), revised).unwrap();
    git(&f.worktree, &["add", "."]);
    git(&f.worktree, &["commit", "--quiet", "-m", "spec: revise"]);
    let server = Server::with(settings(&f));
    let page = server
        .get(&base(&server))
        .into_body()
        .read_to_string()
        .unwrap();
    assert!(
        page.contains("Changed since your last review: 1 part"),
        "{page}"
    );
    assert!(page.contains("time zone keeps its calendar day"));
}
