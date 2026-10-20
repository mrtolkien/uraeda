//! Regressions found by the final review, and by the pull request's review.
mod common;

use common::*;

const FILE: &str = "specs/2026-10-10-cli-core/clarifications-01.md";

fn waiting(answers: &[&str]) -> TestRepo {
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
                clarifications("awaiting-human", "3 questions, about 9 minutes.", answers),
            ),
        ],
    );
    repo
}

#[test]
fn check_accepts_priorities_links_to_features_on_their_branches() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n- [Tags](/specs/2026-10-11-tags/proposal.md)\n\n## Next\n\n## Later\n\n## Blocked\n",
    );

    let output = ura(&repo, &["check"]);

    assert_eq!(output.stdout, "specs/: no problems\n");
}

#[test]
fn a_refused_answer_leaves_the_checkout() {
    let repo = waiting(&["A", "", "A"]);

    let output = ura(&repo, &["answer", "cli-core", "--submit"]);

    assert_eq!(output.code, 1);
    assert_eq!(repo.current_branch(), "main");
    assert_eq!(output.stdout, "");
}

#[test]
fn staged_files_refuse_before_anything_is_written() {
    let repo = waiting(&["A", "B", "A"]);
    repo.switch("2026-10-10-cli-core");
    repo.write("other.md", "x\n");
    repo.git(&["add", "other.md"]);

    let output = ura(&repo, &["answer", "--submit"]);

    assert_eq!(
        output.stderr,
        "ura: other files are staged: other.md: commit or unstage them first\n"
    );
    assert!(repo.read(FILE).contains("status: awaiting-human"));
}

#[test]
fn a_staged_draft_does_not_start_twice() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n- [Tags](drafts/tags.md)\n\n## Later\n\n## Blocked\n",
    );
    repo.write(
        "specs/drafts/tags.md",
        "# Tags\n\n## What\n\nTags.\n\n## Why\n\nFilters.\n",
    );
    repo.git(&["add", "specs/drafts/tags.md"]);

    let refused = ura(&repo, &["start", "tags"]);
    repo.git(&["reset", "--quiet"]);
    let output = ura(&repo, &["start", "tags"]);

    assert_eq!(refused.code, 1, "{}", refused.stdout);
    assert_eq!(output.code, 0, "{}", output.stderr);
    let priorities = repo.git(&["show", "main:specs/PRIORITIES.md"]);
    assert_eq!(
        priorities.matches("2026-10-11-tags/proposal.md").count(),
        1,
        "{priorities}"
    );
}

fn spec_waiting() -> TestRepo {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    );
    let mut text = spec("awaiting-human", 1, 1);
    text.push_str("\n## User stories\n\n### US1: One (P1)\n\nLine A.\nLine B.\n");
    feature(
        &repo,
        "2026-10-10-cli-core",
        &[
            ("proposal.md", proposal()),
            (
                "clarifications-01.md",
                clarifications("answered", "Answered on 2026-10-08.", &["A"]),
            ),
            ("spec.md", text),
        ],
    );
    repo.switch("2026-10-10-cli-core");
    repo
}

const REVIEW: &str = "specs/2026-10-10-cli-core/spec-review.md";

#[test]
fn a_pending_review_survives_an_unrelated_commit() {
    let repo = spec_waiting();
    ura(&repo, &["review", "--comment", "general", "first"]);
    repo.write("README.md", "# Other\n");
    repo.git(&["add", "README.md"]);
    repo.git(&["commit", "--quiet", "--no-verify", "--message", "other"]);

    let output = ura(&repo, &["review", "--comment", "general", "second"]);

    assert!(!output.stdout.contains("replaced"), "{}", output.stdout);
    let review = repo.read(REVIEW);
    assert!(
        review.contains("## C1: General\n\nfirst\n")
            && review.contains("## C2: General\n\nsecond\n"),
        "{review}"
    );
}

#[test]
fn a_comment_cannot_hold_a_heading() {
    let repo = spec_waiting();

    let output = ura(
        &repo,
        &["review", "--comment", "general", "See\n## C2: the rest"],
    );

    assert_eq!(
        output.stderr,
        "ura: a comment line cannot start with \"#\"\n"
    );
    assert!(!repo.exists(REVIEW));
}

#[test]
fn a_review_file_that_does_not_parse_is_kept() {
    let repo = spec_waiting();
    let broken = "---\nverdict: pending\ncommit: abc1234\n---\n\n# Review: Spec, Feature\n\n## C1: Lines 40-41 under \"US1\"\n\nMine.\n";
    repo.write(REVIEW, broken);

    let output = ura(&repo, &["review", "--approve"]);

    assert_eq!(output.code, 1);
    assert!(
        output
            .stderr
            .starts_with("ura: spec-review.md does not parse: "),
        "{}",
        output.stderr
    );
    assert_eq!(repo.read(REVIEW), broken);
    assert!(
        repo.read("specs/2026-10-10-cli-core/spec.md")
            .contains("status: awaiting-human")
    );
}

