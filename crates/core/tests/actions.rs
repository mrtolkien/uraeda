mod common;

use common::repo::{TestRepo, run_git};
use common::texts::{self, proposal, spec};
use uraeda_core::actions::place::{self, Place};
use uraeda_core::actions::review::{self, DecisionTarget, Tier};
use uraeda_core::actions::{ActionError, answer};
use uraeda_core::files::clarifications::AnswerError;
use uraeda_core::git::Git;
use uraeda_core::today::Date;
use uraeda_core::workspace::{Feature, Workspace};

const FOLDER: &str = "2026-10-11-web-ui";
const ROUND: &str = "specs/2026-10-11-web-ui/clarifications-01.md";

fn today() -> Date {
    Date::parse("2026-10-11").unwrap()
}

/// A round with Q1 (A, B, C), its follow-up Q1.B, and Q2 (A, B), with the given answers.
fn round(q1: &str, q1b: &str, q2: &str) -> String {
    let answer = |a: &str| {
        if a.is_empty() {
            "**Answer:**".to_string()
        } else {
            format!("**Answer:** {a}")
        }
    };
    format!(
        "---\nstatus: awaiting-human\n---\n\n# Clarifications, round 01: Web UI\n\n> [!IMPORTANT]\n>\n> 2 questions and 1 follow-up, about 9 minutes.\n>\n> - A point.\n\n## Context\n\n### Goal\n\nA goal.\n\n### Today\n\nToday.\n\n### Scope\n\nA scope.\n\n### Sources\n\n- The code.\n\n## Q1: Which one?\n\nContext.\n\nWhy it matters: it is the main choice.\n\n- **A (recommended). One.**\n  - [pro] p\n  - [con] c\n  - Why recommended: it is small.\n- **B. Two.**\n  - [pro] p\n  - [con] c\n- **C. Three.**\n  - [pro] p\n  - [con] c\n\n{}\n\n### Q1.B: Then what?\n\nOnly if you picked B in Q1.\n\nWhy it matters: it follows the choice.\n\n- **A (recommended). Yes.**\n  - [pro] p\n  - [con] c\n  - Why recommended: it is small.\n- **B. No.**\n  - [pro] p\n  - [con] c\n\n{}\n\n## Q2: And this?\n\nContext.\n\nWhy it matters: it is the other choice.\n\n- **A (recommended). One.**\n  - [pro] p\n  - [con] c\n  - Why recommended: it is small.\n- **B. Two.**\n  - [pro] p\n  - [con] c\n\n{}\n\n## Settled without the human\n\n- **A point** settled.\n\n**Notes:**\n",
        answer(q1),
        answer(q1b),
        answer(q2)
    )
}

/// A repository on `main` whose feature branch holds a round, checked out in a worktree.
fn repo_with(round_text: &str) -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.write(ROUND, round_text);
    repo.commit("discovery(web-ui): web UI");
    repo.switch("main");
    repo.worktree(FOLDER);
    repo
}

/// The feature, and the place its branch is reached at.
fn reach(repo: &TestRepo) -> (Feature, Place) {
    let git = Git::discover(repo.path()).unwrap();
    let workspace = Workspace::read(&git).unwrap();
    let feature = workspace.feature(FOLDER).unwrap().clone();
    let place = place::reach(&git, FOLDER).unwrap();
    (feature, place)
}

fn read(place: &Place, path: &str) -> String {
    std::fs::read_to_string(place.root.join(path)).unwrap()
}

fn letters(items: &[&str]) -> Vec<String> {
    items.iter().map(|s| s.to_string()).collect()
}

/// The `**Answer:**` lines of the round, in order.
fn answers(place: &Place) -> Vec<String> {
    read(place, ROUND)
        .lines()
        .filter(|line| line.starts_with("**Answer:**"))
        .map(String::from)
        .collect()
}

