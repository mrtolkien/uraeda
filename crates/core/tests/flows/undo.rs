//! Editing the inbox, and taking a move back: a note is edited, moved, removed, and put back as it
//! was, and an Undo takes back only what the move wrote, so nothing typed meanwhile is lost.

use uraeda_core::api;
use uraeda_core::files::inbox::{Inbox, InboxNote};

use crate::common::fixture;
use crate::common::repo::TestRepo;

const INBOX: &str = "specs/INBOX.md";
const PRIORITIES: &str = "specs/PRIORITIES.md";
const NOTE: &str = "Draft to proposal on mobile went 404";

fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    for name in ["INBOX.md", "PRIORITIES.md", "drafts/git-listener.md"] {
        let text = std::fs::read_to_string(fixture(&format!("repo/main/specs/{name}"))).unwrap();
        repo.write(&format!("specs/{name}"), &text);
    }
    repo.commit("chore: specs");
    repo
}

/// A note, its category, and its place in it, from 0.
fn find(inbox: &Inbox, text: &str) -> (InboxNote, Option<String>, u32) {
    for category in &inbox.categories {
        if let Some(index) = category.notes.iter().position(|note| note.text == text) {
            return (
                category.notes[index].clone(),
                category.name.clone(),
                index as u32,
            );
        }
    }
    panic!("no note {text}");
}

/// The note that links a draft.
fn by_draft(inbox: &Inbox, draft: &str) -> InboxNote {
    let notes = inbox.categories.iter().flat_map(|category| &category.notes);
    notes
        .into_iter()
        .find(|note| note.draft.as_deref() == Some(draft))
        .expect("a note that links the draft")
        .clone()
}

#[test]
fn a_note_is_edited_removed_and_put_back_byte_for_byte() {
    let repo = repo();
    let before = repo.read(INBOX);
    let inbox = api::read_inbox(repo.path()).unwrap();
    let (note, category, index) = find(&inbox, NOTE);

    let edited = api::edit_note(repo.path(), &note.id, "Reworded", &inbox.hash).unwrap();
    assert!(
        find(&edited, "Reworded").0.text == "Reworded" && repo.read(INBOX).contains("Reworded")
    );
    let back = api::edit_note(
        repo.path(),
        &find(&edited, "Reworded").0.id,
        NOTE,
        &edited.hash,
    )
    .unwrap();
    assert_eq!(repo.read(INBOX), before);

    let removed = api::remove_note(repo.path(), &find(&back, NOTE).0.id, &back.hash).unwrap();
    assert!(!repo.read(INBOX).contains(NOTE));
    api::insert_note(repo.path(), category, index, &note.lines, &removed.hash).unwrap();
    assert_eq!(
        repo.read(INBOX),
        before,
        "an Undo of a removal restores the file"
    );
}

#[test]
fn a_note_moves_between_categories_and_to_a_place_and_the_move_is_undone() {
    let repo = repo();
    let before = repo.read(INBOX);
    let inbox = api::read_inbox(repo.path()).unwrap();
    let (note, category, index) = find(&inbox, NOTE);

    let moved =
        api::move_note_to_category(repo.path(), &note.id, Some("CLI".into()), &inbox.hash).unwrap();
    assert_eq!(find(&moved, NOTE).1.as_deref(), Some("CLI"));
    let placed = api::place_note(
        repo.path(),
        &find(&moved, NOTE).0.id,
        Some("CLI".into()),
        0,
        &moved.hash,
    )
    .unwrap();
    assert_eq!(
        (find(&placed, NOTE).1.as_deref(), find(&placed, NOTE).2),
        (Some("CLI"), 0)
    );

    api::undo_note_category(repo.path(), &note.lines, category, index).unwrap();

    assert_eq!(repo.read(INBOX), before);
}

#[test]
fn an_undo_of_a_move_to_the_priorities_takes_back_only_that_line_and_keeps_what_was_typed_meanwhile()
 {
    let repo = repo();
    let before = repo.read(INBOX);
    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();
    let (note, category, index) = find(&inbox, NOTE);
    api::note_to_priorities(repo.path(), &note.id, "next", &inbox.hash, &priorities.hash).unwrap();
    let moved = api::read_priorities(repo.path()).unwrap();
    let entry = moved
        .sections
        .iter()
        .flat_map(|s| &s.entries)
        .find(|e| e.text.contains(NOTE))
        .unwrap()
        .clone();
    repo.write(
        PRIORITIES,
        &format!("{}- Typed meanwhile\n", repo.read(PRIORITIES)),
    );

    api::undo_note_to_priorities(
        repo.path(),
        &note.lines,
        category.clone(),
        index,
        "next",
        Some(entry.key.clone()),
    )
    .unwrap();

    assert_eq!(repo.read(INBOX), before, "the note is back where it was");
    let priorities = repo.read(PRIORITIES);
    assert!(
        !priorities.contains(NOTE) && priorities.contains("Typed meanwhile"),
        "{priorities}"
    );

    api::note_to_priorities(
        repo.path(),
        &note.id,
        "next",
        &api::read_inbox(repo.path()).unwrap().hash,
        &api::read_priorities(repo.path()).unwrap().hash,
    )
    .unwrap();
    repo.write(
        PRIORITIES,
        &repo
            .read(PRIORITIES)
            .replace(NOTE, "Rewritten by the human"),
    );
    let refused = api::undo_note_to_priorities(
        repo.path(),
        &note.lines,
        category,
        index,
        "next",
        Some(entry.key),
    );
    assert!(
        refused.is_err(),
        "a line the human rewrote is not taken back"
    );
    assert!(repo.read(PRIORITIES).contains("Rewritten by the human"));
}

#[test]
fn an_undo_of_a_note_added_as_a_draft_removes_the_note_and_its_draft_unless_it_was_typed_in() {
    let repo = repo();
    let before = repo.read(INBOX);
    let inbox = api::read_inbox(repo.path()).unwrap();
    let image = std::fs::read(fixture("images/phone.png")).unwrap();
    let (added, draft) = api::add_note_with_image(
        repo.path(),
        None,
        None,
        "Mobile looks off",
        &image,
        Some("phone.png"),
        &inbox.hash,
    )
    .unwrap();
    let note = by_draft(&added, &draft);
    assert!(repo.exists(&draft));

    api::undo_note_as_draft(repo.path(), &note.lines).unwrap();

    assert!(!repo.exists(&draft), "the draft goes with its note");
    assert_eq!(repo.read(INBOX), before);

    let inbox = api::read_inbox(repo.path()).unwrap();
    let (added, draft) = api::add_note_with_image(
        repo.path(),
        None,
        None,
        "Mobile looks off",
        &image,
        Some("phone.png"),
        &inbox.hash,
    )
    .unwrap();
    let note = by_draft(&added, &draft);
    repo.write(
        &draft,
        &format!("{}\nTyped in by the human.\n", repo.read(&draft)),
    );

    api::undo_note_as_draft(repo.path(), &note.lines).unwrap();

    assert!(repo.exists(&draft), "a draft the human typed in is kept");
    assert!(!repo.read(INBOX).contains("Mobile looks off"));
}
