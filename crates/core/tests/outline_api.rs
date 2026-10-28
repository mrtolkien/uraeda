//! The outline writes of the inbox and the priorities through the binding's operations: indent,
//! outdent, and drops on the default branch, over the files as read, and what they refuse.

mod common;

use common::repo::TestRepo;
use uraeda_core::api::{self, DropAt};

const INBOX: &str = "specs/INBOX.md";
const PRIORITIES: &str = "specs/PRIORITIES.md";

/// A repository on `main` with the fixture's `INBOX.md`, `PRIORITIES.md`, and the draft its Next
/// links, `drafts/git-listener.md`.
fn fixture_repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    for path in ["INBOX.md", "PRIORITIES.md", "drafts/git-listener.md"] {
        let text = std::fs::read_to_string(common::fixture(&format!("repo/main/specs/{path}")));
        repo.write(&format!("specs/{path}"), &text.unwrap());
    }
    repo.commit("chore: specs");
    repo
}

/// A drop into a list, a category or a section, at `index`.
fn into(list: Option<&str>, index: u32) -> DropAt {
    DropAt {
        list: list.map(String::from),
        index,
        ..DropAt::default()
    }
}

/// A drop under an item, or with `at` under its nested item, at `index` there.
fn under(item: &str, at: Option<u32>, index: u32) -> DropAt {
    DropAt {
        under: Some(item.to_string()),
        under_at: at,
        index,
        ..DropAt::default()
    }
}

fn inbox_hash(repo: &TestRepo) -> String {
    api::read_inbox(repo.path()).unwrap().hash
}

fn priorities_hash(repo: &TestRepo) -> String {
    api::read_priorities(repo.path()).unwrap().hash
}

#[test]
fn a_note_indents_under_the_note_above_and_outdents_back() {
    let repo = fixture_repo();
    let before = repo.read(INBOX);

    let indented = api::outline_note(
        repo.path(),
        "note-2",
        None,
        "indent",
        None,
        &inbox_hash(&repo),
    )
    .unwrap();

    assert!(repo.read(INBOX).contains(
        "- Specs are still way too long and hard to read\n  - We'll need a model selector for each step\n- We need a home icon\n"
    ));
    let first = &indented.categories[0].notes[0];
    assert_eq!(
        first.children[0].text,
        "We'll need a model selector for each step"
    );
    api::outline_note(
        repo.path(),
        "note-1",
        Some(0),
        "outdent",
        None,
        &indented.hash,
    )
    .unwrap();
    assert_eq!(repo.read(INBOX), before);
}

/// The first note of a category has no note above it in its category to go under.
#[test]
fn the_first_note_of_a_category_does_not_indent() {
    let repo = fixture_repo();

    let error = api::outline_note(
        repo.path(),
        "note-4",
        None,
        "indent",
        None,
        &inbox_hash(&repo),
    )
    .unwrap_err();

    assert_eq!(error.code, "refused");
}

#[test]
fn a_note_dropped_into_a_category_goes_at_its_index() {
    let repo = fixture_repo();

    let inbox = api::drop_note(
        repo.path(),
        "note-3",
        None,
        &into(Some("CLI"), 1),
        &inbox_hash(&repo),
    )
    .unwrap();

    let cli = inbox
        .categories
        .iter()
        .find(|c| c.name.as_deref() == Some("CLI"));
    let texts: Vec<&str> = cli.unwrap().notes.iter().map(|n| n.text.as_str()).collect();
    assert_eq!(
        texts,
        [
            "Allow no selection in responses (after a warning)",
            "We need a home icon",
            "Make sure agents are resumable"
        ]
    );
}

#[test]
fn a_note_dropped_under_a_note_and_under_its_nested_item() {
    let repo = fixture_repo();

    let first = api::drop_note(
        repo.path(),
        "note-10",
        None,
        &under("note-9", None, 0),
        &inbox_hash(&repo),
    )
    .unwrap();
    api::drop_note(
        repo.path(),
        "note-1",
        None,
        &under("note-9", Some(0), 0),
        &first.hash,
    )
    .unwrap();

    assert!(repo.read(INBOX).ends_with(
        "## CLI\n\n- Allow no selection in responses (after a warning)\n  - Make sure agents are resumable\n    - Specs are still way too long and hard to read\n"
    ));
}

/// A note moved with its nested items keeps them under it, and a nested item dropped into a
/// category becomes a note there.
#[test]
fn a_note_moves_with_its_children_and_a_child_becomes_a_note() {
    let repo = fixture_repo();
    let indented = api::outline_note(
        repo.path(),
        "note-2",
        None,
        "indent",
        None,
        &inbox_hash(&repo),
    )
    .unwrap();

    let moved = api::drop_note(
        repo.path(),
        "note-1",
        None,
        &into(Some("CLI"), 0),
        &indented.hash,
    )
    .unwrap();
    assert!(repo.read(INBOX).contains(
        "## CLI\n\n- Specs are still way too long and hard to read\n  - We'll need a model selector for each step\n- Allow no selection"
    ));
    let id = &moved
        .categories
        .iter()
        .find(|c| c.name.as_deref() == Some("CLI"))
        .unwrap()
        .notes[0]
        .id;
    api::drop_note(repo.path(), id, Some(0), &into(None, 0), &moved.hash).unwrap();

    assert!(repo.read(INBOX).starts_with(
        "# Inbox\n\n- We'll need a model selector for each step\n- We need a home icon\n"
    ));
    assert!(repo.read(INBOX).contains(
        "## CLI\n\n- Specs are still way too long and hard to read\n- Allow no selection"
    ));
}