#[test]
fn saves_answers_as_the_ui_composes_them() {
    let repo = repo_with(&round("", "", ""));
    let (feature, place) = reach(&repo);

    // US2.1
    answer::save(&place, &feature, "Q2", &letters(&["A"]), "", "").unwrap();
    assert_eq!(answers(&place)[2], "**Answer:** A");
    // US2.2
    answer::save(&place, &feature, "Q1", &letters(&["B", "C"]), "", "").unwrap();
    assert_eq!(answers(&place)[0], "**Answer:** B and C");
    answer::save(
        &place,
        &feature,
        "Q1",
        &letters(&["A", "B", "C"]),
        "",
        "B and C",
    )
    .unwrap();
    assert_eq!(answers(&place)[0], "**Answer:** A, B and C");
    // US2.3
    answer::save(
        &place,
        &feature,
        "Q2",
        &letters(&["A"]),
        "but only for the dev server",
        "A",
    )
    .unwrap();
    assert_eq!(
        answers(&place)[2],
        "**Answer:** A: but only for the dev server"
    );
    // US2.4
    answer::save(
        &place,
        &feature,
        "Q1",
        &[],
        "Neither, keep it simple",
        "A, B and C",
    )
    .unwrap();
    assert_eq!(answers(&place)[0], "**Answer:** Neither, keep it simple");
    // US2.10
    answer::save_notes(&place, &feature, "LGTM", "").unwrap();
    assert!(read(&place, ROUND).ends_with("**Notes:** LGTM\n"));
    // SC-002
    assert_eq!(repo.current_branch(), "main");
    assert_eq!(repo.subjects(FOLDER).len(), 3);
}

#[test]
fn refuses_an_answer_changed_elsewhere() {
    let repo = repo_with(&round("A", "", ""));
    let (feature, place) = reach(&repo);

    let error = answer::save(&place, &feature, "Q1", &letters(&["B"]), "", "").unwrap_err();

    assert_eq!(
        error.to_string(),
        "clarifications-01.md changed on disk since you opened it. Your text was not saved."
    );
    assert!(matches!(error, ActionError::Changed { .. }));
    assert_eq!(answers(&place)[0], "**Answer:** A");
}

#[test]
fn refuses_a_heading_in_an_answer() {
    let repo = repo_with(&round("", "", ""));
    let (feature, place) = reach(&repo);
    let before = read(&place, ROUND);

    let error = answer::save(&place, &feature, "Q1", &[], "# heading", "").unwrap_err();

    assert!(matches!(error, ActionError::Answer(_)), "{error}");
    assert_eq!(read(&place, ROUND), before);
}

/// US2.9: submitting writes the record in the worktree and commits nothing.
#[test]
fn submits_in_the_worktree_and_commits_nothing() {
    let repo = repo_with(&round("B", "A", "A"));
    let (feature, place) = reach(&repo);
    let head = repo.git(&["rev-parse", FOLDER]);

    let change = answer::submit(&place, &feature, today(), false).unwrap();

    assert_eq!(change.subject, "discovery(web-ui): answer round 01");
    assert_eq!(repo.git(&["rev-parse", FOLDER]), head);
    let text = read(&place, ROUND);
    assert!(text.starts_with("---\nstatus: answered\n---\n"));
    assert!(text.contains("> Answered on 2026-10-11.\n"));
    assert_eq!(repo.hook_runs(), 0);
    assert_eq!(repo.current_branch(), "main");
}

/// US1.7: Submit keeps the block's verdict item under the new first line.
#[test]
fn submitting_keeps_the_verdict() {
    let verdict = "> - Verdict: worth building as proposed, since it is small.\n";
    let repo = repo_with(&round("B", "A", "A").replacen(
        "> - A point.\n",
        &format!("{verdict}> - A point.\n"),
        1,
    ));
    let (feature, place) = reach(&repo);

    answer::submit(&place, &feature, Date::parse("2026-10-18").unwrap(), false).unwrap();

    let text = read(&place, ROUND);
    assert!(
        text.contains(&format!(
            "> [!NOTE]\n>\n> Answered on 2026-10-18.\n>\n{verdict}> - A point.\n"
        )),
        "{text}"
    );
}

/// A round whose settled points are "Undoing a completion" and "Deleting a repeating task", with
/// `notes` after its `**Notes:**` marker.
fn settled_round(notes: &str) -> String {
    round("", "", "")
        .replace(
            "- **A point** settled.",
            "- **Undoing a completion** puts back what completing changed.\n- **Deleting a repeating task** ends the repetition.",
        )
        .replace("**Notes:**\n", &format!("**Notes:** {notes}\n"))
}

/// The round's text after its `**Notes:**` marker.
fn notes_text(place: &Place) -> String {
    let text = read(place, ROUND);
    text.split_once("**Notes:**").unwrap().1.to_string()
}

const UNDO: &str = "Undoing a completion";
const DELETE: &str = "Deleting a repeating task";

