//! Agents' notes among the places the inbox shows: a move's index, a drop's target, and a
//! category's edits count them as the reader shows them, at the end of their category.

mod common;

use common::repo::TestRepo;
use uraeda_core::api::{self, DropAt};

const INBOX: &str = "specs/INBOX.md";

/// A repository on `main` with the fixture's `INBOX.md`, and three agents' notes committed, `A`,
/// `B`, and `C`, in `category`: shown in that order, after the category's lines.
fn repo_with_agents_notes(category: &str) -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        INBOX,
        &std::fs::read_to_string(common::fixture("repo/main/specs/INBOX.md")).unwrap(),
    );
    for name in ["a", "b", "c"] {
        repo.write(
            &format!("specs/notes/{name}.md"),
            &format!(
                "---\nagent: true\ncategory: {category}\n---\n\n# {}\n",
                name.to_uppercase()
            ),
        );
    }
    repo.commit("chore: agents' notes");
    repo
}

/// The texts of the notes of `category` as `inbox` shows them.
fn shown(inbox: &uraeda_core::files::inbox::Inbox, category: &str) -> Vec<String> {
    inbox
        .categories
        .iter()
        .find(|c| c.name.as_deref() == Some(category))
        .map(|c| c.notes.iter().map(|note| note.text.clone()).collect())
        .unwrap_or_default()
}

/// The id of the note of `text` in `inbox`.
fn id_of(inbox: &uraeda_core::files::inbox::Inbox, text: &str) -> String {
    inbox
        .categories
        .iter()
        .flat_map(|c| &c.notes)
        .find(|note| note.text == text)
        .unwrap()
        .id
        .clone()
}

/// US2 more 3: an agent's note placed among the agents' notes of its category goes where it was
/// dropped, the index counting them as the inbox shows them.
#[test]
fn an_agents_note_placed_among_agents_notes_goes_where_dropped() {
    let repo = repo_with_agents_notes("CLI");
    let read = api::read_inbox(repo.path()).unwrap();

    let placed = api::place_note(
        repo.path(),
        "specs/notes/c.md",
        Some("CLI".into()),
        3,
        &read.hash,
    )
    .unwrap();

    assert_eq!(
        shown(&placed, "CLI"),
        [
            "Allow no selection in responses (after a warning)",
            "Make sure agents are resumable",
            "[A](notes/a.md)",
            "[C](notes/c.md)",
            "[B](notes/b.md)"
        ]
    );
    assert_eq!(api::read_inbox(repo.path()).unwrap().hash, placed.hash);
}

/// US2 more 3, for a line: a note dropped after an agent's note of a category goes there.
#[test]
fn a_note_dropped_after_an_agents_note_goes_there() {
    let repo = repo_with_agents_notes("CLI");
    let read = api::read_inbox(repo.path()).unwrap();
    let id = id_of(&read, "Allow no selection in responses (after a warning)");

    let dropped = api::drop_note(
        repo.path(),
        &id,
        None,
        &DropAt {
            list: Some("CLI".into()),
            index: 3,
            ..DropAt::default()
        },
        &read.hash,
    )
    .unwrap();

    assert_eq!(
        shown(&dropped, "CLI"),
        [
            "Make sure agents are resumable",
            "[A](notes/a.md)",
            "[B](notes/b.md)",
            "Allow no selection in responses (after a warning)",
            "[C](notes/c.md)"
        ]
    );
}

/// US2 more 3: an agent's note dropped where the inbox shows it, after other agents' notes, writes
/// nothing.
#[test]
fn an_agents_note_placed_where_it_shows_after_others_writes_nothing() {
    let repo = repo_with_agents_notes("CLI");
    let read = api::read_inbox(repo.path()).unwrap();

    let placed = api::place_note(
        repo.path(),
        "specs/notes/c.md",
        Some("CLI".into()),
        4,
        &read.hash,
    )
    .unwrap();

    assert_eq!(placed.changes, 0);
    assert_eq!(repo.porcelain(), "");
}

/// US2 more 3, for a drop's target: a note dropped under an agent's note nests under its line,
/// written first, its file still linked.
#[test]
fn a_note_dropped_under_an_agents_note_nests_under_its_line() {
    let repo = repo_with_agents_notes("UI");
    let read = api::read_inbox(repo.path()).unwrap();
    let id = id_of(&read, "Make sure agents are resumable");

    let dropped = api::drop_note(
        repo.path(),
        &id,
        None,
        &DropAt {
            under: Some("specs/notes/a.md".into()),
            index: 0,
            ..DropAt::default()
        },
        &read.hash,
    )
    .unwrap();

    let ui = &dropped
        .categories
        .iter()
        .find(|c| c.name.as_deref() == Some("UI"))
        .unwrap()
        .notes;
    let a = ui
        .iter()
        .find(|note| note.text == "[A](notes/a.md)")
        .unwrap();
    assert_eq!(
        a.lines,
        [
            "- [agent] [A](notes/a.md)",
            "  - Make sure agents are resumable"
        ]
    );
    assert_eq!(a.file.as_deref(), Some("specs/notes/a.md"));
    assert_eq!(
        shown(&dropped, "CLI"),
        ["Allow no selection in responses (after a warning)"]
    );
}

