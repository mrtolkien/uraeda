mod common;

use uraeda_core::files::clarifications::{compose_answer, split_answer};
use uraeda_core::files::document::{self, plain};
use uraeda_core::files::items::{Items, items};
use uraeda_core::files::review::{edit_comment, remove_comment};

const EXAMPLE: &str = "skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks";

fn example(name: &str) -> (String, Items, document::Document) {
    let text = common::repository_file(&format!("{EXAMPLE}/{name}"));
    let doc = document::parse(&text, EXAMPLE);
    let items = items(name, &text, &doc);
    (text, items, doc)
}

fn strings(items: &[&str]) -> Vec<String> {
    items.iter().map(|s| s.to_string()).collect()
}

#[test]
fn answers_are_composed_as_the_ui_writes_them() {
    let cases: [(&[&str], &str, &str); 7] = [
        (&["A"], "", "A"),
        (&["B", "C"], "", "B and C"),
        (&["A", "B", "C"], "", "A, B and C"),
        (
            &["A"],
            "but only for the dev server",
            "A: but only for the dev server",
        ),
        (&[], "Neither, keep it simple", "Neither, keep it simple"),
        (&["C", "A"], "", "A and C"),
        (&[], "-", "-"),
    ];
    for (letters, comment, expected) in cases {
        assert_eq!(compose_answer(&strings(letters), comment), expected);
    }
}

#[test]
fn answers_are_split_into_letters_and_comment() {
    let options = ['A', 'B', 'C'];
    let cases: [(&str, &[&str], &str); 7] = [
        ("B and C: weekdays matter", &["B", "C"], "weekdays matter"),
        ("A", &["A"], ""),
        ("A, B and C", &["A", "B", "C"], ""),
        ("A, B, and C: all", &["A", "B", "C"], "all"),
        (
            "C, we want a simple feature",
            &[],
            "C, we want a simple feature",
        ),
        ("Neither", &[], "Neither"),
        ("-", &[], "-"),
    ];
    for (answer, letters, comment) in cases {
        assert_eq!(
            split_answer(answer, &options),
            (strings(letters), comment.to_string()),
            "{answer}"
        );
    }
}

/// Review focus 2: a comment over several lines keeps its letters and comes back the same.
#[test]
fn a_comment_with_a_line_break_round_trips() {
    let answer = compose_answer(&strings(&["A"]), "line one\nline two");

    assert_eq!(answer, "A: line one\nline two");
    assert_eq!(
        split_answer(&answer, &['A', 'B']),
        (strings(&["A"]), "line one\nline two".to_string())
    );
}

#[test]
fn a_round_has_its_questions_and_options() {
    let (_, items, doc) = example("clarifications-01.md");
    let round = items.clarifications.unwrap();

    assert_eq!(round.status.as_deref(), Some("answered"));
    assert!(round.block.is_some());
    assert!(!round.context.is_empty());
    let q1 = &round.questions[0];
    assert_eq!(q1.id, "Q1");
    assert_eq!(q1.title, "How should users pick when a task repeats?");
    let letters: Vec<&str> = q1.options.iter().map(|o| o.letter.as_str()).collect();
    assert_eq!(letters, ["A", "B", "C"]);
    assert!(q1.options[0].recommended);
    assert_eq!(
        plain(&q1.options[0].summary),
        "Presets only: daily, weekdays, weekly, monthly, yearly."
    );
    assert_eq!(q1.options[0].pros.len(), 1);
    assert_eq!(q1.options[0].cons.len(), 1);
    assert!(q1.options[0].why.is_some());
    assert_eq!(q1.letters, strings(&["B", "C"]));
    assert!(q1.comment.starts_with("we need to easily handle weekdays"));
    // Its context holds the paragraphs before the options, not the answer.
    let context: Vec<String> = q1.context.iter().map(|&id| doc.text(id)).collect();
    assert!(context.iter().any(|t| t.starts_with("Why it matters")));
    assert!(context.iter().all(|t| !t.starts_with("Answer:")));

    let follow_up = round.questions.iter().find(|q| q.id == "Q2.B").unwrap();
    assert_eq!(follow_up.parent.as_deref(), Some("Q2"));
    assert_eq!(follow_up.parent_letter.as_deref(), Some("B"));
    assert_eq!(follow_up.applies, "no");
    assert!(!round.settled.is_empty());
    assert!(round.notes.is_some());
}

