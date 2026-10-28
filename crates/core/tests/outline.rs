//! The outlines of `INBOX.md`'s notes and `PRIORITIES.md`'s lines, over their text: nested items
//! edited, indented, outdented, moved among their siblings, and dropped, their own items with them.

use uraeda_core::files::inbox::{self, Drop as NoteDrop};
use uraeda_core::files::nested::OutlineEdit;
use uraeda_core::files::priorities::{self, Drop as LineDrop, Section};

const NOTES: &str =
    "# Inbox\n\n- One\n  - One a\n    - One a i\n  - One b\n- Two\n  - Two a\n- Three\n";

const LINES: &str = "# Priorities\n\n## Now\n\n- Web UI\n  - Pages\n  - Keys\n\n## Next\n\n- Runner\n- Listener\n  - Hooks\n";

fn note_drop(note: &str, at: Option<usize>, index: usize) -> NoteDrop {
    NoteDrop::Under {
        note: note.to_string(),
        at,
        index,
    }
}

#[test]
fn a_nested_item_indents_under_its_sibling_above_and_outdents_after_its_parent() {
    let indented = inbox::outline(NOTES, "note-1", Some(2), &OutlineEdit::Indent).unwrap();
    assert_eq!(
        indented,
        "# Inbox\n\n- One\n  - One a\n    - One a i\n    - One b\n- Two\n  - Two a\n- Three\n"
    );

    let outdented = inbox::outline(&indented, "note-1", Some(2), &OutlineEdit::Outdent).unwrap();
    assert_eq!(outdented, NOTES);
}

/// A note's own item outdented becomes the note after it, its own items with it.
#[test]
fn a_notes_own_item_outdents_to_a_note_with_its_items() {
    let outdented = inbox::outline(NOTES, "note-1", Some(0), &OutlineEdit::Outdent).unwrap();

    assert_eq!(
        outdented,
        "# Inbox\n\n- One\n  - One b\n- One a\n  - One a i\n- Two\n  - Two a\n- Three\n"
    );
}

#[test]
fn a_nested_item_moves_up_and_down_among_its_siblings_only() {
    let down = inbox::outline(NOTES, "note-1", Some(0), &OutlineEdit::Down).unwrap();
    assert_eq!(
        down,
        "# Inbox\n\n- One\n  - One b\n  - One a\n    - One a i\n- Two\n  - Two a\n- Three\n"
    );
    assert_eq!(
        inbox::outline(&down, "note-1", Some(1), &OutlineEdit::Up).unwrap(),
        NOTES
    );

    assert_eq!(
        inbox::outline(NOTES, "note-1", Some(0), &OutlineEdit::Up),
        None
    );
    assert_eq!(
        inbox::outline(NOTES, "note-1", Some(2), &OutlineEdit::Down),
        None
    );
    assert_eq!(
        inbox::outline(NOTES, "note-1", Some(0), &OutlineEdit::Indent),
        None
    );
}

/// A note itself only indents: it has no parent to outdent from, and moves by a drop.
#[test]
fn a_note_neither_outdents_nor_moves_up_or_down() {
    for edit in [OutlineEdit::Outdent, OutlineEdit::Up, OutlineEdit::Down] {
        assert_eq!(
            inbox::outline(NOTES, "note-2", None, &edit),
            None,
            "{edit:?}"
        );
    }
}

/// Code under a note would be lost or moved by a rewrite of its outline: it is never rewritten.
#[test]
fn a_note_with_code_under_it_is_not_rewritten() {
    let text = "# Inbox\n\n- One\n  ```sh\n  ura note\n  ```\n  - One a\n- Two\n";

    assert_eq!(
        inbox::outline(text, "note-1", Some(0), &OutlineEdit::Outdent),
        None
    );
    assert_eq!(
        inbox::outline(text, "note-2", None, &OutlineEdit::Indent),
        None
    );
    assert_eq!(
        inbox::drop_item(text, "note-2", None, &note_drop("note-1", None, 0)),
        None
    );
}

/// A note dropped under a note after it: its own items go with it.
#[test]
fn a_note_drops_under_a_later_note_with_its_items() {
    let dropped = inbox::drop_item(NOTES, "note-1", None, &note_drop("note-3", None, 0)).unwrap();

    assert_eq!(
        dropped,
        "# Inbox\n\n- Two\n  - Two a\n- Three\n  - One\n    - One a\n      - One a i\n    - One b\n"
    );
}

