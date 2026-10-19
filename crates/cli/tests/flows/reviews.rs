//! `ura review`: comments pile up in a pending review file, a verdict commits the spec with its
//! review, and a verdict is refused over a review that is not of the committed version.

use crate::common::*;

const FOLDER: &str = "2026-10-10-cli-core";
const SPEC: &str = "specs/2026-10-10-cli-core/spec.md";
const REVIEW: &str = "specs/2026-10-10-cli-core/spec-review.md";

/// A spec waiting for review, 60 lines long.
fn long_spec() -> String {
    let mut text = spec("awaiting-human", 1, 1);
    text.push_str("\n## User stories\n\n### US1: Make a task repeat (P1)\n\n");
    while text.lines().count() < 59 {
        text.push_str("Filler.\n");
    }
    for line in 60..=70 {
        text.push_str(&format!("Story line {line}.\n"));
    }
    text
}

fn waiting() -> TestRepo {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    );
    let round = clarifications("answered", "Answered on 2026-10-08.", &["A"]);
    feature(
        &repo,
        FOLDER,
        &[
            ("proposal.md", proposal()),
            ("clarifications-01.md", round),
            ("spec.md", long_spec()),
        ],
    );
    repo.switch(FOLDER);
    repo
}

fn waits_on(repo: &TestRepo) -> (String, String) {
    let json: serde_json::Value =
        serde_json::from_str(&ura(repo, &["next", "cli-core", "--json"]).stdout).unwrap();
    (
        json["step"]["name"].as_str().unwrap().into(),
        json["step"]["waits-on"].as_str().unwrap().into(),
    )
}

fn comment(repo: &TestRepo, lines: &str, text: &str) -> Output {
    ura(repo, &["review", "cli-core", "--comment", lines, text])
}

#[test]
fn comments_quote_their_lines_and_a_request_for_changes_commits_them_with_the_spec() {
    let repo = waiting();
    let commits = repo.subjects("HEAD").len();

    assert_eq!(comment(&repo, "62-64", "Name the field").code, 0);
    assert_eq!(comment(&repo, "general", "And overall").code, 0);

    let review = repo.read(REVIEW);
    assert!(
        review.contains("> Story line 62.\n> Story line 63.\n> Story line 64.")
            && review.contains("Name the field")
    );
    assert_eq!(
        repo.subjects("HEAD").len(),
        commits,
        "comments are not commits"
    );

    let output = ura(
        &repo,
        &[
            "review",
            "cli-core",
            "--request-changes",
            "--summary",
            "Not yet",
        ],
    );

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(repo.read(SPEC).contains("status: changes-requested\n"));
    assert!(repo.read(REVIEW).contains("Not yet"));
    assert_eq!(repo.changed_in("HEAD"), [REVIEW, SPEC]);
    assert_eq!(repo.subjects("HEAD").len(), commits + 1);
    assert_eq!(waits_on(&repo).1, "agent");
    assert_eq!(repo.hook_runs(), 1);
}