/// US4.1
#[test]
fn a_settled_comment_is_added_after_the_free_notes() {
    let repo = repo_with(&settled_round("Overall fine."));
    let (feature, place) = reach(&repo);

    answer::add_settled_comment(&place, &feature, UNDO, "Keep the undo.").unwrap();

    assert_eq!(
        notes_text(&place),
        " Overall fine.\n\n- **Undoing a completion**: Keep the undo.\n"
    );
}

/// US4.8
#[test]
fn a_settled_comment_of_two_lines_is_indented() {
    let repo = repo_with(&settled_round("Overall fine."));
    let (feature, place) = reach(&repo);

    answer::add_settled_comment(&place, &feature, UNDO, "Keep the undo.\nAlso for deletes.")
        .unwrap();

    assert!(
        notes_text(&place)
            .ends_with("\n\n- **Undoing a completion**: Keep the undo.\n  Also for deletes.\n"),
        "{}",
        notes_text(&place)
    );
}

/// US4.4
#[test]
fn a_settled_comment_is_edited_over_its_text_last_read() {
    let notes = "Overall fine.\n\n- **Undoing a completion**: Keep the undo.\n- **Deleting a repeating task**: Ask first.";
    let repo = repo_with(&settled_round(notes));
    let (feature, place) = reach(&repo);

    let error =
        answer::edit_settled_comment(&place, &feature, 1, UNDO, "Drop it.", "Other").unwrap_err();
    assert!(matches!(error, ActionError::Changed { .. }), "{error}");
    assert_eq!(notes_text(&place), format!(" {notes}\n"));

    answer::edit_settled_comment(
        &place,
        &feature,
        1,
        UNDO,
        "Keep it, say so.",
        "Keep the undo.",
    )
    .unwrap();
    assert_eq!(
        notes_text(&place),
        " Overall fine.\n\n- **Undoing a completion**: Keep it, say so.\n- **Deleting a repeating task**: Ask first.\n"
    );
}

/// US4.5
#[test]
fn a_settled_comment_is_removed_and_the_rest_kept() {
    let notes = "Overall fine.\n\n- **Undoing a completion**: Keep the undo.\n- **Deleting a repeating task**: Ask first.";
    let repo = repo_with(&settled_round(notes));
    let (feature, place) = reach(&repo);

    answer::remove_settled_comment(&place, &feature, 1, UNDO, "Keep the undo.").unwrap();

    assert_eq!(
        notes_text(&place),
        " Overall fine.\n\n- **Deleting a repeating task**: Ask first.\n"
    );
}

#[test]
fn a_settled_comment_on_an_unknown_point_is_refused() {
    let repo = repo_with(&settled_round("Overall fine."));
    let (feature, place) = reach(&repo);
    let before = read(&place, ROUND);

    let error = answer::add_settled_comment(&place, &feature, "Gone", "Text.").unwrap_err();

    assert_eq!(error.to_string(), "That point is no longer in the round.");
    assert_eq!(read(&place, ROUND), before);
}

#[test]
fn a_settled_comment_with_a_heading_is_refused() {
    let repo = repo_with(&settled_round("Overall fine."));
    let (feature, place) = reach(&repo);
    let before = read(&place, ROUND);

    let error =
        answer::add_settled_comment(&place, &feature, UNDO, "Fine.\n# Heading").unwrap_err();

    assert!(
        matches!(error, ActionError::Answer(AnswerError::Structure)),
        "{error}"
    );
    assert_eq!(read(&place, ROUND), before);
}

/// US4.3: the notes saved over the free notes last read keep the settled comments.
#[test]
fn settled_comments_stay_when_the_free_notes_are_saved() {
    let repo = repo_with(&settled_round(
        "Overall fine.\n\n- **Undoing a completion**: Keep the undo.",
    ));
    let (feature, place) = reach(&repo);

    answer::save_notes(
        &place,
        &feature,
        "Overall fine, icon bigger.",
        "Overall fine.",
    )
    .unwrap();

    assert_eq!(
        notes_text(&place),
        " Overall fine, icon bigger.\n\n- **Undoing a completion**: Keep the undo.\n"
    );
}

