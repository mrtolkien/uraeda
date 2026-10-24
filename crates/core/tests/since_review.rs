//! A spec's revision says what changed since the version its human reviewed: the spec at the
//! review's commit against the one the page shows, part by part, as a decision's change matches
//! them.

mod common;

use common::repo::TestRepo;
use uraeda_core::api;
use uraeda_core::decisions::Run;
use uraeda_core::files::document::LineRange;
use uraeda_core::view::{SinceChange, SinceReview};

const FOLDER: &str = "2026-10-10-recurring-tasks";
const SPEC: &str = "specs/2026-10-10-recurring-tasks/spec.md";
const REVIEW: &str = "specs/2026-10-10-recurring-tasks/spec-review.md";

const US1: &str = "US1: Make a task repeat (P1)";
const US2: &str = "US2: Complete a repeating task (P1)";

/// The spec at revision 1, as its human reviewed it.
const REVISION_1: &str = "---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: low
---

# Spec: Recurring tasks

> [!IMPORTANT]
>
> Spec to review, about 10 minutes.
>
> - You approve tasks that repeat from a menu.

## User stories

### US1: Make a task repeat (P1)

In a task's edit panel, a repeat menu offers never, daily, weekdays, weekly, monthly, yearly, and
custom.

A repeating task shows a repeat icon in the list.

### US2: Complete a repeating task (P1)

Completing a repeating task moves it to its next due date, instead of marking it done. The row says
so for 3 seconds, with an undo button.

Key scenarios:

1. **Given** a weekly task due Monday the 5th, **When** the user completes it on Thursday the 8th,
   **Then** it stays in the list, not done, due Monday the 12th.

## Architecture

- **The schedule** computes the next due date from the rule and the day of completion.
- **The store** keeps the rule with the task.

## Decisions

Relied on:

- None.
";

/// `REVISION_1` at revision 2, with each `(from, to)` replaced.
fn revision_2(replaced: &[(&str, &str)]) -> String {
    replaced.iter().fold(
        REVISION_1.replace("revision: 1", "revision: 2"),
        |text, (from, to)| {
            assert!(text.contains(from), "{from:?} is in revision 1");
            text.replace(from, to)
        },
    )
}

fn review(verdict: &str, commit: &str) -> String {
    format!(
        "---\nverdict: {verdict}\ncommit: {commit}\n---\n\n# Review: Spec, Recurring tasks\n\n## C1: Line 30, under \"{US2}\"\n\n> so for 3 seconds, with an undo button.\n\n3 seconds is too short to reach the button.\n"
    )
}

/// A feature's branch where revision 1 is committed, then its review with `verdict` at that
/// commit's short hash, or at `commit` when given, then `revised` committed, with `main` checked
/// out.
fn reviewed(verdict: &str, commit: Option<&str>, revised: &str) -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write(SPEC, REVISION_1);
    repo.commit("docs(recurring-tasks): spec");
    let tip = short_tip(&repo);
    repo.write(REVIEW, &review(verdict, commit.unwrap_or(&tip)));
    repo.commit("docs(recurring-tasks): request changes");
    repo.write(SPEC, revised);
    repo.commit("docs(recurring-tasks): revise the spec");
    repo.switch("main");
    repo
}

/// The checkout's tip as a review names it: its 7-character hash.
fn short_tip(repo: &TestRepo) -> String {
    repo.git(&["rev-parse", "--short=7", "HEAD"])
        .trim()
        .to_string()
}

fn since(repo: &TestRepo) -> Option<SinceReview> {
    api::read_file(repo.path(), FOLDER, "spec.md")
        .unwrap()
        .since_review
}

/// The 1-based lines of `text` from the line holding `first` to the one holding `last`.
fn lines(text: &str, first: &str, last: &str) -> LineRange {
    let line = |needle: &str| {
        let index = text.lines().position(|line| line.contains(needle));
        index.unwrap_or_else(|| panic!("{needle:?} is in the text")) as u32 + 1
    };
    LineRange {
        start: line(first),
        end: line(last),
    }
}