#[test]
fn an_outline_write_over_a_changed_inbox_is_a_conflict() {
    let repo = fixture_repo();
    let hash = inbox_hash(&repo);
    repo.write(INBOX, &format!("{}- Elsewhere\n", repo.read(INBOX)));

    let indent = api::outline_note(repo.path(), "note-2", None, "indent", None, &hash).unwrap_err();
    let drop =
        api::drop_note(repo.path(), "note-3", None, &into(Some("CLI"), 0), &hash).unwrap_err();

    assert_eq!((indent.code, drop.code), ("conflict", "conflict"));
}

/// A drop names one place: under an item, or into a list. Both, an empty item, or a nested item
/// without its item are refused, the file untouched.
#[test]
fn an_ambiguous_note_drop_is_refused() {
    let both = DropAt {
        list: Some("CLI".to_string()),
        ..under("note-1", None, 0)
    };
    let nested_alone = DropAt {
        under_at: Some(0),
        ..into(Some("CLI"), 0)
    };

    for to in [both, under("", None, 0), nested_alone] {
        let repo = fixture_repo();
        let before = repo.read(INBOX);
        let result = api::drop_note(repo.path(), "note-3", None, &to, &inbox_hash(&repo));
        assert_eq!(
            result.map(|_| ()).map_err(|e| e.code),
            Err("refused"),
            "{to:?}"
        );
        assert_eq!(repo.read(INBOX), before);
    }
}

/// A note that links a draft stays a note: nested, its draft would no longer be found by its link.
#[test]
fn a_note_with_a_draft_does_not_nest() {
    let repo = fixture_repo();
    repo.write(
        INBOX,
        "# Inbox\n\n- First\n- [Dark mode](drafts/dark-mode.md)\n",
    );
    let hash = inbox_hash(&repo);

    let indent = api::outline_note(repo.path(), "note-2", None, "indent", None, &hash).unwrap_err();
    let drop = api::drop_note(
        repo.path(),
        "note-2",
        None,
        &under("note-1", None, 0),
        &hash,
    )
    .unwrap_err();

    assert_eq!((indent.code, drop.code), ("refused", "refused"));
    assert_eq!(
        repo.read(INBOX),
        "# Inbox\n\n- First\n- [Dark mode](drafts/dark-mode.md)\n"
    );
}

#[test]
fn a_line_indents_under_the_line_above_and_outdents_back() {
    let repo = fixture_repo();
    let before = repo.read(PRIORITIES);

    let indented = api::outline_priority(
        repo.path(),
        "later-2",
        None,
        "indent",
        None,
        &priorities_hash(&repo),
    )
    .unwrap();

    assert!(repo.read(PRIORITIES).ends_with(
        "- Nix + Docker based execution environments\n  - with a cache\n  - Benchmarks: after the runner is ready\n"
    ));
    api::outline_priority(
        repo.path(),
        "later-1",
        Some(1),
        "outdent",
        None,
        &indented.hash,
    )
    .unwrap();
    assert_eq!(repo.read(PRIORITIES), before);
}

#[test]
fn a_line_moves_with_its_children_to_a_section_and_under_a_nested_item() {
    let repo = fixture_repo();

    let moved = api::drop_priority(
        repo.path(),
        "later-1",
        None,
        &into(Some("next"), 0),
        &priorities_hash(&repo),
    )
    .unwrap();
    assert!(repo.read(PRIORITIES).contains(
        "- Nix + Docker based execution environments\n  - with a cache\n- Claude Code runner (triggered manually)\n"
    ));
    api::drop_priority(
        repo.path(),
        "later-1",
        None,
        &under("next-1", Some(0), 0),
        &moved.hash,
    )
    .unwrap();

    assert!(repo.read(PRIORITIES).contains(
        "- Nix + Docker based execution environments\n  - with a cache\n    - Benchmarks: after the runner is ready\n- Claude Code runner"
    ));
}

#[test]
fn an_outline_write_over_changed_priorities_is_a_conflict() {
    let repo = fixture_repo();
    let hash = priorities_hash(&repo);
    repo.write(
        PRIORITIES,
        &format!("{}- Elsewhere\n", repo.read(PRIORITIES)),
    );

    let indent =
        api::outline_priority(repo.path(), "later-2", None, "indent", None, &hash).unwrap_err();
    let drop =
        api::drop_priority(repo.path(), "later-2", None, &into(Some("now"), 0), &hash).unwrap_err();

    assert_eq!((indent.code, drop.code), ("conflict", "conflict"));
}

#[test]
fn an_ambiguous_line_drop_is_refused() {
    let both = DropAt {
        list: Some("now".to_string()),
        ..under("later-1", None, 0)
    };
    let nested_alone = DropAt {
        under_at: Some(0),
        ..into(Some("now"), 0)
    };

    for to in [both, under("", None, 0), nested_alone, into(None, 0)] {
        let repo = fixture_repo();
        let before = repo.read(PRIORITIES);
        let result = api::drop_priority(repo.path(), "later-2", None, &to, &priorities_hash(&repo));
        assert_eq!(
            result.map(|_| ()).map_err(|e| e.code),
            Err("refused"),
            "{to:?}"
        );
        assert_eq!(repo.read(PRIORITIES), before);
    }
}

/// A line with a draft stays a line: its draft is found by its link, a line's.
#[test]
fn a_line_with_a_draft_does_not_nest() {
    let repo = fixture_repo();
    let before = repo.read(PRIORITIES);
    let hash = priorities_hash(&repo);

    let indent =
        api::outline_priority(repo.path(), "next-2", None, "indent", None, &hash).unwrap_err();
    let drop = api::drop_priority(
        repo.path(),
        "next-2",
        None,
        &under("next-1", None, 0),
        &hash,
    )
    .unwrap_err();

    assert_eq!((indent.code, drop.code), ("refused", "refused"));
    assert_eq!(repo.read(PRIORITIES), before);
}