/// A comment removed elsewhere renumbers the ones after it: an edit or a removal of comment 1 on
/// one subject is refused when comment 1 is now on another, even with the same text.
#[test]
fn a_settled_comment_now_on_another_point_is_neither_edited_nor_removed() {
    let notes = "- **Undoing a completion**: Agreed.\n- **Deleting a repeating task**: Agreed.";
    let repo = repo_with(&settled_round(notes));
    let (feature, place) = reach(&repo);
    let before = read(&place, ROUND);

    let refusals = [
        answer::edit_settled_comment(&place, &feature, 1, DELETE, "Mine.", "Agreed."),
        answer::remove_settled_comment(&place, &feature, 1, DELETE, "Agreed."),
    ];

    for refusal in refusals {
        let error = refusal.unwrap_err();
        assert!(matches!(error, ActionError::Changed { .. }), "{error}");
    }
    assert_eq!(read(&place, ROUND), before);
}

/// The free notes saved over notes changed since they were read are refused, the file kept.
#[test]
fn free_notes_saved_over_notes_changed_elsewhere_are_refused() {
    let repo = repo_with(&settled_round(
        "Theirs.\n\n- **Undoing a completion**: Keep the undo.",
    ));
    let (feature, place) = reach(&repo);
    let before = read(&place, ROUND);

    let error = answer::save_notes(&place, &feature, "Mine.", "Overall fine.").unwrap_err();

    assert!(matches!(error, ActionError::Changed { .. }), "{error}");
    assert_eq!(read(&place, ROUND), before);
}

/// A comment removed over a text changed since it was read is refused, the file kept.
#[test]
fn a_settled_comment_changed_elsewhere_is_not_removed() {
    let notes = "- **Undoing a completion**: Theirs.\n- **Deleting a repeating task**: Ask first.";
    let repo = repo_with(&settled_round(notes));
    let (feature, place) = reach(&repo);
    let before = read(&place, ROUND);

    let error =
        answer::remove_settled_comment(&place, &feature, 1, UNDO, "Keep the undo.").unwrap_err();

    assert!(matches!(error, ActionError::Changed { .. }), "{error}");
    assert_eq!(read(&place, ROUND), before);
}

/// A submitted round is a record: its notes and settled comments are written no more, as its
/// answers are not.
#[test]
fn a_submitted_rounds_notes_and_settled_comments_are_refused() {
    let notes = "Overall fine.\n\n- **Undoing a completion**: Keep the undo.";
    let repo =
        repo_with(&settled_round(notes).replace("status: awaiting-human", "status: answered"));
    let (feature, place) = reach(&repo);
    let before = read(&place, ROUND);

    let refusals = [
        answer::save_notes(&place, &feature, "Mine.", "Overall fine."),
        answer::add_settled_comment(&place, &feature, UNDO, "Text."),
        answer::edit_settled_comment(&place, &feature, 1, UNDO, "Drop it.", "Keep the undo."),
        answer::remove_settled_comment(&place, &feature, 1, UNDO, "Keep the undo."),
    ];

    for refusal in refusals {
        assert_eq!(
            refusal.unwrap_err().to_string(),
            "clarifications-01.md is not waiting for answers"
        );
    }
    assert_eq!(read(&place, ROUND), before);
}

const SPEC: &str = "specs/2026-10-11-web-ui/spec.md";
const REVIEW: &str = "specs/2026-10-11-web-ui/spec-review.md";

/// A feature whose spec waits for a review, with risk tier `medium`.
fn spec_repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.write(
        SPEC,
        &spec("awaiting-human", 1, 1).replace("risk-tier: low", "risk-tier: medium"),
    );
    repo.commit("spec(web-ui): web UI");
    repo.switch("main");
    repo.worktree(FOLDER);
    repo
}

/// US3.3
#[test]
fn pending_comments_are_edited_and_removed() {
    let repo = spec_repo();
    let git = Git::discover(repo.path()).unwrap();
    let (feature, place) = reach(&repo);
    review::comment(
        &git,
        &place,
        &feature,
        "spec.md",
        Some((9, 9)),
        "Say what the row shows",
        None,
    )
    .unwrap();

    review::edit(
        &place,
        &feature,
        "spec.md",
        1,
        "Say what the row shows, and for how long",
    )
    .unwrap();
    assert!(read(&place, REVIEW).contains("\nSay what the row shows, and for how long\n"));

    review::remove(&place, &feature, "spec.md", 1).unwrap();
    assert!(!place.root.join(REVIEW).exists());
}

const DECISION: &str = "specs/decisions/task-storage.md";