fn run(kind: &str, text: &str) -> Run {
    Run {
        kind: kind.to_string(),
        text: text.to_string(),
    }
}

fn added(heading: &str, lines: LineRange, text: &str) -> SinceChange {
    SinceChange {
        kind: "added".to_string(),
        heading: heading.to_string(),
        before: None,
        after: Some(lines),
        runs: vec![run("added", text)],
    }
}

const JOURNEY: &str = "Completing a repeating task moves it to its next due date, instead of marking it done. The row says so for";

/// US5 key 1 and 2: the journey's changed words, the review's answers added, a reworded part
/// elsewhere changed, and nothing else. A review started on the revision since leaves it as the
/// revision's first commit read it.
#[test]
fn revision_two_changes() {
    let answers = "## Your review\n\n- **C1** (undo too short): done. The undo now stays 5 seconds.\n- **C2** (icon): kept.\n\n## User stories";
    let text = revision_2(&[
        ("so for 3 seconds", "so for 5 seconds"),
        ("## User stories", answers),
        (
            "keeps the rule with the task.",
            "keeps the rule with the task, in its own column.",
        ),
    ]);
    let repo = reviewed("changes-requested", None, &text);
    repo.switch(FOLDER);
    let tip = short_tip(&repo);
    repo.write(REVIEW, &review("pending", &tip));
    repo.commit("docs(recurring-tasks): review the revision");
    repo.switch("main");

    let journey = SinceChange {
        kind: "changed".to_string(),
        heading: US2.to_string(),
        before: Some(lines(
            REVISION_1,
            "Completing a repeating",
            "so for 3 seconds",
        )),
        after: Some(lines(&text, "Completing a repeating", "so for 5 seconds")),
        runs: vec![
            run("kept", JOURNEY),
            run("removed", "3"),
            run("added", "5"),
            run("kept", "seconds, with an undo button."),
        ],
    };
    let store = SinceChange {
        kind: "changed".to_string(),
        heading: "Architecture".to_string(),
        before: Some(lines(REVISION_1, "**The store**", "**The store**")),
        after: Some(lines(&text, "**The store**", "**The store**")),
        runs: vec![
            run("kept", "The store keeps the rule with the"),
            run("removed", "task."),
            run("added", "task, in its own column."),
        ],
    };
    assert_eq!(
        since(&repo),
        Some(SinceReview {
            revision: 1,
            found: true,
            parts: vec![
                added(
                    "Your review",
                    lines(&text, "**C1**", "**C1**"),
                    "C1 (undo too short): done. The undo now stays 5 seconds.",
                ),
                added(
                    "Your review",
                    lines(&text, "**C2**", "**C2**"),
                    "C2 (icon): kept.",
                ),
                journey,
                store,
            ],
        })
    );
}

/// US5 more 1: a first revision has no review to compare with.
#[test]
fn first_revision_has_none() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write(SPEC, REVISION_1);
    repo.write(REVIEW, &review("changes-requested", "a1b2c3d"));
    repo.commit("docs(recurring-tasks): spec and review");
    repo.switch("main");

    assert_eq!(since(&repo), None);
}

/// US5 more 2: a paragraph gone is removed, at its lines in the reviewed version, under its
/// heading there.
#[test]
fn removed_part() {
    let icon = "A repeating task shows a repeat icon in the list.";
    let text = revision_2(&[(&format!("{icon}\n\n"), "")]);
    let repo = reviewed("changes-requested", None, &text);

    assert_eq!(
        since(&repo),
        Some(SinceReview {
            revision: 1,
            found: true,
            parts: vec![SinceChange {
                kind: "removed".to_string(),
                heading: US1.to_string(),
                before: Some(lines(REVISION_1, icon, icon)),
                after: None,
                runs: vec![run("removed", icon)],
            }],
        })
    );
}