/// The names of the categories `inbox` shows.
fn names(inbox: &uraeda_core::files::inbox::Inbox) -> Vec<String> {
    inbox
        .categories
        .iter()
        .filter_map(|c| c.name.clone())
        .collect()
}

/// US2 more 3, for a category's rename: a category only agents' notes name is renamed, its notes
/// with it.
#[test]
fn a_category_of_agents_notes_alone_is_renamed() {
    let repo = repo_with_agents_notes("Deferred fixes");
    let read = api::read_inbox(repo.path()).unwrap();

    let renamed = api::rename_category(repo.path(), "Deferred fixes", "Later", &read.hash).unwrap();

    assert!(!names(&renamed).contains(&"Deferred fixes".to_string()));
    assert_eq!(
        shown(&renamed, "Later"),
        ["[A](notes/a.md)", "[B](notes/b.md)", "[C](notes/c.md)"]
    );
}

/// US2 more 3, for a category's rename: a category of lines and agents' notes is renamed whole.
#[test]
fn a_mixed_category_is_renamed_whole() {
    let repo = repo_with_agents_notes("CLI");
    let read = api::read_inbox(repo.path()).unwrap();

    let renamed = api::rename_category(repo.path(), "CLI", "Commands", &read.hash).unwrap();

    assert!(!names(&renamed).contains(&"CLI".to_string()));
    assert_eq!(shown(&renamed, "Commands").len(), 5);
}

/// A rename onto a category only agents' notes name is refused, as onto any category shown.
#[test]
fn a_rename_onto_a_category_of_agents_notes_is_refused() {
    let repo = repo_with_agents_notes("Deferred fixes");
    let read = api::read_inbox(repo.path()).unwrap();

    let renamed = api::rename_category(repo.path(), "CLI", "Deferred fixes", &read.hash);

    assert_eq!(
        renamed.unwrap_err().to_string(),
        "A category named Deferred fixes exists."
    );
    assert_eq!(repo.porcelain(), "");
}

/// US2 more 2, for a category's removal: a category of agents' notes removed with its notes deletes
/// their files, and its Undo brings the checkout back as it was.
#[test]
fn a_category_of_agents_notes_removed_and_restored() {
    let repo = repo_with_agents_notes("Deferred fixes");
    let read = api::read_inbox(repo.path()).unwrap();

    let (removed, before) =
        api::remove_category(repo.path(), "Deferred fixes", false, &read.hash).unwrap();

    assert!(!names(&removed).contains(&"Deferred fixes".to_string()));
    assert_eq!(removed.count, read.count - 3);
    assert!(!repo.exists("specs/notes/a.md"));

    let restored = api::restore_category(repo.path(), &before, &removed.hash).unwrap();

    assert_eq!(restored.hash, read.hash);
    assert_eq!(restored.changes, 0);
    assert_eq!(repo.porcelain(), "");
}

/// US2 more 2, for a category's removal keeping its notes: its agents' notes stay, without a
/// category, and its Undo brings the checkout back as it was.
#[test]
fn a_category_of_agents_notes_removed_keeping_them() {
    let repo = repo_with_agents_notes("CLI");
    let read = api::read_inbox(repo.path()).unwrap();

    let (removed, before) = api::remove_category(repo.path(), "CLI", true, &read.hash).unwrap();

    assert!(!names(&removed).contains(&"CLI".to_string()));
    assert_eq!(removed.count, read.count);
    assert!(repo.exists("specs/notes/a.md"));

    api::restore_category(repo.path(), &before, &removed.hash).unwrap();

    assert_eq!(repo.porcelain(), "");
}

/// Edge case "a note file with uncommitted changes stays": a category removed with its notes is
/// refused when one of its agents' notes' files was edited since its commit, and nothing is written.
#[test]
fn a_category_with_an_edited_agents_note_is_not_removed() {
    let repo = repo_with_agents_notes("Deferred fixes");
    let edited = format!(
        "{}\nA line the human typed.\n",
        repo.read("specs/notes/b.md")
    );
    repo.write("specs/notes/b.md", &edited);
    let read = api::read_inbox(repo.path()).unwrap();

    let removed = api::remove_category(repo.path(), "Deferred fixes", false, &read.hash);

    assert_eq!(
        removed.unwrap_err().to_string(),
        "specs/notes/b.md has uncommitted changes: the note was not removed"
    );
    assert_eq!(repo.porcelain(), " M specs/notes/b.md\n");
    assert!(repo.exists("specs/notes/a.md"));
}