/// Task storage on `main`, its rule merged away on line 12.
const DECISION_ON_MAIN: &str = "---\nicon: database\n---\n\n# Task storage\n\nWhere tasks live.\n\n## Rules\n\n- Data MUST be stored in IndexedDB.\n- A rule merged away MUST go.\n\n## Why\n\nBecause.\n";

/// Task storage on the feature's branch: a new rule on lines 12–13.
const DECISION_ON_BRANCH: &str = "---\nicon: database\n---\n\n# Task storage\n\nWhere tasks live.\n\n## Rules\n\n- Data MUST be stored in IndexedDB.\n- An upgrade that cannot read a saved value MUST clear it and log it,\n  and MUST NOT delete a task.\n\n## Why\n\nBecause.\n";

/// A feature whose spec waits for a review, its branch changing task storage, and `main` moved on
/// since, its own task storage rewritten.
fn decision_repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(DECISION, DECISION_ON_MAIN);
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.write(SPEC, &spec("awaiting-human", 1, 1));
    repo.write(DECISION, DECISION_ON_BRANCH);
    repo.commit("spec(web-ui): web UI");
    repo.switch("main");
    repo.worktree(FOLDER);
    repo.write(
        DECISION,
        &DECISION_ON_MAIN.replace("merged away", "of main"),
    );
    repo.commit("chore: main moves on");
    repo
}

/// Commits a file on the feature's branch, at its place.
fn commit_at(place: &Place, path: &str, text: &str) {
    put(place, path, text.as_bytes());
    run_git(&place.root, &["add", path]);
    run_git(
        &place.root,
        &["commit", "--quiet", "--no-verify", "-m", "chore: more"],
    );
}

fn on_decision(removed: bool) -> Option<DecisionTarget> {
    Some(DecisionTarget {
        name: "task-storage".into(),
        removed,
    })
}

/// US2.3
#[test]
fn a_comment_on_a_decision_part() {
    let repo = decision_repo();
    let git = Git::discover(repo.path()).unwrap();
    let (feature, place) = reach(&repo);

    let commented = review::comment(
        &git,
        &place,
        &feature,
        "spec.md",
        Some((12, 13)),
        "Log it where I can see it",
        on_decision(false),
    )
    .unwrap();

    assert_eq!(commented.number, 1);
    let text = read(&place, REVIEW);
    assert!(text.contains("## C1: Decision task-storage, lines 12–13, under \"Rules\"\n"));
    assert!(text.contains(
        "\n> - An upgrade that cannot read a saved value MUST clear it and log it,\n>   and MUST NOT delete a task.\n\nLog it where I can see it\n"
    ));
}

/// Edge case: a comment on a removed part.
#[test]
fn a_comment_on_a_removed_part_points_to_the_merge_base_lines() {
    let repo = decision_repo();
    let git = Git::discover(repo.path()).unwrap();
    let (feature, place) = reach(&repo);

    review::comment(
        &git,
        &place,
        &feature,
        "spec.md",
        Some((12, 12)),
        "Keep it",
        on_decision(true),
    )
    .unwrap();

    let text = read(&place, REVIEW);
    assert!(text.contains("## C1: Decision task-storage, line 12 removed, under \"Rules\"\n"));
    assert!(text.contains("\n> - A rule merged away MUST go.\n"));
}

#[test]
fn a_decision_comment_on_an_unknown_name_or_lines_is_refused() {
    let repo = decision_repo();
    let git = Git::discover(repo.path()).unwrap();
    let (feature, place) = reach(&repo);
    let target = |name: &str| {
        Some(DecisionTarget {
            name: name.into(),
            removed: false,
        })
    };

    commit_at(&place, "specs/decisions/two words.md", DECISION_ON_BRANCH);

    for name in [
        "git",
        "../2026-10-11-web-ui/spec",
        "",
        "two words",
        "a/b",
        ".hidden",
    ] {
        let refused = review::comment(
            &git,
            &place,
            &feature,
            "spec.md",
            Some((1, 1)),
            "No",
            target(name),
        );
        assert!(matches!(refused, Err(ActionError::Refused(_))), "{name}");
    }
    let past_its_end = review::comment(
        &git,
        &place,
        &feature,
        "spec.md",
        Some((12, 30)),
        "No",
        on_decision(false),
    );
    assert!(matches!(past_its_end, Err(ActionError::Refused(_))));
    assert!(!place.root.join(REVIEW).exists());
}

