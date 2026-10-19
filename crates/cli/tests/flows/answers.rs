//! `ura answer`: answers are written without a commit, a round is submitted with one, always on the
//! feature's branch and through the user's hook, never over staged files or a bad answer.

use crate::common::*;

const FOLDER: &str = "2026-10-10-cli-core";
const FILE: &str = "specs/2026-10-10-cli-core/clarifications-01.md";

/// A repository on `main` whose feature branch has a round of 3 questions with these answers.
fn waiting(answers: &[&str]) -> TestRepo {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    );
    feature(
        &repo,
        FOLDER,
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

fn waits_on(repo: &TestRepo) -> String {
    let json: serde_json::Value =
        serde_json::from_str(&ura(repo, &["next", "cli-core", "--json"]).stdout).unwrap();
    json["step"]["waits-on"].as_str().unwrap().to_string()
}

#[test]
fn answers_are_written_then_the_round_is_submitted_on_the_features_branch_from_main() {
    let repo = waiting(&["", "", ""]);
    let worktree = format!(".worktrees/{FOLDER}/{FILE}");

    for (question, answer) in [("Q1", "A"), ("Q2", "B, but later"), ("Q3", "A")] {
        let written = ura(&repo, &["answer", "cli-core", question, answer]);
        assert_eq!(written.code, 0, "{}", written.stderr);
    }
    ura(&repo, &["answer", "cli-core", "notes", "Nothing else"]);

    assert!(repo.read(&worktree).contains("**Answer:** B, but later\n"));
    assert_eq!(
        waits_on(&repo),
        "human",
        "written answers are not committed"
    );
    let commits = repo.subjects(FOLDER).len();

    let submitted = ura(&repo, &["answer", "cli-core", "--submit"]);

    assert_eq!(submitted.code, 0, "{}", submitted.stderr);
    assert_eq!(repo.subjects(FOLDER).len(), commits + 1);
    assert_eq!(repo.changed_in(FOLDER), [FILE]);
    assert_eq!(waits_on(&repo), "agent");
    assert_eq!(repo.current_branch(), "main");
    assert_eq!(repo.hook_runs(), 1, "the user's hook ran on the commit");
}

#[test]
fn a_bad_answer_or_an_incomplete_round_changes_nothing() {
    let repo = waiting(&["A", "", ""]);
    repo.switch(FOLDER);
    let before = repo.read(FILE);
    let commits = repo.subjects(FOLDER).len();

    let rejected = [
        ura(&repo, &["answer", "--submit"]),
        ura(&repo, &["answer", "Q2", "# A heading"]),
        ura(&repo, &["answer", "Q2", "B,", "we", "will"]),
        ura(&repo, &["answer", "Q3", "B", "--submit"]),
        ura(&repo, &["answer", "Q9", "A"]),
    ];

    assert!(rejected.iter().all(|output| output.code == 1));
    assert_eq!(repo.read(FILE), before);
    assert_eq!(repo.subjects(FOLDER).len(), commits);
}

#[test]
fn a_submitted_round_takes_no_more_answers() {
    let repo = waiting(&["A", "B", "A"]);
    repo.switch(FOLDER);
    assert_eq!(ura(&repo, &["answer", "--submit"]).code, 0);
    let before = repo.read(FILE);

    let output = ura(&repo, &["answer", "Q1", "B"]);

    assert_eq!(output.code, 1);
    assert_eq!(repo.read(FILE), before);
}

#[test]
fn staged_files_refuse_a_submit_before_anything_is_written() {
    let repo = waiting(&["A", "B", "A"]);
    repo.switch(FOLDER);
    repo.write("other.md", "x\n");
    repo.git(&["add", "other.md"]);

    let output = ura(&repo, &["answer", "--submit"]);

    assert_eq!(output.code, 1);
    assert!(repo.read(FILE).contains("status: awaiting-human"));
    assert_eq!(
        repo.git(&["diff", "--cached", "--name-only"]),
        "other.md\n",
        "the staged file is untouched"
    );
}

#[test]
fn a_hook_that_refuses_keeps_the_files_and_one_that_reformats_leaves_a_clean_tree() {
    let repo = waiting(&["A", "B", "A"]);
    repo.switch(FOLDER);
    repo.set_hook("echo boom >&2; exit 1");

    let refused = ura(&repo, &["answer", "--submit"]);

    assert_eq!(refused.code, 1);
    assert!(
        repo.read(FILE).contains("status: answered"),
        "the submitted file is kept for the human"
    );
    assert_eq!(repo.subjects(FOLDER).len(), 3, "nothing was committed");

    let repo = waiting(&["A", "B", "A"]);
    repo.switch(FOLDER);
    repo.set_hook(
        "for f in $(git diff --cached --name-only); do echo >> \"$f\"; git add \"$f\"; done",
    );
    assert_eq!(ura(&repo, &["answer", "--submit"]).code, 0);
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn no_commit_leaves_the_submitted_files_for_the_human() {
    let repo = waiting(&["A", "B", ""]);
    repo.switch(FOLDER);
    ura(
        &repo,
        &["answer", "Q3", "A, as ![one](images/one.webp) shows"],
    );
    repo.write("specs/2026-10-10-cli-core/images/one.webp", "one");

    let output = ura(&repo, &["answer", "--submit", "--no-commit"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(repo.read(FILE).contains("status: answered"));
    assert_eq!(repo.subjects(FOLDER).len(), 3, "no commit was made");
    assert!(
        output.stdout.contains("images"),
        "it names the images to commit with the round"
    );
}

#[test]
fn notes_keep_the_comments_on_settled_points() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    );
    let round = std::fs::read_to_string(fixture("settled-comments/clarifications-01.md")).unwrap();
    feature(
        &repo,
        FOLDER,
        &[("proposal.md", proposal()), ("clarifications-01.md", round)],
    );
    repo.switch(FOLDER);

    let output = ura(&repo, &["answer", "cli-core", "notes", "New"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    let text = repo.read(FILE);
    assert!(
        text.contains("**Notes:** New")
            && text.contains("Keep the undo.")
            && text.contains("Ask first."),
        "{text}"
    );
}

#[test]
fn the_target_is_the_current_branch_or_a_name_and_never_a_question() {
    let repo = waiting(&["", "", ""]);
    repo.switch(FOLDER);

    assert_eq!(
        ura(&repo, &["answer", "Q2", "A"]).code,
        0,
        "no target: the current branch"
    );
    assert!(repo.read(FILE).contains("**Answer:** A\n"));

    let from_main = waiting(&["", "", ""]);
    assert_eq!(
        ura(&from_main, &["answer", "cli-core", "Q1", "B"]).code,
        0,
        "a slug, from main"
    );
    assert_eq!(from_main.current_branch(), "main");
}