#[test]
fn an_unquoted_answer_is_refused() {
    let repo = waiting(&["", "", ""]);
    repo.switch("2026-10-10-cli-core");

    let output = ura(&repo, &["answer", "Q3", "B,", "we", "will"]);

    assert_eq!(output.stderr, "ura: the answer is one argument: quote it\n");
    assert!(!repo.read(FILE).contains("**Answer:** B,"));
}

#[test]
fn submit_takes_no_answer() {
    let repo = waiting(&["A", "B", "A"]);
    repo.switch("2026-10-10-cli-core");

    let output = ura(&repo, &["answer", "Q3", "B", "--submit"]);

    assert_eq!(
        output.stderr,
        "ura: --submit takes no answer: answer first, then submit\n"
    );
    assert!(repo.read(FILE).contains("status: awaiting-human"));
}

#[test]
fn start_moves_a_folder_with_an_ignored_file() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    );
    repo.write(".gitignore", ".DS_Store\n");
    repo.write(
        "specs/backlog/bench/proposal.md",
        "# Bench\n\n## What\n\nA.\n\n## Why\n\nB.\n",
    );
    repo.commit("bench");
    repo.write("specs/backlog/bench/.DS_Store", "x");

    let output = ura(&repo, &["start", "specs/backlog/bench"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(repo.exists(".worktrees/2026-10-11-bench/specs/2026-10-11-bench/proposal.md"));
    assert!(!repo.exists(".worktrees/2026-10-11-bench/specs/backlog/bench/proposal.md"));
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn usage_errors_exit_with_one() {
    let repo = waiting(&["", "", ""]);

    let output = ura(&repo, &["review", "--comment", "5"]);

    assert_eq!(output.code, 1);
    assert!(output.stderr.starts_with("ura: "), "{}", output.stderr);
}

#[test]
fn check_without_specs_says_to_init() {
    let repo = TestRepo::new();

    let output = ura(&repo, &["check"]);

    assert_eq!(
        output.stderr,
        format!(
            "ura: no specs/ folder at {}: run ura init\n",
            repo.path().display()
        )
    );
}

#[test]
fn a_drafted_unicode_line_starts() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n- [Café sync](drafts/café-sync.md)\n\n## Later\n\n## Blocked\n",
    );
    repo.write(
        "specs/drafts/café-sync.md",
        "# Café sync\n\n## What\n\nA.\n\n## Why\n\nB.\n",
    );
    repo.commit("café");

    let output = ura(&repo, &["start", "café-sync"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
}

#[test]
fn a_failed_start_commit_leaves_the_checkout_on_its_branch() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n- [Tags](drafts/tags.md)\n\n## Later\n\n## Blocked\n",
    );
    repo.write(
        "specs/drafts/tags.md",
        "# Tags\n\n## What\n\nTags.\n\n## Why\n\nFilters.\n",
    );
    repo.commit("tags");
    repo.switch_new("other");
    repo.set_hook("echo boom >&2; exit 1");

    let output = ura(&repo, &["start", "tags"]);

    assert_eq!(output.code, 1);
    assert_eq!(repo.current_branch(), "other");
    assert!(
        repo.read(".worktrees/main/specs/PRIORITIES.md")
            .contains("- [Tags](/specs/2026-10-11-tags/proposal.md)")
    );
    assert!(repo.exists(".worktrees/main/specs/2026-10-11-tags/proposal.md"));
    assert!(
        output.stderr.ends_with(
            "ura: git commit failed: boom\nDone: the move of the draft.\nLeft: commit specs/PRIORITIES.md, the removal of specs/drafts/tags.md, and specs/2026-10-11-tags/ on main as \"chore(tags): start Tags\", then create the branch 2026-10-11-tags in .worktrees/2026-10-11-tags.\n"
        ),
        "{}",
        output.stderr
    );
}

#[test]
fn approving_refuses_a_review_of_an_older_version() {
    let repo = spec_waiting();
    ura(&repo, &["review", "--comment", "general", "first"]);
    let spec = "specs/2026-10-10-cli-core/spec.md";
    repo.write(spec, &format!("{}Line C.\n", repo.read(spec)));
    repo.git(&["add", spec]);
    repo.git(&["commit", "--quiet", "--no-verify", "--message", "edit"]);

    let output = ura(&repo, &["review", "--approve"]);

    assert_eq!(
        output.stderr,
        "ura: spec-review.md comments on an older spec.md: comment again to replace it, or delete it\n"
    );
    assert!(repo.read(spec).contains("status: awaiting-human"));
    assert!(repo.read(REVIEW).contains("first"));
}

#[test]
fn a_deleted_file_is_an_uncommitted_change() {
    let repo = waiting(&["", "", ""]);
    repo.switch("2026-10-10-cli-core");
    repo.remove(FILE);

    let output = ura(&repo, &["status"]);

    assert!(
        output.row("2026-10-10-cli-core")[2].ends_with("(uncommitted changes)"),
        "{}",
        output.stdout
    );
}

#[test]
fn a_submitted_round_takes_no_answer() {
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
        ],
    );
    repo.switch("2026-10-10-cli-core");

    let output = ura(&repo, &["answer", "Q1", "B"]);

    assert_eq!(
        output.stderr,
        "ura: clarifications-01.md is not waiting for answers\n"
    );
    assert!(repo.read(FILE).contains("**Answer:** A\n"));
}