/// Review focus 6: a pending review stays while the spec is unchanged since its commit.
#[test]
fn a_decision_comment_keeps_a_fresh_review_only() {
    let repo = decision_repo();
    let git = Git::discover(repo.path()).unwrap();
    let (feature, place) = reach(&repo);
    let comment = |text: &str| {
        review::comment(
            &git,
            &place,
            &feature,
            "spec.md",
            Some((12, 13)),
            text,
            on_decision(false),
        )
        .unwrap()
    };
    review::comment(
        &git,
        &place,
        &feature,
        "spec.md",
        Some((9, 9)),
        "On the spec",
        None,
    )
    .unwrap();
    let first = read(&place, REVIEW);

    let kept = comment("At the same commit");
    commit_at(
        &place,
        "specs/2026-10-11-web-ui/proposal.md",
        "# Proposal\n\nOther.\n",
    );
    let still = comment("The spec unchanged since");

    assert!(!kept.replaced && !still.replaced);
    assert_eq!(still.number, 3);
    assert!(read(&place, REVIEW).starts_with(&first[..first.find("## C1").unwrap()]));
    commit_at(
        &place,
        SPEC,
        &spec("awaiting-human", 1, 1).replace("A feature.", "A feature, changed."),
    );
    let replaced = comment("The spec changed");
    assert!(replaced.replaced);
    assert_eq!(replaced.number, 1);
}

/// A pending review whose commit holds another version of the decision: its lines would not be
/// those of the review's commit.
#[test]
fn a_comment_on_a_decision_changed_since_the_pending_review_is_refused() {
    let repo = decision_repo();
    let git = Git::discover(repo.path()).unwrap();
    let (feature, place) = reach(&repo);
    review::comment(
        &git,
        &place,
        &feature,
        "spec.md",
        Some((9, 9)),
        "On the spec",
        None,
    )
    .unwrap();
    let before = read(&place, REVIEW);
    commit_at(
        &place,
        DECISION,
        &DECISION_ON_BRANCH.replace("Because.", "Because, still."),
    );

    let refused = review::comment(
        &git,
        &place,
        &feature,
        "spec.md",
        Some((12, 13)),
        "Too late",
        on_decision(false),
    );

    assert!(matches!(refused, Err(ActionError::Refused(_))));
    assert_eq!(read(&place, REVIEW), before);
}

/// A verdict applies the comments' lines: those on a decision are as the decision was at the
/// review's commit.
#[test]
fn a_verdict_on_a_review_of_a_decision_changed_since_is_refused() {
    let repo = decision_repo();
    let git = Git::discover(repo.path()).unwrap();
    let (feature, place) = reach(&repo);
    review::comment(
        &git,
        &place,
        &feature,
        "spec.md",
        Some((12, 13)),
        "Log it",
        on_decision(false),
    )
    .unwrap();
    commit_at(
        &place,
        DECISION,
        &DECISION_ON_BRANCH.replace("Because.", "Because, still."),
    );
    let before = read(&place, REVIEW);

    let approved = review::approve(&place, &feature, "spec.md", None, &Tier::default(), today());
    let requested = review::request_changes(&place, &feature, "spec.md", None, today());

    assert!(matches!(approved, Err(ActionError::Refused(_))));
    assert!(matches!(requested, Err(ActionError::Refused(_))));
    assert_eq!(read(&place, REVIEW), before);
}

/// A removed part's lines are the merge base's, at any commit: a decision edited since leaves
/// the review current.
#[test]
fn a_verdict_on_a_review_of_a_removed_part_stands_when_the_decision_changed_since() {
    let repo = decision_repo();
    let git = Git::discover(repo.path()).unwrap();
    let (feature, place) = reach(&repo);
    review::comment(
        &git,
        &place,
        &feature,
        "spec.md",
        Some((12, 12)),
        "Keep it",
        on_decision(true),
    )
    .unwrap();
    commit_at(
        &place,
        DECISION,
        &DECISION_ON_BRANCH.replace("Because.", "Because, still."),
    );

    let requested = review::request_changes(&place, &feature, "spec.md", None, today());

    assert!(requested.is_ok(), "{:?}", requested.err());
}

