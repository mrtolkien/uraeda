mod common;

use common::repository_file;
use uraeda_core::files::clarifications::{self, Applicability};
use uraeda_core::files::frontmatter::{self, FrontmatterError, Value};
use uraeda_core::files::markdown::{self, CalloutKind, Document};
use uraeda_core::files::review::{self, Anchor, Verdict};
use uraeda_core::files::{plan, priorities};

/// The fields a frontmatter parses to, or its error.
type Parsed<'a> = Result<&'a [(&'a str, Value)], FrontmatterError>;

#[test]
fn frontmatter_cases() {
    let cases: &[(&str, Parsed<'_>)] = &[
        (
            "---\nstatus: answered\nrevision: 2\nplan-review: false\n---\n# T\n",
            Ok(&[
                ("plan-review", Value::Bool(false)),
                ("revision", Value::Integer(2)),
                ("status", Value::Text("answered".into())),
            ]),
        ),
        (
            "---\r\nstatus: answered\r\n---\r\n# T\r\n",
            Ok(&[("status", Value::Text("answered".into()))]),
        ),
        ("---\n---\n# T\n", Ok(&[])),
        ("# T\n", Err(FrontmatterError::Missing)),
        ("---\nstatus: a\n# T\n", Err(FrontmatterError::Unclosed)),
        (
            "---\nstatus: [a\n---\n",
            Err(FrontmatterError::Yaml(
                "line 1 column 9: unclosed bracket '['".into(),
            )),
        ),
    ];
    for (text, expected) in cases {
        let parsed = frontmatter::parse(text).map(|front| front.fields);
        let expected = expected.clone().map(|fields| {
            fields
                .iter()
                .map(|(key, value)| (key.to_string(), value.clone()))
                .collect::<Vec<_>>()
        });
        assert_eq!(parsed, expected, "{text:?}");
    }
}

#[test]
fn frontmatter_field_lines() {
    let front = frontmatter::parse("---\nstatus: done\nrevision: 1\n---\n").unwrap();

    assert_eq!(front.line("status"), Some(2));
    assert_eq!(front.line("revision"), Some(3));
    assert_eq!(front.end_line, 4);
}

#[test]
fn frontmatter_set_keeps_every_other_byte() {
    let cases = [
        (
            "---\nstatus: awaiting-human\nrevision: 1\n---\n# T\n",
            "status",
            "answered",
            "---\nstatus: answered\nrevision: 1\n---\n# T\n",
        ),
        (
            "---\nstatus: approved # set by the human\n---\n",
            "risk-tier",
            "medium",
            "---\nstatus: approved # set by the human\nrisk-tier: medium\n---\n",
        ),
        (
            "---\r\nstatus: awaiting-human\r\n---\r\n# T\r\n",
            "status",
            "answered",
            "---\r\nstatus: answered\r\n---\r\n# T\r\n",
        ),
    ];
    for (text, key, value, expected) in cases {
        assert_eq!(frontmatter::set(text, key, value), expected, "{text:?}");
    }
}

#[test]
fn headings_links_and_lines() {
    let text = "---\nstatus: x\n---\n\n# Title\n\nSee [d](discovery-01.md#git-backend) and [[due-dates]].\n\n## Q6: How does `ura` run git?\n\n```md\n# not a heading\n[not](a-link.md)\n```\n";

    let document = Document::parse(text);

    let headings: Vec<_> = document
        .headings
        .iter()
        .map(|h| (h.level, h.text.as_str(), h.line))
        .collect();
    assert_eq!(
        headings,
        [(1, "Title", 5), (2, "Q6: How does ura run git?", 9)]
    );
    let links: Vec<_> = document
        .links
        .iter()
        .map(|l| (l.target.as_str(), l.wiki, l.line))
        .collect();
    assert_eq!(
        links,
        [
            ("discovery-01.md#git-backend", false, 7),
            ("due-dates", true, 7)
        ]
    );
    assert_eq!(document.line_count, 14);
}

#[test]
fn slugs_follow_github() {
    let cases = [
        ("Q6: How does ura run git?", "q6-how-does-ura-run-git"),
        (
            "US8: Start a drafted feature (P2)",
            "us8-start-a-drafted-feature-p2",
        ),
        (
            "Shift+Enter and the kitty keyboard protocol",
            "shiftenter-and-the-kitty-keyboard-protocol",
        ),
        ("The human's setup", "the-humans-setup"),
        ("`ura draft` and the start", "ura-draft-and-the-start"),
    ];
    for (heading, slug) in cases {
        assert_eq!(markdown::slug(heading), slug);
    }
}

#[test]
fn anchors_number_duplicates() {
    let document = Document::parse("# A\n\n## Same\n\n## Same\n");

    let anchors = document.anchors();

    assert!(anchors.contains("same") && anchors.contains("same-1"));
}

#[test]
fn reads_the_callout_after_the_title() {
    let text = repository_file("specs/2026-10-10-cli-core/clarifications-01.md");

    let callout = Document::parse(&text).callout.unwrap();

    assert_eq!(callout.kind, CalloutKind::Note);
    assert_eq!(callout.first_line, "Answered on 2026-10-11.");
}

#[test]
fn record_block_turns_important_into_a_note() {
    let text = "# Clarifications\n\n> [!IMPORTANT]\n>\n> 16 questions on the CLI, about 50\n> minutes.\n>\n> - Scope comes first.\n\n## Context\n";

    let recorded = markdown::record_block(text, "Answered on 2026-10-11.").unwrap();

    assert_eq!(
        recorded,
        "# Clarifications\n\n> [!NOTE]\n>\n> Answered on 2026-10-11.\n>\n> - Scope comes first.\n\n## Context\n"
    );
}

#[test]
fn record_block_needs_an_important_block() {
    assert!(markdown::record_block("# T\n\n> [!NOTE]\n>\n> Done.\n", "x").is_none());
}

const QUESTIONS: &str = "---\nstatus: awaiting-human\n---\n\n# Clarifications\n\n## Q1: First?\n\n- **A (recommended). One.**\n  - [pro] p\n- **B. Two.**\n- **C. Three.**\n\n**Answer:** B, we'll do it later\n\n### Q1.B: Follow?\n\nOnly if you picked B in Q1.\n\n- **A (recommended). Yes.**\n- **B. No.**\n\n**Answer:**\n\n## Q2: Second?\n\n- **A (recommended). One.**\n- **B. Two.**\n\n**Answer:**\n\n## Settled without the human\n\n- **Point** settled.\n\n**Notes:**\n";

#[test]
fn parses_questions_options_and_answers() {
    let questions = clarifications::parse(QUESTIONS);

    let summary: Vec<_> = questions
        .iter()
        .map(|q| {
            (
                q.id.as_str(),
                q.options.iter().collect::<String>(),
                q.answer.as_str(),
                q.answer_line,
            )
        })
        .collect();
    assert_eq!(
        summary,
        [
            ("Q1", "ABC".into(), "B, we'll do it later", 14),
            ("Q1.B", "AB".into(), "", 23),
            ("Q2", "AB".into(), "", 30),
        ]
    );
    assert_eq!(questions[1].parent.as_deref(), Some("Q1"));
    assert_eq!(questions[1].letter, Some('B'));
}

#[test]
fn follow_up_applicability() {
    let cases = [
        ("C, we want a simple feature", Applicability::No),
        ("B and C: we need weekdays", Applicability::Yes),
        ("A, B", Applicability::Yes),
        ("B", Applicability::Yes),
        ("We'll see", Applicability::Unclear),
        ("I think A", Applicability::Unclear),
        ("", Applicability::Unclear),
    ];
    for (parent_answer, expected) in cases {
        let text = QUESTIONS.replace("B, we'll do it later", parent_answer);
        let questions = clarifications::parse(&text);

        assert_eq!(
            questions[1].applies(&questions),
            expected,
            "{parent_answer:?}"
        );
    }
}

#[test]
fn set_answer_writes_after_the_answer_marker() {
    let answered = clarifications::set_answer(QUESTIONS, "Q2", "A, simpler.\n\nAnd more.").unwrap();

    assert!(
        answered.contains("**Answer:** A, simpler.\n\nAnd more.\n\n## Settled without the human"),
        "{answered}"
    );
    let again = clarifications::set_answer(&answered, "Q2", "B").unwrap();
    assert!(again.contains("**Answer:** B\n\n## Settled"), "{again}");
}

#[test]
fn set_answer_writes_notes() {
    let noted = clarifications::set_answer(QUESTIONS, "notes", "Keep .gitkeep out").unwrap();

    assert!(noted.ends_with("**Notes:** Keep .gitkeep out\n"), "{noted}");
    assert_eq!(
        clarifications::notes(&noted),
        Some((36, "Keep .gitkeep out".to_string()))
    );
}

#[test]
fn set_answer_refuses_markdown_structure() {
    for answer in ["# Heading", "fine\n**Answer:** sneaky"] {
        let error = clarifications::set_answer(QUESTIONS, "Q2", answer)
            .err()
            .unwrap();

        assert_eq!(
            error.to_string(),
            "an answer line cannot start with \"#\" or \"**Answer:**\""
        );
    }
}

#[test]
fn set_answer_keeps_windows_line_endings() {
    let text = QUESTIONS.replace('\n', "\r\n");

    let answered = clarifications::set_answer(&text, "Q2", "A").unwrap();

    assert!(answered.contains("**Answer:** A\r\n\r\n## Settled"));
    assert!(!answered.replace("\r\n", "").contains('\n'));
}

#[test]
fn unknown_question() {
    let error = clarifications::set_answer(QUESTIONS, "Q9", "A")
        .err()
        .unwrap();

    assert_eq!(error.to_string(), "no question Q9");
}

#[test]
fn plan_tasks_count_checkboxes() {
    let text =
        repository_file("skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/plan.md");

    let tasks = plan::tasks(&text);

    assert!(tasks.len() >= 3);
    assert_eq!(tasks[0].number, 1);
    assert!(
        tasks
            .iter()
            .all(|task| task.total > 0 && task.done == task.total)
    );
}

#[test]
fn plan_first_unchecked_task() {
    let text = "# Plan\n\n## Task 1: One\n\n- [x] **Step 1**\n\n## Task 2: Two\n\n- [x] **Step 1**\n- [ ] **Step 2**\n";

    let tasks = plan::tasks(text);

    assert_eq!(
        tasks.iter().map(|t| (t.done, t.total)).collect::<Vec<_>>(),
        [(1, 1), (1, 2)]
    );
    assert_eq!(tasks[1].title, "Two");
}

const REVIEW: &str = "---\nverdict: changes-requested\ncommit: a1b2c3d\n---\n\n# Review: Spec, CLI core features\n\nName things.\n\n## C1: Lines 50–52, under \"US2: Edit a repeat (P1)\"\n\n> first line\n> second line\n> third line\n\nName the field.\n\n## C2: General\n\nShorter.\n";

#[test]
fn review_files_round_trip() {
    let parsed = review::parse(REVIEW).unwrap();

    assert_eq!(parsed.verdict, Verdict::ChangesRequested);
    assert_eq!(parsed.commit, "a1b2c3d");
    assert_eq!(parsed.summary.as_deref(), Some("Name things."));
    assert_eq!(
        parsed.comments[0].anchor,
        Anchor::Lines(50, 52, "US2: Edit a repeat (P1)".into())
    );
    assert_eq!(
        parsed.comments[0].quote,
        ["first line", "second line", "third line"]
    );
    assert_eq!(parsed.comments[0].text, "Name the field.");
    assert_eq!(parsed.comments[1].anchor, Anchor::General);
    assert_eq!(
        review::render(&parsed, "Review: Spec, CLI core features"),
        REVIEW
    );
}

#[test]
fn review_single_line_anchor() {
    let text = REVIEW.replace("Lines 50–52", "Line 50");

    let parsed = review::parse(&text).unwrap();

    assert_eq!(
        parsed.comments[0].anchor,
        Anchor::Lines(50, 50, "US2: Edit a repeat (P1)".into())
    );
}

#[test]
fn priorities_entries_of_a_real_file() {
    let text = repository_file("fixtures/PRIORITIES.md");

    let entries = priorities::parse(&text);

    let first = &entries[0];
    assert_eq!(first.section, priorities::Section::Now);
    assert_eq!(first.position, 1);
    assert_eq!(first.text, "CLI for basic setup and upkeep");
    assert_eq!(
        first.link.as_deref(),
        Some("/specs/2026-10-10-cli-core/proposal.md")
    );
}

const PRIORITIES: &str = "# Priorities\n\n## Now\n\n- [CLI](/specs/2026-10-10-cli/proposal.md)\n- Web UI, see\n  [draft](drafts/web-ui.md)\n\n## Next\n\n- Git listener process\n  - with a sub-item\n- Runner\n\n## Later\n\n## Blocked\n";

#[test]
fn priorities_entries_with_continuations_and_sub_items() {
    let entries = priorities::parse(PRIORITIES);

    let summary: Vec<_> = entries
        .iter()
        .map(|e| {
            (
                e.section,
                e.position,
                e.text.as_str(),
                e.link.as_deref(),
                e.line,
            )
        })
        .collect();
    use priorities::Section::{Next, Now};
    assert_eq!(
        summary,
        [
            (Now, 1, "CLI", Some("/specs/2026-10-10-cli/proposal.md"), 5),
            (Now, 2, "Web UI, see draft", Some("drafts/web-ui.md"), 6),
            (Next, 1, "Git listener process", None, 11),
            (Next, 2, "Runner", None, 13),
        ]
    );
}

#[test]
fn priorities_link_an_entry() {
    let linked = priorities::link(PRIORITIES, 11, "drafts/git-listener-process.md").unwrap();

    assert!(linked.contains(
        "- [Git listener process](drafts/git-listener-process.md)\n  - with a sub-item\n- Runner"
    ));
}

#[test]
fn priorities_move_an_entry_to_the_end_of_now() {
    let moved = priorities::move_to_now(
        PRIORITIES,
        11,
        "Git listener process",
        "/specs/2026-10-11-git-listener-process/proposal.md",
    )
    .unwrap();

    assert!(moved.contains("  [draft](drafts/web-ui.md)\n- [Git listener process](/specs/2026-10-11-git-listener-process/proposal.md)\n\n## Next\n\n- Runner\n"), "{moved}");
}

#[test]
fn priorities_add_to_an_empty_now() {
    let text = "# Priorities\n\n## Now\n\n## Next\n";

    let added = priorities::add_to_now(text, "Slack", "/specs/x/proposal.md");

    assert_eq!(
        added,
        "# Priorities\n\n## Now\n\n- [Slack](/specs/x/proposal.md)\n\n## Next\n"
    );
}

#[test]
fn priorities_follow_numbered_lists() {
    let text = "# Priorities\n\n## Now\n\n1. One\n2. Two\n\n## Next\n";

    let added = priorities::add_to_now(text, "Three", "/specs/x/proposal.md");

    assert!(
        added.contains("2. Two\n3. [Three](/specs/x/proposal.md)\n"),
        "{added}"
    );
}

#[test]
fn a_commit_of_digits_stays_text() {
    let text = REVIEW.replace("commit: a1b2c3d", "commit: 0012345");

    let parsed = review::parse(&text).unwrap();

    assert_eq!(parsed.commit, "0012345");
}