/// The edge case: the reviewed commit is not in git anymore, after a rebase and a clean-up.
#[test]
fn missing_commit() {
    let text = revision_2(&[("so for 3 seconds", "so for 5 seconds")]);
    let repo = reviewed("changes-requested", Some("4f2a9c1"), &text);

    assert_eq!(
        since(&repo),
        Some(SinceReview {
            revision: 1,
            found: false,
            parts: Vec::new(),
        })
    );
}

/// Review focus 2: the frontmatter is not a part.
#[test]
fn frontmatter_alone() {
    let reviewed_text = REVISION_1.replace("status: awaiting-human", "status: changes-requested");
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write(SPEC, &reviewed_text);
    repo.commit("docs(recurring-tasks): spec");
    let tip = short_tip(&repo);
    repo.write(REVIEW, &review("changes-requested", &tip));
    repo.write(SPEC, &revision_2(&[]));
    repo.commit("docs(recurring-tasks): revise the spec");
    repo.switch("main");

    assert_eq!(
        since(&repo),
        Some(SinceReview {
            revision: 1,
            found: true,
            parts: Vec::new(),
        })
    );
}

/// Review focus 1: an approval with comments requested no revision, so the revision answers no
/// review and marks nothing.
#[test]
fn approved_with_comments_has_none() {
    let text = revision_2(&[("so for 3 seconds", "so for 5 seconds")]);
    let repo = reviewed("approved", None, &text);

    assert_eq!(since(&repo), None);
}

/// The opening callout is rewritten at every revision: it is not a part, on either side.
#[test]
fn callout_rewritten() {
    let text = revision_2(&[
        (
            "Spec to review, about 10 minutes.",
            "Spec to review, revision 2, about 10 minutes.",
        ),
        (
            "You approve tasks that repeat from a menu.",
            "You approve tasks that repeat from a menu, and complete to their next date.",
        ),
    ]);
    let repo = reviewed("changes-requested", None, &text);

    assert_eq!(
        since(&repo),
        Some(SinceReview {
            revision: 1,
            found: true,
            parts: Vec::new(),
        })
    );
}

/// A story's heading changed is a part, at its heading's lines, under its new heading.
#[test]
fn story_heading_changed() {
    let heading = "US2: Complete a repeating task (P2)";
    let text = revision_2(&[(US2, heading)]);
    let repo = reviewed("changes-requested", None, &text);

    assert_eq!(
        since(&repo),
        Some(SinceReview {
            revision: 1,
            found: true,
            parts: vec![SinceChange {
                kind: "changed".to_string(),
                heading: heading.to_string(),
                before: Some(lines(REVISION_1, US2, US2)),
                after: Some(lines(&text, heading, heading)),
                runs: vec![
                    run("kept", "US2: Complete a repeating task"),
                    run("removed", "(P1)"),
                    run("added", "(P2)"),
                ],
            }],
        })
    );
}

/// A section renamed, its parts kept, is its heading's change alone.
#[test]
fn section_renamed() {
    let text = revision_2(&[("## Architecture", "## Design")]);
    let repo = reviewed("changes-requested", None, &text);

    assert_eq!(
        since(&repo),
        Some(SinceReview {
            revision: 1,
            found: true,
            parts: vec![SinceChange {
                kind: "changed".to_string(),
                heading: "Design".to_string(),
                before: Some(lines(REVISION_1, "## Architecture", "## Architecture")),
                after: Some(lines(&text, "## Design", "## Design")),
                runs: vec![run("removed", "Architecture"), run("added", "Design")],
            }],
        })
    );
}

/// R6: an approved spec is not under review anymore, so it marks nothing.
#[test]
fn approved_revision_has_none() {
    let text = revision_2(&[
        ("status: awaiting-human", "status: approved"),
        ("so for 3 seconds", "so for 5 seconds"),
    ]);
    let repo = reviewed("changes-requested", None, &text);

    assert_eq!(since(&repo), None);
}