/// US6.1
#[test]
fn approving_with_a_higher_tier_leaves_the_plan_review_off() {
    let repo = spec_repo();
    let (feature, place) = reach(&repo);
    let tier = Tier {
        risk_tier: Some("high".to_string()),
        plan_review: None,
    };

    let head = repo.git(&["rev-parse", FOLDER]);

    review::approve(&place, &feature, "spec.md", None, &tier, today()).unwrap();

    assert_eq!(repo.git(&["rev-parse", FOLDER]), head);
    let text = read(&place, SPEC);
    assert!(text.contains("status: approved\n"));
    assert!(text.contains("risk-tier: high\n"));
    assert!(text.contains("plan-review: false\n"));
    assert_eq!(repo.subjects(FOLDER)[0], "spec(web-ui): web UI");
    assert_eq!(repo.current_branch(), "main");
}

/// The paths a verdict or a submission names, sorted.
fn sorted(change: &uraeda_core::actions::Change) -> Vec<String> {
    let mut paths = change.paths.clone();
    paths.sort();
    paths
}

const PROPOSAL: &str = "specs/2026-10-11-web-ui/proposal.md";
const IMAGES: &str = "specs/2026-10-11-web-ui/images";

/// Writes a file in a working tree, its folders created.
fn put(place: &Place, path: &str, bytes: &[u8]) {
    let file = place.root.join(path);
    std::fs::create_dir_all(file.parent().unwrap()).unwrap();
    std::fs::write(file, bytes).unwrap();
}

/// Appends a line to a file of a working tree.
fn append(place: &Place, path: &str, line: &str) {
    let text = read(place, path);
    std::fs::write(place.root.join(path), format!("{text}\n{line}\n")).unwrap();
}

/// US3.3
#[test]
fn us3_3_a_verdict_names_the_review_images() {
    let repo = spec_repo();
    let git = Git::discover(repo.path()).unwrap();
    let (feature, place) = reach(&repo);
    review::comment(
        &git,
        &place,
        &feature,
        "spec.md",
        None,
        "As here: ![shot](images/shot.webp)",
        None,
    )
    .unwrap();
    put(&place, &format!("{IMAGES}/shot.webp"), b"shot");

    let change =
        review::approve(&place, &feature, "spec.md", None, &Tier::default(), today()).unwrap();

    assert_eq!(
        sorted(&change),
        [IMAGES.to_string(), REVIEW.to_string(), SPEC.to_string()]
    );
}

#[test]
fn a_replaced_review_keeps_images_another_file_links() {
    let repo = spec_repo();
    repo.switch(FOLDER);
    repo.write(
        PROPOSAL,
        &format!("{}\n![shot](images/shot.webp)\n", proposal()),
    );
    repo.write(&format!("{IMAGES}/shot.webp"), "shot");
    repo.commit("chore(web-ui): edit the proposal");
    repo.switch("main");
    repo.worktree(FOLDER);
    let git = Git::discover(repo.path()).unwrap();
    let (feature, place) = reach(&repo);
    review::comment(
        &git,
        &place,
        &feature,
        "spec.md",
        None,
        "![shot](images/shot.webp)",
        None,
    )
    .unwrap();
    append(&place, SPEC, "A new version.");
    common::repo::run_git(
        &place.root,
        &["commit", "--quiet", "--no-verify", "-am", "spec"],
    );
    let git = Git::discover(repo.path()).unwrap();
    let replaced = review::comment(&git, &place, &feature, "spec.md", None, "Fine.", None).unwrap();
    assert!(replaced.replaced);

    let change =
        review::approve(&place, &feature, "spec.md", None, &Tier::default(), today()).unwrap();

    assert_eq!(sorted(&change), [IMAGES, REVIEW, SPEC]);
    assert!(place.root.join(IMAGES).join("shot.webp").exists());
}

/// US4.3
#[test]
fn us4_3_submitted_answers_name_their_images() {
    let repo = repo_with(&round(
        "B",
        "A",
        "A, as ![one](images/one.webp) and ![two](images/two.webp) show",
    ));
    let (feature, place) = reach(&repo);
    put(&place, &format!("{IMAGES}/one.webp"), b"one");
    put(&place, &format!("{IMAGES}/two.webp"), b"two");

    let change = answer::submit(&place, &feature, today(), false).unwrap();

    assert_eq!(sorted(&change), [ROUND.to_string(), IMAGES.to_string()]);
}