#[test]
fn a_spec_has_its_stories_and_criteria() {
    let (_, items, doc) = example("spec.md");
    let spec = items.spec.unwrap();

    let us2 = spec.stories.iter().find(|s| s.id == "US2").unwrap();
    assert_eq!(us2.title, "Complete a repeating task");
    assert_eq!(us2.priority, "P1");
    assert!(doc.text(us2.why.unwrap()).starts_with("Why this priority"));
    let scenarios: Vec<(u32, u32, u32)> = us2
        .scenarios
        .iter()
        .map(|s| {
            let block = &doc.blocks[s.block as usize];
            (s.number, block.start_line, block.end_line)
        })
        .collect();
    assert_eq!(&scenarios[..2], [(1, 58, 59), (2, 60, 61)]);
    assert_eq!(spec.criteria[0].id, "SC-001");
}

/// Review focus 4: a spec without stories, or a story without scenarios, still has its items.
#[test]
fn a_spec_without_stories_has_none() {
    let text = "# Spec: X\n\n## User stories\n\n### US1: Bare (P2)\n\nJust text.\n";
    let doc = document::parse(text, "specs/x");
    let spec = items("spec.md", text, &doc).spec.unwrap();

    assert_eq!(spec.stories.len(), 1);
    assert!(spec.stories[0].scenarios.is_empty());
    let empty = "# Spec: X\n\n## User stories\n";
    let doc = document::parse(empty, "specs/x");
    assert!(
        items("spec.md", empty, &doc)
            .spec
            .unwrap()
            .stories
            .is_empty()
    );
}

/// The first lines of US2's details, and the first and last lines of the spec's details.
type Folds = (Vec<u32>, Option<(u32, u32)>);

fn folds(text: &str) -> Folds {
    let doc = document::parse(text, "specs/x");
    let spec = items("spec.md", text, &doc).spec.unwrap();
    let line = |id: &u32| doc.blocks[*id as usize].start_line;
    let story = spec.stories.iter().find(|s| s.id == "US2").unwrap();
    let details = spec
        .details
        .first()
        .zip(spec.details.last())
        .map(|(first, last)| (line(first), line(last)));
    (story.details.iter().map(line).collect(), details)
}

/// US1.1 and review focus 3: the folds are a story's scenarios with their intro, and the
/// `## Details` section up to the next level-2 heading.
#[test]
fn a_spec_has_its_folds() {
    let example = common::repository_file(&format!("{EXAMPLE}/spec.md"));
    let story = "# Spec: X\n\n## User stories\n\n### US2: Y (P1)\n\nText.\n\n";
    let scenario = "1. **Given** a, **When** b, **Then** c.\n";
    let cases: [(&str, String, Folds); 5] = [
        ("the example", example, (vec![56, 58], Some((193, 249)))),
        (
            "a story with no scenarios",
            format!("{story}Acceptance scenarios:\n\nNone yet.\n"),
            (vec![], None),
        ),
        (
            "a list with no scenarios intro",
            format!("{story}{scenario}"),
            (vec![], None),
        ),
        (
            "details before another section",
            format!("{story}## Details\n\n### Data\n\nA table.\n\n## Appendix\n\nMore.\n"),
            (vec![], Some((9, 13))),
        ),
        (
            "a spec without details",
            format!("{story}Acceptance scenarios:\n\n{scenario}\n## Risk tier\n\nLow.\n"),
            (vec![9, 11], None),
        ),
    ];
    for (case, text, expected) in cases {
        assert_eq!(folds(&text), expected, "{case}");
    }
}

/// C2: the mockups the review opens first are the links of the `## Mockups` section, each with the
/// block a comment on it lands on.
#[test]
fn a_spec_has_its_mockups() {
    let (_, example, doc) = example("spec.md");
    let mockups = example.spec.unwrap().mockups;

    assert_eq!(mockups.len(), 1);
    assert_eq!(mockups[0].path, "mockups/repeat.html");
    assert_eq!(mockups[0].label, "Repeat");
    let block = &doc.blocks[mockups[0].block as usize];
    assert_eq!(
        (block.start_line, block.heading.as_deref()),
        (141, Some("Mockups"))
    );

    let story = "# Spec: X\n\n## User stories\n\n### US1: Y (P1)\n\nSee [it](mockups/a.html).\n";
    let doc = document::parse(story, "specs/x");
    assert!(
        items("spec.md", story, &doc)
            .spec
            .unwrap()
            .mockups
            .is_empty()
    );

    let section = "## Mockups\n\n- [**Big** board](./mockups/b.html#top), [data](data.md)\n";
    let text = format!("{story}\n{section}");
    let doc = document::parse(&text, "specs/x");
    let links: Vec<(String, String)> = items("spec.md", &text, &doc)
        .spec
        .unwrap()
        .mockups
        .into_iter()
        .map(|m| (m.path, m.label))
        .collect();
    assert_eq!(links, [("mockups/b.html".into(), "Big board".into())]);
}