#[test]
fn approving_commits_the_status_and_keeps_pending_comments_for_the_next_step_but_not_an_old_review()
{
    let repo = waiting();
    comment(&repo, "general", "A note for the plan");

    let output = ura(&repo, &["review", "cli-core", "--approve"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(repo.read(SPEC).contains("status: approved\n"));
    assert!(
        repo.read(REVIEW).contains("verdict: approved")
            && repo.read(REVIEW).contains("A note for the plan")
    );
    assert_eq!(waits_on(&repo), ("plan".into(), "agent".into()));

    let old = waiting();
    old.write(REVIEW, "---\nverdict: changes-requested\ncommit: 0000000\n---\n\n# Review: Spec, Feature\n\n## C1: General\n\nOld.\n");
    old.commit("old review");
    assert_eq!(ura(&old, &["review", "cli-core", "--approve"]).code, 0);
    assert!(
        !old.exists(REVIEW),
        "a review of an earlier version is deleted"
    );
}

#[test]
fn the_risk_tier_and_the_plan_review_are_set_on_approval() {
    let rows: [(&str, &str, &str); 3] = [
        (
            "risk-tier: low\n",
            "--risk-tier high",
            "risk-tier: high\nplan-review: false\n",
        ),
        (
            "risk-tier: low\nplan-review: true\n",
            "",
            "risk-tier: low\nplan-review: true\n",
        ),
        (
            "risk-tier: low\n",
            "--risk-tier medium --plan-review true",
            "risk-tier: medium\nplan-review: true\n",
        ),
    ];
    for (before, flags, expected) in rows {
        let repo = waiting();
        repo.write(SPEC, &long_spec().replace("risk-tier: low\n", before));
        repo.git(&["add", "--all"]);
        repo.git(&[
            "commit",
            "--quiet",
            "--no-verify",
            "--allow-empty",
            "--message",
            "spec with its tier",
        ]);
        let mut args = vec!["review", "cli-core", "--approve"];
        args.extend(flags.split_whitespace());

        let output = ura(&repo, &args);

        assert_eq!(output.code, 0, "{flags}: {}", output.stderr);
        assert!(
            repo.read(SPEC).contains(expected),
            "{flags}: {}",
            repo.read(SPEC)
        );
    }
}

#[test]
fn a_verdict_or_a_comment_that_is_not_allowed_changes_nothing() {
    let repo = waiting();
    let commits = repo.subjects("HEAD").len();

    assert_eq!(
        ura(&repo, &["review", "cli-core", "--request-changes"]).code,
        1,
        "a request needs a comment"
    );
    assert_eq!(
        comment(&repo, "general", "See\n## C2: more").code,
        1,
        "a comment cannot hold a heading"
    );
    assert_eq!(comment(&repo, "900", "Outside the file").code, 1);
    assert_eq!(
        ura(&repo, &["review", "--comment", "5"]).code,
        1,
        "a usage error"
    );

    assert!(!repo.exists(REVIEW));
    assert!(repo.read(SPEC).contains("status: awaiting-human"));
    assert_eq!(repo.subjects("HEAD").len(), commits);
}

#[test]
fn a_review_that_is_not_of_the_committed_version_is_refused_or_kept() {
    let repo = waiting();
    comment(&repo, "general", "first");
    repo.write(SPEC, &format!("{}Line C.\n", repo.read(SPEC)));
    repo.commit("edit the spec");

    let older = ura(&repo, &["review", "--approve"]);

    assert_eq!(
        older.code, 1,
        "a review of an older version is not approved"
    );
    assert!(
        repo.read(SPEC).contains("status: awaiting-human") && repo.read(REVIEW).contains("first")
    );

    let broken = "---\nverdict: pending\ncommit: abc1234\n---\n\n# Review: Spec, Feature\n\n## C1: Lines 40-41 under \"US1\"\n\nMine.\n";
    repo.write(REVIEW, broken);
    let unparsable = ura(&repo, &["review", "--approve"]);

    assert_eq!(unparsable.code, 1);
    assert_eq!(
        repo.read(REVIEW),
        broken,
        "a review that does not parse is kept"
    );
}

#[test]
fn a_pending_review_survives_an_unrelated_commit() {
    let repo = waiting();
    comment(&repo, "general", "first");
    repo.write("README.md", "# Other\n");
    repo.commit("other");

    comment(&repo, "general", "second");

    let review = repo.read(REVIEW);
    assert!(
        review.contains("first") && review.contains("second"),
        "{review}"
    );
}

#[test]
fn a_plan_is_reviewed_like_a_spec_and_an_assessment_is_not_reviewed() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    );
    let round = clarifications("answered", "Answered.", &["A"]);
    let plan_text = plan("awaiting-human", 1, &[("One", 0, 1)]);
    feature(
        &repo,
        FOLDER,
        &[
            ("proposal.md", proposal()),
            ("clarifications-01.md", round),
            ("spec.md", spec("approved", 1, 1)),
            ("plan.md", plan_text),
        ],
    );
    repo.switch(FOLDER);

    let reviewed = ura(&repo, &["review", "cli-core", "--approve"]);

    assert_eq!(reviewed.code, 0, "{}", reviewed.stderr);
    assert!(
        repo.read("specs/2026-10-10-cli-core/plan.md")
            .contains("status: approved")
    );
}