/// A replaced review's image that no other file links goes with the verdict.
#[test]
fn a_replaced_review_drops_the_images_only_it_linked() {
    let repo = spec_repo();
    let git = Git::discover(repo.path()).unwrap();
    let (feature, place) = reach(&repo);
    review::comment(
        &git,
        &place,
        &feature,
        "spec.md",
        None,
        "![shot](images/shot.webp)",
        None,
    )
    .unwrap();
    put(&place, &format!("{IMAGES}/shot.webp"), b"shot");
    append(&place, SPEC, "A new version.");
    common::repo::run_git(
        &place.root,
        &["commit", "--quiet", "--no-verify", "-am", "spec"],
    );
    let git = Git::discover(repo.path()).unwrap();
    let replaced = review::comment(&git, &place, &feature, "spec.md", None, "Fine.", None).unwrap();
    assert!(replaced.replaced);

    let change =
        review::approve(&place, &feature, "spec.md", None, &Tier::default(), today()).unwrap();

    assert_eq!(sorted(&change), [REVIEW, SPEC]);
    assert!(!place.root.join(IMAGES).exists());
}

#[test]
fn a_request_for_changes_names_the_review_images() {
    let repo = spec_repo();
    let git = Git::discover(repo.path()).unwrap();
    let (feature, place) = reach(&repo);
    review::comment(
        &git,
        &place,
        &feature,
        "spec.md",
        Some((1, 1)),
        "Like this: ![shot](images/shot.webp)",
        None,
    )
    .unwrap();
    put(&place, &format!("{IMAGES}/shot.webp"), b"shot");
    put(&place, &format!("{IMAGES}/old.webp"), b"old");

    let change = review::request_changes(&place, &feature, "spec.md", None, today()).unwrap();

    assert_eq!(
        sorted(&change),
        [IMAGES.to_string(), REVIEW.to_string(), SPEC.to_string()]
    );
    assert!(!place.root.join(IMAGES).join("old.webp").exists());
}

/// A round whose last question is followed by its notes, with no section between: the last answer
/// ends at the `**Notes:**` line, when it is read and when it is written.
#[test]
fn a_rounds_last_answer_ends_at_the_notes() {
    let unsettled = round("B", "A", "").replace(
        "## Settled without the human\n\n- **A point** settled.\n\n",
        "",
    );
    let repo = repo_with(&unsettled);
    let (feature, place) = reach(&repo);

    let blank = answer::submit(&place, &feature, today(), false).unwrap_err();
    answer::save(&place, &feature, "Q2", &letters(&["A"]), "", "").unwrap();
    answer::save_notes(&place, &feature, "Fine.", "").unwrap();

    assert_eq!(blank.to_string(), "Q2 has no answer");
    assert!(
        read(&place, ROUND).ends_with("  - [con] c\n\n**Answer:** A\n\n**Notes:** Fine.\n"),
        "{}",
        read(&place, ROUND)
    );
}

#[test]
fn submitting_to_resume_marks_the_round_when_the_implementation_is_under_way() {
    let repo = repo_with(&round("B", "A", "A"));
    repo.switch(FOLDER);
    repo.write(
        "specs/2026-10-11-web-ui/spec.md",
        &texts::spec("approved", 1, 1),
    );
    repo.write(
        "specs/2026-10-11-web-ui/plan.md",
        &texts::plan("approved", 1, &[("One", 0, 1)]),
    );
    repo.commit("plan(web-ui): plan");
    repo.switch("main");
    repo.worktree(FOLDER);
    let (feature, place) = reach(&repo);

    answer::submit(&place, &feature, today(), true).unwrap();

    let text = read(&place, ROUND);
    assert!(
        text.starts_with("---\nstatus: answered\nresumes: implementation\n---\n"),
        "{text}"
    );
}

#[test]
fn submitting_to_resume_is_refused_before_the_implementation_is_under_way() {
    let repo = repo_with(&round("B", "A", "A"));
    let (feature, place) = reach(&repo);

    let error = answer::submit(&place, &feature, today(), true).unwrap_err();

    assert!(matches!(error, ActionError::Refused(_)), "{error}");
    assert!(read(&place, ROUND).contains("status: awaiting-human"));
    assert!(!read(&place, ROUND).contains("resumes"));
}

#[test]
fn submitting_without_resuming_removes_the_key_of_a_reopened_round() {
    let reopened = round("B", "A", "A").replacen(
        "status: awaiting-human",
        "status: awaiting-human\nresumes: implementation",
        1,
    );
    let repo = repo_with(&reopened);
    let (feature, place) = reach(&repo);

    answer::submit(&place, &feature, today(), false).unwrap();

    assert!(!read(&place, ROUND).contains("resumes"));
}
