mod common;

use uraeda_core::files::clarifications::{compose_answer, letters, split_answer};
use uraeda_core::files::document::{self, plain};
use uraeda_core::files::items::{Items, SpecItems, items};
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

/// Review focus 2: the letters are the longest run of joined letters followed by an end mark or
/// the end, with no letter when no run is, and `letters()` and `split_answer()` read them the same way.
#[test]
fn answers_are_split_into_letters_and_comment() {
    let options = ['A', 'B', 'C'];
    let cases: [(&str, &[&str], &str); 15] = [
        (
            "C, we want a simple feature",
            &["C"],
            "we want a simple feature",
        ),
        (
            "B, let's not overload the interface",
            &["B"],
            "let's not overload the interface",
        ),
        ("B.", &["B"], ""),
        (
            "A mix of both would be better",
            &[],
            "A mix of both would be better",
        ),
        ("C but with napi-rs", &[], "C but with napi-rs"),
        ("A, B and C", &["A", "B", "C"], ""),
        ("B and C: weekdays matter", &["B", "C"], "weekdays matter"),
        ("B, C and D", &["B"], "C and D"),
        ("A and B are both bad", &[], "A and B are both bad"),
        ("C and then more", &[], "C and then more"),
        ("A", &["A"], ""),
        ("A, B, and C: all", &["A", "B", "C"], "all"),
        ("Neither", &[], "Neither"),
        ("-", &[], "-"),
        ("", &[], ""),
    ];
    for (answer, picked, comment) in cases {
        assert_eq!(
            split_answer(answer, &options),
            (strings(picked), comment.to_string()),
            "{answer}"
        );
        let chars: Vec<char> = picked.iter().flat_map(|letter| letter.chars()).collect();
        assert_eq!(letters(answer, &options), chars, "{answer}");
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
    let titles: Vec<&str> = round.context.iter().map(|p| p.title.as_str()).collect();
    assert_eq!(titles, ["Goal", "Today", "Scope", "Sources"]);
    for part in &round.context {
        let heading = part.heading.unwrap();
        assert_eq!(doc.text(heading), part.title);
        assert!(!part.blocks.is_empty());
        assert!(!part.blocks.contains(&heading));
    }
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
    // Its context holds the paragraphs before the options, not the answer, and "Why it matters"
    // stands apart.
    let why = q1.why.unwrap();
    assert!(doc.text(why).starts_with("Why it matters"));
    assert!(!q1.context.contains(&why));
    let context: Vec<String> = q1.context.iter().map(|&id| doc.text(id)).collect();
    assert!(!context.is_empty());
    assert!(context.iter().all(|t| !t.starts_with("Why it matters")));
    assert!(context.iter().all(|t| !t.starts_with("Answer:")));

    let follow_up = round.questions.iter().find(|q| q.id == "Q2.B").unwrap();
    assert_eq!(follow_up.parent.as_deref(), Some("Q2"));
    assert_eq!(follow_up.parent_letter.as_deref(), Some("B"));
    assert_eq!(follow_up.applies, "no");
    let kinds: Vec<&str> = round
        .settled_groups
        .iter()
        .map(|g| g.kind.as_str())
        .collect();
    assert_eq!(kinds, ["check", "behaviour"]);
    let subjects = |group: &uraeda_core::files::items::SettledGroup| -> Vec<String> {
        round
            .settled_points
            .iter()
            .filter(|p| {
                group
                    .blocks
                    .iter()
                    .any(|&b| doc.children(b).any(|i| i.id == p.block))
            })
            .map(|p| p.subject.clone())
            .collect()
    };
    assert_eq!(
        subjects(&round.settled_groups[0]),
        strings(&["Skipping one occurrence"])
    );
    assert_eq!(
        subjects(&round.settled_groups[1]),
        strings(&[
            "Monthly repeats on the 29th to 31st",
            "Repeating tasks show a repeat icon"
        ])
    );
    for group in &round.settled_groups {
        assert_eq!(
            doc.text(group.heading),
            match group.kind.as_str() {
                "check" => "Check these",
                _ => "Behaviour",
            }
        );
    }
    assert!(round.notes.is_some());
}

#[test]
fn a_spec_has_its_stories_and_criteria() {
    let (_, items, doc) = example("spec.md");
    let spec = items.spec.unwrap();

    let us2 = spec.stories.iter().find(|s| s.id == "US2").unwrap();
    assert_eq!(us2.title, "Complete a repeating task");
    assert_eq!(us2.priority, "P1");
    let us3 = spec.stories.iter().find(|s| s.id == "US3").unwrap();
    assert!(doc.text(us3.why.unwrap()).starts_with("Why this priority"));
    let scenarios: Vec<(u32, u32, u32)> = us2
        .key
        .iter()
        .map(|s| {
            let block = &doc.blocks[s.block as usize];
            (s.number, block.start_line, block.end_line)
        })
        .collect();
    assert_eq!(scenarios, [(1, 82, 83), (2, 84, 85)]);
    assert_eq!(spec.criteria[0].id, "SC-001");
}

/// Review focus 4: a spec without stories, or a story without scenarios, still has its items.
#[test]
fn a_spec_without_stories_has_none() {
    let text = "# Spec: X\n\n## User stories\n\n### US1: Bare (P2)\n\nJust text.\n";
    let doc = document::parse(text, "specs/x");
    let spec = items("spec.md", text, &doc).spec.unwrap();

    assert_eq!(spec.stories.len(), 1);
    assert!(spec.stories[0].key.is_empty());
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

/// The spec items of a text, with its document tree, as a spec of `specs/x` reads.
fn spec_of(text: &str) -> (SpecItems, document::Document) {
    let doc = document::parse(text, "specs/x");
    (items("spec.md", text, &doc).spec.unwrap(), doc)
}

/// US3 1: a story's key scenarios and its more scenarios are two lists, and its mockup the
/// paragraph holding only its story link.
#[test]
fn a_story_has_its_key_and_more_scenarios() {
    let (_, items, doc) = example("spec.md");
    let spec = items.spec.unwrap();

    let us2 = &spec.stories[1];
    assert_eq!((us2.key.len(), us2.more.len()), (2, 2));
    let line = |block: u32| doc.blocks[block as usize].start_line;
    assert_eq!(line(us2.more[0].block), 89);
    assert_eq!(us2.more[1].number, 2);
    assert_eq!(line(us2.mockup.unwrap()), 78);
    assert!(spec.stories[3].mockup.is_none());

    let text = "# Spec: X\n\n## User stories\n\n### US1: Y (P1)\n\nKey scenarios:\n\n\
        1. **Given** a, **When** b, **Then** c.\n";
    let (spec, _) = spec_of(text);
    assert_eq!(
        (spec.stories[0].key.len(), spec.stories[0].more.len()),
        (1, 0)
    );
}

/// US4 1: a revision has the answers to the last review, by comment number and verdict, and the
/// spec's parts run from "Your review" to "History".
#[test]
fn a_revision_has_its_answers_parts_and_history() {
    let (_, items, doc) = example("spec.md");
    let spec = items.spec.unwrap();

    assert_eq!(spec.answers[1].number, 2);
    assert_eq!(spec.answers[1].verdict, "done");
    assert_eq!(spec.answers[1].summary, "undo too short");
    assert!(
        doc.text(spec.answers[1].block)
            .starts_with("C2 (undo too short)")
    );
    let titles: Vec<&str> = spec.parts.iter().map(|p| p.title.as_str()).collect();
    assert_eq!(titles.first(), Some(&"Your review"));
    assert_eq!(titles.last(), Some(&"History"));
    assert_eq!(titles.len(), 10);
    let stories = spec
        .parts
        .iter()
        .find(|p| p.title == "User stories")
        .unwrap();
    assert_eq!(stories.anchor, "user-stories");
    assert_eq!(doc.text(stories.heading), "User stories");

    let text = "# Spec: X\n\n## Your review\n\n\
        - **C1** (French phrases): declined. English only.\n\
        - **C3** (a note (with brackets)): done. Done.\n\
        - C4 (not bold): done. Ignored.\n";
    let (spec, _) = spec_of(text);
    let answers: Vec<(u32, &str, &str)> = spec
        .answers
        .iter()
        .map(|a| (a.number, a.summary.as_str(), a.verdict.as_str()))
        .collect();
    assert_eq!(
        answers,
        [
            (1, "French phrases", "declined"),
            (3, "a note (with brackets)", "done")
        ]
    );
}

/// US6 2 and review focus 3, 4, and 8: the `## Decisions` items are listed, once each, and only
/// when they link into the decisions folder; the "Relied on" table's links are not.
#[test]
fn the_decisions_items_are_listed_and_the_table_is_not() {
    let (_, items, _) = example("spec.md");
    let listed: Vec<(String, String, String)> = items
        .spec
        .unwrap()
        .decisions
        .into_iter()
        .map(|d| (d.kind, d.name, d.title))
        .collect();
    let row = |kind: &str, name: &str, title: &str| (kind.into(), name.into(), title.into());
    assert_eq!(
        listed,
        [
            row("new", "repeating-tasks", "Repeating tasks"),
            row("new", "due-dates", "Due dates"),
        ]
    );

    let text = "# Spec: X\n\n## Decisions\n\n\
        - **Changed: [Task storage](../decisions/task-storage.md)**. Clears what it cannot read.\n\
        - **Removed: Task history** (`task-history.md`). Nothing left to govern.\n\
        - **New: [A spec](../2026-10-06-x/spec.md)**. Not a decision.\n\
        - **Changed: [Storage again](../decisions/task-storage.md#rules)**. Listed twice.\n\
        - [Due dates](../decisions/due-dates.md): an old list item.\n\n\
        Relied on:\n\n\
        | Decision | What it means |\n| --- | --- |\n\
        | [Preview](../decisions/preview.md) | stories |\n";
    let (spec, doc) = spec_of(text);
    let listed: Vec<(&str, &str, &str, u32)> = spec
        .decisions
        .iter()
        .map(|d| {
            let line = doc.blocks[d.block as usize].start_line;
            (d.kind.as_str(), d.name.as_str(), d.title.as_str(), line)
        })
        .collect();
    assert_eq!(
        listed,
        [
            ("changed", "task-storage", "Task storage", 5),
            ("removed", "task-history", "Task history", 6),
        ]
    );
}

/// US8 1 to 4: the edge cases' importance, a criterion's measure, the architecture's units and
/// tradeoffs, and the constitution's principles.
#[test]
fn edge_cases_criteria_architecture_and_principles() {
    let (_, items, doc) = example("spec.md");
    let spec = items.spec.unwrap();

    let importance: Vec<&str> = spec.edges.iter().map(|e| e.importance.as_str()).collect();
    assert_eq!(
        importance,
        [
            "high", "high", "normal", "normal", "normal", "niche", "niche"
        ]
    );
    let cells: Vec<String> = doc
        .children(spec.edges[0].row)
        .map(|c| plain(&c.spans))
        .collect();
    assert!(cells[1].contains("not a date"), "{cells:?}");
    assert_eq!(spec.criteria[0].measure.as_deref(), Some("two clicks"));
    assert_eq!(spec.criteria[2].measure.as_deref(), Some("every phrase"));
    let starts = |ids: &[u32]| -> Vec<String> {
        ids.iter()
            .map(|&id| {
                doc.text(id)
                    .split_whitespace()
                    .take(2)
                    .collect::<Vec<_>>()
                    .join(" ")
            })
            .collect()
    };
    assert_eq!(
        starts(&spec.units),
        ["Date helpers", "Repeat rules", "The task", "The edit"]
    );
    assert_eq!(starts(&spec.tradeoffs), ["One task", "Due dates"]);
    let principles: Vec<(&str, bool)> = spec
        .principles
        .iter()
        .map(|p| (p.label.as_str(), p.ok))
        .collect();
    assert_eq!(
        principles,
        [
            ("I. Simple for non-technical users", true),
            ("II. Local first", true),
            ("III. Fast with thousands of tasks", true),
        ]
    );

    let text = "# Spec: X\n\n## Success criteria\n\n- **SC-001**: No measure.\n\n\
        ## Constitution check\n\n| I. One | II. Two |\n| :-: | :-: |\n| ✅ | ⚠️ |\n";
    let (spec, _) = spec_of(text);
    assert_eq!(spec.criteria[0].measure, None);
    let ok: Vec<bool> = spec.principles.iter().map(|p| p.ok).collect();
    assert_eq!(ok, [true, false]);
}

/// US8 and the block: its minutes, and its item starting "You approve".
#[test]
fn the_block_gives_its_minutes_and_what_you_approve() {
    let (_, items, doc) = example("spec.md");
    let spec = items.spec.unwrap();

    assert_eq!(doc.blocks[spec.block.unwrap() as usize].start_line, 11);
    assert_eq!(spec.minutes, None);
    assert!(
        doc.text(spec.approve.unwrap())
            .starts_with("You approve tasks")
    );

    let text = "# Spec: X\n\n> [!IMPORTANT]\n>\n> Spec to review, revision 2, about 10 minutes.\n\
        > You approve nothing here.\n>\n> - Risk first.\n> - You approve it all.\n\n## Decisions\n";
    let (spec, doc) = spec_of(text);
    assert_eq!(spec.minutes, Some(10));
    assert_eq!(doc.text(spec.approve.unwrap()), "You approve it all.");
}

/// US3 3: the mockups are the story and HTML links found in the stories, each with the block a
/// comment on it lands on.
#[test]
fn the_mockups_are_found_in_the_stories() {
    let (_, example, doc) = example("spec.md");
    let mockups = example.spec.unwrap().mockups;

    let stories: Vec<_> = mockups
        .iter()
        .map(|m| {
            let story = m.story.as_ref().unwrap();
            (m.path.as_str(), story.path.as_str(), story.export.as_str())
        })
        .collect();
    let file = "src/tasks/RepeatMenu.stories.tsx";
    assert_eq!(
        stories,
        [
            (file, file, "Open"),
            (file, file, "Completed"),
            (file, file, "Custom")
        ]
    );
    assert_eq!(mockups[0].label, "Repeat menu, open");
    let block = &doc.blocks[mockups[0].block as usize];
    assert_eq!(
        (block.start_line, block.heading.as_deref()),
        (59, Some("US1: Make a task repeat (P1)"))
    );

    let text = "# Spec: X\n\n[Outside](mockups/z.html)\n\n## User stories\n\n### US1: Y (P1)\n\n\
        [**Big** board](./mockups/b.html#top), [data](data.md)\n\n\
        - [Dragging](/packages/web/src/SidebarHandle.stories.tsx#Dragging): the handle held.\n";
    let (spec, _) = spec_of(text);
    let links: Vec<(String, String, bool)> = spec
        .mockups
        .into_iter()
        .map(|m| (m.path, m.label, m.story.is_some()))
        .collect();
    assert_eq!(
        links,
        [
            ("mockups/b.html".into(), "Big board".into(), false),
            (
                "packages/web/src/SidebarHandle.stories.tsx".into(),
                "Dragging".into(),
                true
            ),
        ]
    );
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
    let blocks: Vec<u32> = round
        .settled_groups
        .iter()
        .flat_map(|g| g.blocks.clone())
        .collect();
    assert!(!blocks.is_empty());
    for &id in &blocks {
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

fn round_of(name: &str, text: &str) -> (uraeda_core::files::items::RoundItems, document::Document) {
    let doc = document::parse(text, EXAMPLE);
    let round = items(name, text, &doc).clarifications.unwrap();
    (round, doc)
}

const PARTS: &str = "\
## Context

### Goal

A goal.

### Today

Today.

### Scope

A scope.

### Sources

- The code.
";

#[test]
fn a_later_round_opens_with_what_changed_since_the_last() {
    let text = format!(
        "---\nstatus: awaiting-human\n---\n\n# Clarifications, round 02: Title\n\n{}",
        PARTS.replace(
            "## Context\n",
            "## Context\n\n### Since the last round\n\nQ1 is answered.\n"
        )
    );
    let (round, doc) = round_of("clarifications-02.md", &text);
    let titles: Vec<&str> = round.context.iter().map(|p| p.title.as_str()).collect();
    assert_eq!(
        titles,
        ["Since the last round", "Goal", "Today", "Scope", "Sources"]
    );
    let first: Vec<String> = round.context[0]
        .blocks
        .iter()
        .map(|&b| doc.text(b))
        .collect();
    assert_eq!(first, ["Q1 is answered."]);
}

#[test]
fn the_triage_context_is_one_free_part() {
    let text = "---\nstatus: awaiting-human\n---\n\n# Inbox triage\n\n## Context\n\nThe inbox holds 3 notes.\n\nI read the code.\n";
    let (round, _) = round_of("clarifications-01.md", text);
    assert_eq!(round.context.len(), 1);
    assert_eq!(round.context[0].heading, None);
    assert_eq!(round.context[0].title, "");
    assert_eq!(round.context[0].blocks.len(), 2);
    assert!(round.settled_groups.is_empty());
}

#[test]
fn a_subject_repeated_across_groups_takes_its_comment_on_the_first() {
    let text = format!(
        "---\nstatus: awaiting-human\n---\n\n# Clarifications, round 01: Title\n\n{PARTS}\n\
## Settled without the human\n\n### Check these\n\n- **Same subject** first.\n\n\
### Under the hood\n\n- **Same subject** second.\n- **Other** point.\n\n\
**Notes:**\n\n- **Same subject**: A comment.\n"
    );
    let (round, doc) = round_of("clarifications-01.md", &text);
    let kinds: Vec<&str> = round
        .settled_groups
        .iter()
        .map(|g| g.kind.as_str())
        .collect();
    assert_eq!(kinds, ["check", "hood"]);
    let first = round.settled_groups[0].blocks[0];
    let point = doc.children(first).next().unwrap().id;
    assert_eq!(round.settled_comments.len(), 1);
    assert_eq!(round.settled_comments[0].point, point);
    assert_eq!(round.settled_points[0].block, point);
}

#[test]
fn a_quoted_heading_starts_no_part_nor_group() {
    let text = format!(
        "---\nstatus: awaiting-human\n---\n\n# Clarifications, round 01: Title\n\n{}\n\
## Settled without the human\n\n### Behaviour\n\n- **First** point.\n\n\
> ### Under the hood\n>\n> A quoted source.\n\n- **Second** point.\n",
        PARTS.replace(
            "A scope.\n",
            "A scope.\n\n> ### Scope\n>\n> A quoted scope.\n"
        )
    );
    let (round, _) = round_of("clarifications-01.md", &text);
    let titles: Vec<&str> = round.context.iter().map(|p| p.title.as_str()).collect();
    assert_eq!(titles, ["Goal", "Today", "Scope", "Sources"]);
    assert_eq!(round.context[2].blocks.len(), 2);
    let kinds: Vec<&str> = round
        .settled_groups
        .iter()
        .map(|g| g.kind.as_str())
        .collect();
    assert_eq!(kinds, ["behaviour"]);
    let points: Vec<&str> = round
        .settled_points
        .iter()
        .map(|p| p.subject.as_str())
        .collect();
    assert_eq!(points, ["First", "Second"]);
    assert_eq!(round.settled_groups[0].blocks.len(), 3);
}
