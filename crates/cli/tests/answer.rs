mod common;

use common::*;

const FILE: &str = "specs/2026-10-10-cli-core/clarifications-01.md";

/// A repository on `main` whose branch `2026-10-10-cli-core` has a round of questions waiting,
/// with the given answers.
fn waiting(answers: &[&str]) -> TestRepo {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n- [CLI](/specs/2026-10-10-cli-core/proposal.md)\n\n## Next\n\n## Later\n\n## Blocked\n",
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
fn writes_one_answer_without_committing() {
    let repo = waiting(&["", "", ""]);
    repo.switch("2026-10-10-cli-core");

    let output = ura(
        &repo,
        &[
            "answer",
            "2026-10-10-cli-core",
            "Q3",
            "B, we'll do it later",
        ],
    );

    assert!(
        repo.read(FILE)
            .contains("**Answer:** B, we'll do it later\n")
    );
    assert_eq!(
        output.stdout,
        format!("Q3 answered in {FILE}. 1 of 3 questions answered.\n")
    );
    assert_eq!(repo.subjects("2026-10-10-cli-core").len(), 3);
    assert_eq!(output.code, 0, "{}", output.stderr);
}

#[test]
fn submit_records_the_block_and_commits() {
    let repo = waiting(&["A", "B", "A"]);
    repo.switch("2026-10-10-cli-core");

    let output = ura(&repo, &["answer", "2026-10-10-cli-core", "--submit"]);

    let text = repo.read(FILE);
    assert!(text.starts_with("---\nstatus: answered\n---\n"));
    assert!(text.contains("> [!NOTE]\n>\n> Answered on 2026-10-11.\n>\n> - A point.\n"));
    assert_eq!(
        repo.subjects("HEAD")[0],
        "discovery(cli-core): answer round 01"
    );
    assert_eq!(repo.changed_in("HEAD"), [FILE]);
    assert_eq!(repo.hook_runs(), 1);
    assert_eq!(
        output.stdout,
        "Round 01 answered, committed as \"discovery(cli-core): answer round 01\".\n"
    );
}

#[test]
fn submit_refuses_blank_answers() {
    let repo = waiting(&["A", "", ""]);
    repo.switch("2026-10-10-cli-core");
    let before = repo.read(FILE);

    let output = ura(&repo, &["answer", "cli-core", "--submit"]);

    assert_eq!(output.stderr, "ura: Q2 and Q3 have no answer\n");
    assert_eq!(output.code, 1);
    assert_eq!(repo.read(FILE), before);
}

#[test]
fn writes_in_a_new_worktree_from_main() {
    let repo = waiting(&["A", "B", "A"]);

    let output = ura(&repo, &["answer", "cli-core", "--submit"]);

    assert_eq!(repo.current_branch(), "main");
    assert_eq!(
        repo.subjects("2026-10-10-cli-core")[0],
        "discovery(cli-core): answer round 01"
    );
    assert!(
        output
            .stdout
            .starts_with("wrote in .worktrees/2026-10-10-cli-core\n"),
        "{}",
        output.stdout
    );
    assert_eq!(repo.hook_runs(), 1);
}

#[test]
fn writes_in_a_worktree_over_uncommitted_changes() {
    let repo = waiting(&["", "", ""]);
    repo.write("README.md", "# Changed\n");

    let output = ura(&repo, &["answer", "cli-core", "Q1", "A"]);

    let written = std::fs::read_to_string(
        repo.path()
            .join(".worktrees/2026-10-10-cli-core")
            .join(FILE),
    )
    .unwrap();
    assert!(written.contains("**Answer:** A\n"), "{}", output.stderr);
    assert_eq!(repo.read("README.md"), "# Changed\n");
    assert_eq!(repo.current_branch(), "main");
    assert_eq!(output.code, 0);
}

#[test]
fn writes_in_the_worktree_that_has_the_branch() {
    let repo = waiting(&["", "", ""]);
    let worktree = repo.parent().join("uraeda-cli");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        worktree.to_str().unwrap(),
        "2026-10-10-cli-core",
    ]);

    let output = ura(&repo, &["answer", "cli-core", "Q1", "A"]);

    let written = std::fs::read_to_string(worktree.join(FILE)).unwrap();
    assert!(written.contains("**Answer:** A\n"), "{}", output.stderr);
    assert_eq!(repo.current_branch(), "main");
    assert!(!repo.exists(FILE));
}

#[test]
fn writes_notes() {
    let repo = waiting(&["", "", ""]);
    repo.switch("2026-10-10-cli-core");

    ura(&repo, &["answer", "cli-core", "notes", "Keep .gitkeep out"]);

    assert!(repo.read(FILE).ends_with("**Notes:** Keep .gitkeep out\n"));
}

#[test]
fn a_question_is_never_a_target() {
    let repo = waiting(&["", "", ""]);
    repo.switch("2026-10-10-cli-core");

    let output = ura(&repo, &["answer", "Q2", "A"]);

    assert!(repo.read(FILE).contains("## Q2: Question 2?\n\nWhy.\n\n- **A (recommended). One.**\n  - [pro] p\n- **B. Two.**\n  - [con] c\n\n**Answer:** A\n"), "{}", output.stderr);
}

#[test]
fn refuses_markdown_structure_in_an_answer() {
    let repo = waiting(&["", "", ""]);
    repo.switch("2026-10-10-cli-core");

    let output = ura(&repo, &["answer", "Q1", "# A heading"]);

    assert_eq!(
        output.stderr,
        "ura: an answer line cannot start with \"#\" or \"**Answer:**\"\n"
    );
    assert_eq!(output.code, 1);
}

#[test]
fn hook_reformatting_leaves_a_clean_tree() {
    let repo = waiting(&["A", "B", "A"]);
    repo.switch("2026-10-10-cli-core");
    repo.set_hook(
        "for f in $(git diff --cached --name-only); do echo >> \"$f\"; git add \"$f\"; done",
    );

    let output = ura(&repo, &["answer", "--submit"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn a_failing_hook_keeps_the_files() {
    let repo = waiting(&["A", "B", "A"]);
    repo.switch("2026-10-10-cli-core");
    repo.set_hook("echo boom >&2; exit 1");

    let output = ura(&repo, &["answer", "--submit"]);

    assert_eq!(
        output.stderr,
        "ura: git commit failed: boom\nura: commit failed: fix the hook's error, then commit\n"
    );
    assert!(repo.read(FILE).contains("status: answered"));
    assert_eq!(output.code, 1);
}

#[test]
fn no_commit_leaves_the_files() {
    let repo = waiting(&["A", "B", "A"]);
    repo.switch("2026-10-10-cli-core");

    let output = ura(&repo, &["answer", "--submit", "--no-commit"]);

    assert_eq!(
        output.stdout,
        format!("Round 01 answered in {FILE}: commit it.\n")
    );
    assert_eq!(repo.subjects("HEAD").len(), 3);
}