#[test]
fn a_plan_has_its_tasks_and_steps() {
    let (_, items, _) = example("plan.md");
    let tasks = items.plan.unwrap().tasks;

    let task4 = tasks.iter().find(|t| t.number == 4).unwrap();
    assert_eq!(task4.title, "The custom repeat screen");
    assert_eq!((task4.done, task4.total), (5, 5));
    assert_eq!(task4.steps.len(), 5);
}

#[test]
fn rulings_have_their_ids() {
    let (_, items, _) = example("rulings.md");
    let rulings = items.rulings.unwrap();

    assert_eq!(rulings[0].id, "R1");
    assert_eq!(rulings[0].title, "Fake timers advance during user events");
    assert!(!rulings[0].blocks.is_empty());
}

const REVIEW: &str = "---\nverdict: pending\ncommit: a1b2c3d\n---\n\n# Review: Spec, Recurring tasks\n\n## C1: Lines 58–59, under \"US2: Complete a repeating task (P1)\"\n\n> one\n> two\n\nSay what the row shows\n\n## C2: General\n\nShorter, please\n";

#[test]
fn a_review_has_its_comments() {
    let doc = document::parse(REVIEW, "specs/x");
    let review = items("spec-review.md", REVIEW, &doc).review.unwrap();

    assert_eq!(review.verdict, "pending");
    assert_eq!(review.commit, "a1b2c3d");
    assert_eq!(review.comments.len(), 2);
    assert_eq!(
        (review.comments[0].start_line, review.comments[0].end_line),
        (58, 59)
    );
    assert_eq!(review.comments[0].quote, strings(&["one", "two"]));
    assert!(review.comments[1].general);
}

#[test]
fn a_comment_is_edited_and_removed() {
    let edited = edit_comment(REVIEW, 1, "Say what the row shows, and for how long").unwrap();
    assert!(edited.contains("> one\n> two\n\nSay what the row shows, and for how long\n"));

    let removed = remove_comment(REVIEW, 1).unwrap().unwrap();
    assert!(removed.contains("## C1: General\n\nShorter, please"));
    assert!(!removed.contains("## C2"));

    let one = remove_comment(&removed, 1).unwrap();
    assert_eq!(one, None);
}

#[test]
fn the_settled_section_ends_at_the_notes_and_takes_comments() {
    let text =
        std::fs::read_to_string(common::fixture("settled-comments/clarifications-01.md")).unwrap();
    let doc = document::parse(&text, "specs/2026-10-06-recurring-tasks");
    let round = items("clarifications-01.md", &text, &doc)
        .clarifications
        .unwrap();
    let notes_line = round.notes_line.unwrap();

    // The section's blocks stop before the **Notes:** line.
    assert!(!round.settled.is_empty());
    for &id in &round.settled {
        let block = doc.blocks.iter().find(|block| block.id == id).unwrap();
        assert!(block.start_line < notes_line, "{}", doc.text(id));
    }
    // Each point with a bold start, the one without left out.
    let subjects: Vec<&str> = round
        .settled_points
        .iter()
        .map(|point| point.subject.as_str())
        .collect();
    assert_eq!(
        subjects,
        [
            "Undoing a completion",
            "Deleting a repeating task",
            "Undoing a completion"
        ]
    );
    assert_eq!(
        round.notes.as_deref(),
        Some("Overall fine.\n\n- **Nothing matches**: stays in the free notes.")
    );
    let comments: Vec<(u32, &str, u32, &str)> = round
        .settled_comments
        .iter()
        .map(|c| (c.number, c.subject.as_str(), c.point, c.text.as_str()))
        .collect();
    let points = &round.settled_points;
    assert_eq!(
        comments,
        [
            (
                1,
                "Undoing a completion",
                points[0].block,
                "Keep the undo.\nAlso for deletes."
            ),
            (
                2,
                "Deleting a repeating task",
                points[1].block,
                "Ask first."
            ),
        ]
    );
}
