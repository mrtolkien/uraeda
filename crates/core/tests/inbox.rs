use uraeda_core::files::document::hash;
use uraeda_core::files::inbox::{self, NoteChange};

/// The spec's Data example.
const DATA: &str = "# Inbox\n\n- We'll need a model selector for each step\n\n## UI\n\n- [run-ui] In failures the `x` is not centered in the circle\n- [agent] [session-view] Opening a session with 2,000 messages takes 4 s\n- [The spec page's headings are body-sized](drafts/the-spec-pages-headings-are-body-sized/proposal.md)\n\n## CLI\n\n- Allow no selection in responses (after a warning)\n";

/// A note as `parse` gives it, in short: its category, text, marks, link, and lines.
type Row<'a> = (
    Option<&'a str>,
    &'a str,
    bool,
    Option<&'a str>,
    Option<&'a str>,
    (usize, usize),
);

/// Texts and the notes `parse` finds in them.
const PARSE: [(&str, &[Row<'static>]); 8] = [
    (
        DATA,
        &[
            (
                None,
                "We'll need a model selector for each step",
                false,
                None,
                None,
                (3, 3),
            ),
            (
                Some("UI"),
                "In failures the x is not centered in the circle",
                false,
                Some("run-ui"),
                None,
                (7, 7),
            ),
            (
                Some("UI"),
                "Opening a session with 2,000 messages takes 4 s",
                true,
                Some("session-view"),
                None,
                (8, 8),
            ),
            (
                Some("UI"),
                "The spec page's headings are body-sized",
                false,
                None,
                Some("drafts/the-spec-pages-headings-are-body-sized/proposal.md"),
                (9, 9),
            ),
            (
                Some("CLI"),
                "Allow no selection in responses (after a warning)",
                false,
                None,
                None,
                (13, 13),
            ),
        ],
    ),
    (
        "# Inbox\n\n- [café] x\n",
        &[(None, "[café] x", false, None, None, (3, 3))],
    ),
    (
        "# Inbox\n\n- [!] text\n",
        &[(None, "[!] text", false, None, None, (3, 3))],
    ),
    (
        "# Inbox\n\n- A note\n  - with a sub-bullet\n- Next\n",
        &[
            (None, "A note", false, None, None, (3, 4)),
            (None, "Next", false, None, None, (5, 5)),
        ],
    ),
    (
        "# Inbox\n\n```md\n- not a note\n## Not a category\n```\n\n- A note\n",
        &[(None, "A note", false, None, None, (8, 8))],
    ),
    (
        "# Inbox\n\n## UI\n\n- [Blurry](drafts/x/proposal.md)\n- See [this](drafts/y.md) too\n",
        &[
            (
                Some("UI"),
                "Blurry",
                false,
                None,
                Some("drafts/x/proposal.md"),
                (5, 5),
            ),
            (Some("UI"), "See this too", false, None, None, (6, 6)),
        ],
    ),
    (
        "# Inbox\n\n## UI\n\n- Icons\n\n### aside\n\n- Under the aside\n",
        &[
            (Some("UI"), "Icons", false, None, None, (5, 5)),
            (Some("UI"), "Under the aside", false, None, None, (9, 9)),
        ],
    ),
    (
        "# Inbox\n\n- [Agent] [run_ui] Not marks\n- [agent]\n",
        &[
            (
                None,
                "[Agent] [run_ui] Not marks",
                false,
                None,
                None,
                (3, 3),
            ),
            (None, "[agent]", false, None, None, (4, 4)),
        ],
    ),
];

#[test]
fn parse() {
    for (text, expected) in PARSE {
        let notes = inbox::parse(text);
        let rows: Vec<Row> = notes
            .iter()
            .map(|n| {
                let lines = (n.line, n.end);
                let (category, about) = (n.category.as_deref(), n.about.as_deref());
                (
                    category,
                    n.text.as_str(),
                    n.agent,
                    about,
                    n.link.as_deref(),
                    lines,
                )
            })
            .collect();
        let expected: &[Row] = expected;
        assert_eq!(rows, expected, "{text}");
    }
}

#[test]
fn notes_have_ids_in_file_order_and_unique_keys() {
    let notes = inbox::parse("# Inbox\n\n- Same\n\n## UI\n\n- Same\n- Other\n");

    let ids: Vec<&str> = notes.iter().map(|n| n.id.as_str()).collect();
    let keys: Vec<&str> = notes.iter().map(|n| n.key.as_str()).collect();
    assert_eq!(ids, ["note-1", "note-2", "note-3"]);
    assert_eq!(keys, ["same", "same-2", "other"]);
}

/// The web UI's `/inbox/triage` is the triage's address: no note takes it as its key.
#[test]
fn no_note_is_keyed_triage() {
    let notes = inbox::parse("# Inbox\n\n- Triage\n- Triage\n");

    let keys: Vec<&str> = notes.iter().map(|n| n.key.as_str()).collect();
    assert_eq!(keys, ["triage-2", "triage-3"]);
}

#[test]
fn a_note_line_has_its_marks_in_order() {
    assert_eq!(
        inbox::note_line(true, Some("run-ui"), "Slow\npage"),
        "- [agent] [run-ui] Slow page"
    );
    assert_eq!(inbox::note_line(false, None, "Plain"), "- Plain");
}

#[test]
fn read_groups_notes_with_no_category_first_and_hides_empty_categories() {
    let text = "# Inbox\n\n- First\n\n## Empty\n\n## UI\n\n- [agent] [run-ui] Icons\n  - blurry\n\n## CLI\n\n- [Draft](drafts/x.md)\n";

    let read = inbox::read(text);

    assert_eq!(read.hash, hash(text));
    assert_eq!(read.count, 3);
    assert_eq!(read.changes, 0);
    assert_eq!(read.triage, None);
    assert_eq!(read.names, ["Empty", "UI", "CLI"]);
    let names: Vec<Option<&str>> = read.categories.iter().map(|c| c.name.as_deref()).collect();
    assert_eq!(names, [None, Some("UI"), Some("CLI")]);
    let icons = &read.categories[1].notes[0];
    assert_eq!(icons.id, "note-2");
    assert_eq!(icons.key, "icons");
    assert_eq!(icons.text, "Icons");
    assert!(icons.agent);
    assert_eq!(icons.about.as_deref(), Some("run-ui"));
    assert_eq!((icons.start_line, icons.end_line), (9, 10));
    assert_eq!(icons.lines, ["- [agent] [run-ui] Icons", "  - blurry"]);
    assert_eq!(icons.spans[0].text, "Icons");
    let draft = &read.categories[2].notes[0];
    assert_eq!(draft.draft.as_deref(), Some("specs/drafts/x.md"));
    assert_eq!(draft.text, "[Draft](drafts/x.md)");
}

#[test]
fn category_names_include_empty_and_repeated_ones() {
    let text = "# Inbox\n\n## UI\n\n- a\n\n## Empty\n\n## UI\n\n- b\n";

    assert_eq!(inbox::category_names(text), ["UI", "Empty", "UI"]);
    // Review focus 6: edits add to the first.
    assert_eq!(
        inbox::add(text, Some("UI"), "- note").0,
        "# Inbox\n\n## UI\n\n- a\n- note\n\n## Empty\n\n## UI\n\n- b\n"
    );
    let moved = inbox::move_to(text, "note-2", Some("UI")).unwrap();
    assert_eq!(
        moved,
        "# Inbox\n\n## UI\n\n- a\n- b\n\n## Empty\n\n## UI\n\n"
    );
}

#[test]
fn add() {
    let text = "# Inbox\n\n## UI\n\n- a\n";
    let cases = [
        (text, None, "# Inbox\n\n- note\n\n## UI\n\n- a\n"),
        (text, Some("UI"), "# Inbox\n\n## UI\n\n- a\n- note\n"),
        (
            text,
            Some("Editor"),
            "# Inbox\n\n## UI\n\n- a\n\n## Editor\n\n- note\n",
        ),
        ("", None, "# Inbox\n\n- note\n"),
        // A file without a title gets one, so the note is a note.
        ("- a\n", None, "# Inbox\n\n- a\n- note\n"),
        (
            "## UI\n\n- a\n",
            None,
            "# Inbox\n\n- note\n\n## UI\n\n- a\n",
        ),
        ("", Some("UI"), "# Inbox\n\n## UI\n\n- note\n"),
        ("# Inbox\n", None, "# Inbox\n\n- note\n"),
        (
            "# Inbox\n\n- a\n\n## UI\n",
            None,
            "# Inbox\n\n- a\n- note\n\n## UI\n",
        ),
        // The file keeps its last line ending.
        (
            "# Inbox\n\n## UI\n",
            Some("UI"),
            "# Inbox\n\n## UI\n\n- note\n",
        ),
        (
            "# Inbox\n\n## UI\n\n## CLI\n",
            Some("UI"),
            "# Inbox\n\n## UI\n\n- note\n\n## CLI\n",
        ),
        (
            "# Inbox\r\n\r\n## UI\r\n",
            Some("UI"),
            "# Inbox\r\n\r\n## UI\r\n\r\n- note\r\n",
        ),
    ];
    for (before, category, after) in cases {
        let (text, line) = inbox::add(before, category, "- note");
        // The line given is the note's, whatever the add wrote before it.
        assert_eq!(
            text.lines().nth(line as usize - 1),
            Some("- note"),
            "{before:?} {category:?}"
        );
        assert_eq!(text, after, "{before:?} {category:?}");
        let notes = inbox::parse(after);
        assert!(notes.iter().any(|n| n.text == "note"), "{after:?}");
    }
}

/// SC-004: edits change only the note's lines, with paragraphs, other headings, and Windows line
/// endings around them.
#[test]
fn edits_keep_every_other_line() {
    let text = "# Inbox\r\n\r\nWrite notes here.\r\n\r\n- First\r\n- [agent] [run-ui] Second\r\n  - sub\r\n\r\n## UI\r\n\r\nA paragraph about the UI.\r\n\r\n- Icons\r\n\r\n### aside\r\n\r\n- Under the aside\r\n\r\n## CLI\r\n\r\n- Commands\r\n";

    let edited = inbox::edit(text, "note-2", "Second, edited").unwrap();
    assert_eq!(
        edited,
        text.replace(
            "- [agent] [run-ui] Second\r\n",
            "- [agent] [run-ui] Second, edited\r\n"
        )
    );
    let removed = inbox::remove(text, "note-2").unwrap();
    assert_eq!(
        removed,
        text.replace("- [agent] [run-ui] Second\r\n  - sub\r\n", "")
    );
    let moved = inbox::move_to(text, "note-1", Some("CLI")).unwrap();
    assert_eq!(
        moved,
        text.replace("- First\r\n", "")
            .replace("- Commands\r\n", "- Commands\r\n- First\r\n")
    );
    let to_ui = inbox::move_to(text, "note-5", Some("UI")).unwrap();
    assert_eq!(
        to_ui,
        text.replace("\r\n\r\n- Commands\r\n", "\r\n\r\n").replace(
            "- Under the aside\r\n",
            "- Under the aside\r\n- Commands\r\n"
        )
    );
    let back = inbox::move_to(text, "note-3", None).unwrap();
    assert_eq!(
        back,
        text.replace("- Icons\r\n", "")
            .replace("  - sub\r\n", "  - sub\r\n- Icons\r\n")
    );
    assert_eq!(inbox::edit(text, "note-9", "x"), None);
    assert_eq!(inbox::edit(text, "note-1", "  "), None);
    assert_eq!(inbox::remove(text, "note-9"), None);
    assert_eq!(inbox::move_to(text, "note-9", None), None);
}

#[test]
fn a_removed_note_is_inserted_back_byte_for_byte() {
    let text = "# Inbox\n\n- a\n\n## UI\n\n- b\n- c\n  - sub\n- d\n";

    let lines = inbox::note_lines(text, "note-3").unwrap();
    assert_eq!(lines, ["- c", "  - sub"]);
    let removed = inbox::remove(text, "note-3").unwrap();
    assert_eq!(
        inbox::insert(&removed, Some("UI"), 1, &lines).unwrap(),
        text
    );
    let first = inbox::remove(text, "note-1").unwrap();
    assert_eq!(
        inbox::insert(&first, None, 0, &["- a".into()]).unwrap(),
        text
    );
    let last = inbox::remove(text, "note-4").unwrap();
    assert_eq!(
        inbox::insert(&last, Some("UI"), 9, &["- d".into()]).unwrap(),
        text
    );
    assert_eq!(inbox::insert(text, None, 0, &[]), None);
    assert_eq!(inbox::note_lines(text, "note-9"), None);
}

#[test]
fn diff() {
    let before = "# Inbox\n\n- Specs are still way too long and hard to read\n- Home icon\n\n## UI\n\n- Blurry icons\n";
    let ui = |s: &str| Some(s.to_string());
    let cases: [(&str, Vec<NoteChange>); 5] = [
        (
            "# Inbox\n\n- Specs are still way too long and hard to read\n- Home icon\n- New one\n\n## UI\n\n- Blurry icons\n",
            vec![NoteChange::Added {
                category: None,
                text: "New one".into(),
            }],
        ),
        (
            "# Inbox\n\n- Specs are still way too long and hard to read\n\n## UI\n\n- Blurry icons\n",
            vec![NoteChange::Removed {
                category: None,
                text: "Home icon".into(),
            }],
        ),
        (
            "# Inbox\n\n- Specs are still way too long and hard to read\n\n## UI\n\n- Blurry icons\n- Home icon\n",
            vec![NoteChange::Moved {
                from: None,
                to: ui("UI"),
                text: "Home icon".into(),
            }],
        ),
        (
            "# Inbox\n\n- Specs are too long\n- Home icon\n\n## UI\n\n- Blurry icons\n",
            vec![NoteChange::Edited {
                category: None,
                before: "Specs are still way too long and hard to read".into(),
                after: "Specs are too long".into(),
            }],
        ),
        // Review focus 4: an edit, then a move, is two changes, named with their own texts.
        (
            "# Inbox\n\n- Home icon\n\n## UI\n\n- Blurry icons\n- Specs are too long\n",
            vec![
                NoteChange::Removed {
                    category: None,
                    text: "Specs are still way too long and hard to read".into(),
                },
                NoteChange::Added {
                    category: ui("UI"),
                    text: "Specs are too long".into(),
                },
            ],
        ),
    ];
    for (after, expected) in cases {
        assert_eq!(inbox::diff(before, after), expected, "{after}");
    }
    assert_eq!(inbox::diff(before, before), []);
    // A removal and an unrelated addition elsewhere stay two changes.
    let two = "# Inbox\n\n- Specs are still way too long and hard to read\n\n## UI\n\n- Blurry icons\n- Dark mode\n";
    assert_eq!(inbox::diff(before, two).len(), 2);
}

/// R10: a note deleted and a similar one added elsewhere are not a move.
#[test]
fn a_deletion_and_a_similar_addition_are_two_changes() {
    let before =
        "# Inbox\n\n## UI\n\n- Icons are blurry on retina screens\n- Text input feels laggy\n";
    let after = "# Inbox\n\n## UI\n\n- Text input feels laggy\n- Icons are blurry on the sidebar\n";

    let ui = Some("UI".to_string());
    assert_eq!(
        inbox::diff(before, after),
        [
            NoteChange::Removed {
                category: ui.clone(),
                text: "Icons are blurry on retina screens".into(),
            },
            NoteChange::Added {
                category: ui,
                text: "Icons are blurry on the sidebar".into(),
            },
        ]
    );
}

/// A fence indented under a note, with a blank line in it, does not hide what follows.
#[test]
fn indented_fences_do_not_hide_later_notes() {
    let text = "# Inbox\n\n- a note\n  ```\n  x\n\n  y\n  ```\n- next\n\n## UI\n\n- b\n";

    let notes: Vec<(Option<String>, String)> = inbox::parse(text)
        .into_iter()
        .map(|n| (n.category, n.text))
        .filter(|(_, t)| !t.starts_with("a note"))
        .collect();
    assert_eq!(
        notes,
        [
            (None, "next".to_string()),
            (Some("UI".to_string()), "b".to_string())
        ]
    );
    assert_eq!(inbox::category_names(text), ["UI"]);
}

/// A category's name is its heading's text, without the closing hashes CommonMark allows.
#[test]
fn closing_hashes_are_not_part_of_a_category() {
    let rows = [
        ("## UI ##", "UI"),
        ("## UI ##  ", "UI"),
        ("## UI#", "UI#"),
        ("## C# ##", "C#"),
        ("## ##", ""),
        ("##", ""),
    ];
    for (heading, name) in rows {
        let text = format!("# Inbox\n\n{heading}\n\n- a\n");

        assert_eq!(inbox::category_names(&text), [name], "{heading:?}");
        assert_eq!(
            inbox::parse(&text)[0].category.as_deref(),
            Some(name),
            "{heading:?}"
        );
    }
    let text = "# Inbox\n\n## UI ##\n\n- a\n";
    assert_eq!(
        inbox::add(text, Some("UI"), "- note").0,
        "# Inbox\n\n## UI ##\n\n- a\n- note\n"
    );
}