/// A nested item dropped under an earlier note's nested item, at an index among the items there.
#[test]
fn a_nested_item_drops_under_an_earlier_notes_nested_item() {
    let dropped =
        inbox::drop_item(NOTES, "note-2", Some(0), &note_drop("note-1", Some(0), 1)).unwrap();

    assert_eq!(
        dropped,
        "# Inbox\n\n- One\n  - One a\n    - One a i\n    - Two a\n  - One b\n- Two\n- Three\n"
    );
}

/// Within one note, an item dropped under a later sibling: that sibling's place counts once the
/// item left.
#[test]
fn a_nested_item_drops_under_its_later_sibling() {
    let dropped =
        inbox::drop_item(NOTES, "note-1", Some(0), &note_drop("note-1", Some(2), 0)).unwrap();

    assert_eq!(
        dropped,
        "# Inbox\n\n- One\n  - One b\n    - One a\n      - One a i\n- Two\n  - Two a\n- Three\n"
    );
}

#[test]
fn an_item_never_drops_under_itself_or_its_own_items() {
    assert_eq!(
        inbox::drop_item(NOTES, "note-1", None, &note_drop("note-1", None, 0)),
        None
    );
    assert_eq!(
        inbox::drop_item(NOTES, "note-1", Some(0), &note_drop("note-1", Some(1), 0)),
        None
    );
    assert_eq!(
        inbox::drop_item(NOTES, "note-1", Some(0), &note_drop("note-1", Some(0), 0)),
        None
    );
}

#[test]
fn a_drop_past_the_end_or_to_a_missing_note_is_refused() {
    assert_eq!(
        inbox::drop_item(NOTES, "note-3", None, &note_drop("note-2", None, 2)),
        None
    );
    assert_eq!(
        inbox::drop_item(NOTES, "note-3", None, &note_drop("note-9", None, 0)),
        None
    );
    assert_eq!(
        inbox::drop_item(NOTES, "note-9", None, &note_drop("note-1", None, 0)),
        None
    );
}

/// A nested item dropped into a category becomes a note there, its own items with it.
#[test]
fn a_nested_item_drops_into_a_category_as_a_note() {
    let category = NoteDrop::Note {
        category: None,
        index: 0,
    };

    let dropped = inbox::drop_item(NOTES, "note-1", Some(0), &category).unwrap();

    assert_eq!(
        dropped,
        "# Inbox\n\n- One a\n  - One a i\n- One\n  - One b\n- Two\n  - Two a\n- Three\n"
    );
}

#[test]
fn a_line_indents_under_the_line_above_in_its_section_only() {
    let indented = priorities::outline(LINES, "next-2", None, &OutlineEdit::Indent).unwrap();
    assert!(indented.ends_with("## Next\n\n- Runner\n  - Listener\n    - Hooks\n"));

    assert_eq!(
        priorities::outline(LINES, "next-1", None, &OutlineEdit::Indent),
        None
    );
    assert_eq!(
        priorities::outline(LINES, "now-1", None, &OutlineEdit::Outdent),
        None
    );
}

/// A line's own item outdented becomes the line after it, in its section.
#[test]
fn a_lines_own_item_outdents_to_a_line() {
    let outdented = priorities::outline(LINES, "now-1", Some(0), &OutlineEdit::Outdent).unwrap();

    assert!(outdented.contains("## Now\n\n- Web UI\n  - Keys\n- Pages\n\n## Next"));
}

#[test]
fn a_line_drops_into_a_section_and_its_nested_item_becomes_a_line() {
    let to_now = LineDrop::Entry {
        section: Section::Now,
        index: 0,
    };

    let moved = priorities::drop_item(LINES, "next-2", None, &to_now).unwrap();
    assert!(moved.contains("## Now\n\n- Listener\n  - Hooks\n- Web UI\n"));
    assert!(moved.ends_with("## Next\n\n- Runner\n"));

    let lifted = priorities::drop_item(LINES, "now-1", Some(1), &to_now).unwrap();
    assert!(lifted.contains("## Now\n\n- Keys\n- Web UI\n  - Pages\n\n## Next"));
}

/// A line dropped under an earlier line's nested item, its own items with it.
#[test]
fn a_line_drops_under_an_earlier_lines_nested_item() {
    let under = LineDrop::Under {
        entry: "now-1".to_string(),
        at: Some(1),
        index: 0,
    };

    let dropped = priorities::drop_item(LINES, "next-2", None, &under).unwrap();

    assert!(dropped.contains("- Web UI\n  - Pages\n  - Keys\n    - Listener\n      - Hooks\n"));
    assert!(dropped.ends_with("## Next\n\n- Runner\n"));
}
