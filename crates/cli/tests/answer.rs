mod common;

use common::*;

const FILE: &str = "specs/2026-10-10-cli-core/clarifications-01.md";

/// A repository on `main` whose branch `2026-10-10-cli-core` has a round of questions waiting,
/// with the given answers.
fn waiting(answers: &[&str]) -> TestRepo {
    let repo = TestRepo::new();
    specs(&repo);
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
fn submit_records_the_block_and_commits_nothing() {
    let repo = waiting(&["A", "B", "A"]);
    repo.switch("2026-10-10-cli-core");

    let output = ura(&repo, &["answer", "2026-10-10-cli-core", "--submit"]);

    let text = repo.read(FILE);
    assert!(text.starts_with("---\nstatus: answered\n---\n"));
    assert!(text.contains("> [!NOTE]\n>\n> Answered on 2026-10-11.\n>\n> - A point.\n"));
    assert_eq!(repo.subjects("HEAD").len(), 3);
    assert_eq!(repo.hook_runs(), 0);
    assert_eq!(
        output.stdout,
        format!("Round 01 answered in {FILE}: the next step commits it.\n")
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
fn writes_in_the_worktree_from_main_and_commits_nothing() {
    let repo = waiting(&["A", "B", "A"]);

    let output = ura(&repo, &["answer", "cli-core", "--submit"]);

    assert_eq!(repo.current_branch(), "main");
    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(
        repo.subjects("2026-10-10-cli-core")[0],
        "work on 2026-10-10-cli-core"
    );
    assert!(
        output
            .stdout
            .starts_with("wrote in .worktrees/2026-10-10-cli-core\n"),
        "{}",
        output.stdout
    );
    let written = std::fs::read_to_string(
        repo.path()
            .join(".worktrees/2026-10-10-cli-core")
            .join(FILE),
    )
    .unwrap();
    assert!(written.contains("status: answered"));
    assert_eq!(repo.hook_runs(), 0);
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
    let worktree = repo.worktree("2026-10-10-cli-core");

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
fn submit_names_the_images_the_next_step_commits() {
    let repo = waiting(&["A", "B", ""]);
    repo.switch("2026-10-10-cli-core");
    ura(
        &repo,
        &["answer", "Q3", "A, as ![one](images/one.webp) shows"],
    );
    repo.write("specs/2026-10-10-cli-core/images/one.webp", "one");

    let output = ura(&repo, &["answer", "--submit"]);

    assert_eq!(
        output.stdout,
        format!(
            "Round 01 answered in {FILE}, with specs/2026-10-10-cli-core/images: the next step commits them.\n"
        )
    );
    assert_eq!(repo.subjects("HEAD").len(), 3);
}

#[test]
fn writing_notes_keeps_the_comments_on_settled_points() {
    let repo = TestRepo::new();
    specs(&repo);
    let round = std::fs::read_to_string(fixture("settled-comments/clarifications-01.md")).unwrap();
    feature(
        &repo,
        "2026-10-10-cli-core",
        &[("proposal.md", proposal()), ("clarifications-01.md", round)],
    );
    repo.switch("2026-10-10-cli-core");

    let output = ura(&repo, &["answer", "cli-core", "notes", "New"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(repo.read(FILE).ends_with(
        "**Notes:** New\n\n- **Undoing a completion**: Keep the undo.\n  Also for deletes.\n- **Deleting a repeating task**: Ask first.\n"
    ), "{}", repo.read(FILE));
}
