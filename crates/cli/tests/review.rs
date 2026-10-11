mod common;

use common::*;

const SPEC: &str = "specs/2026-10-10-cli-core/spec.md";
const REVIEW: &str = "specs/2026-10-10-cli-core/spec-review.md";

/// A spec waiting for review, 60 lines long, whose lines 41 to 60 are "Story line N." under
/// "### US2: Edit a repeat (P1)", on line 40.
fn long_spec() -> String {
    let mut text = spec("awaiting-human", 1, 1);
    text.push_str("\n## User stories\n\n### US1: Make a task repeat (P1)\n\n");
    while text.lines().count() < 39 {
        text.push_str("Filler.\n");
    }
    text.push_str("### US2: Edit a repeat (P1)\n");
    for line in 41..=60 {
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
    feature(
        &repo,
        "2026-10-10-cli-core",
        &[
            ("proposal.md", proposal()),
            (
                "clarifications-01.md",
                clarifications("answered", "Answered on 2026-10-08.", &["A"]),
            ),
            ("spec.md", long_spec()),
        ],
    );
    repo.switch("2026-10-10-cli-core");
    repo
}

fn tip(repo: &TestRepo) -> String {
    repo.git(&["rev-parse", "--short=7", "HEAD"])
        .trim()
        .to_string()
}

#[test]
fn a_comment_quotes_its_lines_under_their_heading() {
    let repo = waiting();

    let output = ura(
        &repo,
        &["review", "cli-core", "--comment", "50-52", "Name the field"],
    );

    assert_eq!(
        repo.read(REVIEW),
        format!(
            "---\nverdict: pending\ncommit: {}\n---\n\n# Review: Spec, Feature\n\n## C1: Lines 50–52, under \"US2: Edit a repeat (P1)\"\n\n> Story line 50.\n> Story line 51.\n> Story line 52.\n\nName the field\n",
            tip(&repo)
        )
    );
    assert_eq!(
        output.stdout,
        format!("C1 added to {REVIEW}, on lines 50–52, under \"US2: Edit a repeat (P1)\".\n")
    );
    assert_eq!(repo.subjects("HEAD").len(), 3);
}

#[test]
fn request_changes_commits_the_spec_and_its_review() {
    let repo = waiting();
    ura(
        &repo,
        &["review", "cli-core", "--comment", "50-52", "Name the field"],
    );

    let output = ura(
        &repo,
        &[
            "review",
            "cli-core",
            "--request-changes",
            "--summary",
            "Name the field",
        ],
    );

    let spec = repo.read(SPEC);
    assert!(spec.contains("status: changes-requested\n"));
    assert!(spec.contains("> [!NOTE]\n>\n> Changes requested on 2026-10-11: Name the field\n"));
    assert!(
        repo.read(REVIEW)
            .starts_with("---\nverdict: changes-requested\n")
    );
    assert!(
        repo.read(REVIEW)
            .contains("# Review: Spec, Feature\n\nName the field\n\n## C1")
    );
    assert_eq!(repo.subjects("HEAD")[0], "spec(cli-core): request changes");
    assert_eq!(
        repo.git(&["log", "-1", "--format=%b"]).trim(),
        "Name the field"
    );
    assert_eq!(repo.changed_in("HEAD"), [REVIEW, SPEC]);
    assert_eq!(
        output.stdout,
        "Changes requested on spec.md, committed as \"spec(cli-core): request changes\".\n"
    );
}

#[test]
fn request_changes_needs_a_comment() {
    let repo = waiting();

    let output = ura(&repo, &["review", "cli-core", "--request-changes"]);

    assert_eq!(
        output.stderr,
        "ura: a request for changes needs at least one comment: ura review cli-core --comment <lines> <text>\n"
    );
    assert_eq!(output.code, 1);
    assert!(repo.read(SPEC).contains("status: awaiting-human"));
}

#[test]
fn approve_deletes_an_old_review() {
    let repo = waiting();
    repo.write(
        REVIEW,
        "---\nverdict: changes-requested\ncommit: 0000000\n---\n\n# Review: Spec, Feature\n\n## C1: General\n\nOld.\n",
    );
    repo.commit("old review");

    let output = ura(&repo, &["review", "cli-core", "--approve"]);

    assert!(repo.read(SPEC).contains("status: approved\n"));
    assert!(
        repo.read(SPEC)
            .contains("> [!NOTE]\n>\n> Approved on 2026-10-11.\n")
    );
    assert!(!repo.exists(REVIEW));
    assert_eq!(repo.subjects("HEAD")[0], "spec(cli-core): approve");
    assert_eq!(repo.changed_in("HEAD"), [REVIEW, SPEC]);
    assert_eq!(
        output.stdout,
        "spec.md approved, committed as \"spec(cli-core): approve\".\n"
    );
}

#[test]
fn approve_with_a_high_risk_tier_reviews_the_plan() {
    let repo = waiting();

    ura(
        &repo,
        &["review", "cli-core", "--approve", "--risk-tier", "high"],
    );

    assert!(
        repo.read(SPEC)
            .contains("risk-tier: high\nplan-review: true\n"),
        "{}",
        repo.read(SPEC)
    );
}

#[test]
fn approve_keeps_the_proposed_plan_review() {
    let repo = waiting();
    repo.write(
        SPEC,
        &long_spec().replace("risk-tier: low\n", "risk-tier: low\nplan-review: true\n"),
    );
    repo.commit("spec with a plan review");

    ura(&repo, &["review", "cli-core", "--approve"]);

    assert!(
        repo.read(SPEC)
            .contains("risk-tier: low\nplan-review: true\n"),
        "{}",
        repo.read(SPEC)
    );
}

/// `long_spec()` with `risk-tier: <tier>` and `plan-review: <value>`.
fn spec_with(tier: &str, plan_review: &str) -> String {
    long_spec().replace(
        "risk-tier: low\n",
        &format!("risk-tier: {tier}\nplan-review: {plan_review}\n"),
    )
}

/// Approves a spec committed with `text`, with `flags`, and returns the approved spec.
fn approved(text: &str, flags: &[&str]) -> String {
    let repo = waiting();
    if text != long_spec() {
        repo.write(SPEC, text);
        repo.commit("spec");
    }
    let mut args = vec!["review", "cli-core", "--approve"];
    args.extend_from_slice(flags);
    let output = ura(&repo, &args);
    assert_eq!(output.code, 0, "{}", output.stderr);
    repo.read(SPEC)
}

#[test]
fn approve_sets_the_plan_review_for_any_tier() {
    for (text, flags, expected) in [
        (
            spec_with("high", "true"),
            &["--plan-review", "false"][..],
            "risk-tier: high\nplan-review: false\n",
        ),
        (
            long_spec(),
            &["--risk-tier", "high", "--plan-review", "false"],
            "risk-tier: high\nplan-review: false\n",
        ),
        (
            long_spec(),
            &["--plan-review", "true"],
            "risk-tier: low\nplan-review: true\n",
        ),
        (
            spec_with("high", "true"),
            &["--risk-tier", "medium"],
            "risk-tier: medium\nplan-review: false\n",
        ),
        (
            spec_with("medium", "true"),
            &["--risk-tier", "medium"],
            "risk-tier: medium\nplan-review: true\n",
        ),
        (
            spec_with("high", "\"yes\""),
            &[],
            "risk-tier: high\nplan-review: true\n",
        ),
        (
            long_spec().replace("risk-tier: low", "risk-tier: high"),
            &[],
            "risk-tier: high\nplan-review: true\n",
        ),
    ] {
        let spec = approved(&text, flags);
        assert!(spec.contains(expected), "{flags:?}: {spec}");
    }
}

#[test]
fn approve_with_a_comment_and_a_new_risk_tier() {
    let repo = waiting();
    ura(
        &repo,
        &[
            "review",
            "cli-core",
            "--comment",
            "general",
            "Shorter names",
        ],
    );

    ura(
        &repo,
        &["review", "cli-core", "--approve", "--risk-tier", "medium"],
    );

    let spec = repo.read(SPEC);
    assert!(spec.contains("status: approved\n"));
    assert!(
        spec.contains("risk-tier: medium\nplan-review: false\n"),
        "{spec}"
    );
    assert!(repo.read(REVIEW).starts_with("---\nverdict: approved\n"));
    assert!(
        repo.read(REVIEW)
            .contains("## C1: General\n\nShorter names\n")
    );
}

#[test]
fn a_bug_assessment() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    );
    feature(
        &repo,
        "fix/2026-10-14-completed-tasks-reappear",
        &[
            ("report.md", "# Report\n\nIt breaks.\n".to_string()),
            (
                "assessment.md",
                "---\nstatus: awaiting-human\n---\n\n# Assessment: Reappear\n\n> [!IMPORTANT]\n>\n> Assessment to review, about 5 minutes.\n>\n> - A point.\n\n## Fix\n\n- [ ] Step 1\n".to_string(),
            ),
        ],
    );

    let output = ura(&repo, &["review", "completed-tasks-reappear", "--approve"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(repo.current_branch(), "main");
    assert!(
        repo.read(".worktrees/fix/2026-10-14-completed-tasks-reappear/specs/bugs/2026-10-14-completed-tasks-reappear/assessment.md")
            .contains("status: approved\n")
    );
    assert_eq!(
        repo.subjects("fix/2026-10-14-completed-tasks-reappear")[0],
        "assessment(completed-tasks-reappear): approve"
    );
}

#[test]
fn an_auto_approved_plan_is_not_waiting() {
    let repo = waiting();
    repo.write(SPEC, &spec("approved", 1, 1));
    repo.write(
        "specs/2026-10-10-cli-core/plan.md",
        &plan("auto-approved", 1, &[("One", 0, 1)]),
    );
    repo.commit("plan");

    let output = ura(
        &repo,
        &["review", "specs/2026-10-10-cli-core/plan.md", "--approve"],
    );

    assert_eq!(output.stderr, "ura: plan.md is not waiting for a review\n");
    assert_eq!(output.code, 1);
}

#[test]
fn request_changes_without_a_summary_counts_the_comments() {
    let repo = waiting();
    ura(
        &repo,
        &["review", "cli-core", "--comment", "50", "Name the field"],
    );

    ura(&repo, &["review", "cli-core", "--request-changes"]);

    assert!(
        repo.read(SPEC)
            .contains("> Changes requested on 2026-10-11: 1 comment in spec-review.md.\n")
    );
    assert!(
        repo.read(REVIEW)
            .contains("## C1: Line 50, under \"US2: Edit a repeat (P1)\"\n\n> Story line 50.\n")
    );
}

#[test]
fn a_comment_outside_the_file() {
    let repo = waiting();

    let output = ura(
        &repo,
        &["review", "cli-core", "--comment", "900-901", "Here"],
    );

    assert_eq!(output.stderr, "ura: spec.md has 60 lines\n");
    assert_eq!(output.code, 1);
}

#[test]
fn a_pending_review_of_an_older_version_is_replaced() {
    let repo = waiting();
    repo.write(
        REVIEW,
        "---\nverdict: pending\ncommit: 0000000\n---\n\n# Review: Spec, Feature\n\n## C1: General\n\nOld.\n",
    );

    let output = ura(
        &repo,
        &["review", "cli-core", "--comment", "general", "New"],
    );

    assert!(
        output
            .stdout
            .starts_with("replaced a pending review of an older version\n"),
        "{}",
        output.stdout
    );
    assert!(!repo.read(REVIEW).contains("Old."));
    assert!(repo.read(REVIEW).contains("## C1: General\n\nNew\n"));
}

#[test]
fn comments_add_up() {
    let repo = waiting();

    ura(&repo, &["review", "cli-core", "--comment", "41", "One"]);
    ura(
        &repo,
        &["review", "cli-core", "--comment", "general", "Two"],
    );

    let review = repo.read(REVIEW);
    assert!(review.contains("## C1: Line 41"));
    assert!(review.contains("## C2: General\n\nTwo\n"));
}
