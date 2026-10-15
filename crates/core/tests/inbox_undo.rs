//! The Undo of a note's move out of its place: one call that changes both files or neither, takes
//! back only what the move wrote, and puts the note back over the inbox as it is now.

mod common;

use common::repo::TestRepo;
use uraeda_core::api;
use uraeda_core::files::inbox::{Inbox, InboxNote};

const INBOX: &str = "specs/INBOX.md";
const PRIORITIES: &str = "specs/PRIORITIES.md";
const LOOK: &str = "specs/drafts/look-and-feel.md";
const LOOK_TEXT: &str = "# Look and feel pass\n\n## What\n\nA pass over the app's spacing and icons.\n\n## Why\n\nIt looks unfinished.\n";
const NOTE: &str = "Draft to proposal on mobile went 404";

fn fixture_text(path: &str) -> String {
    std::fs::read_to_string(common::fixture(path)).unwrap()
}

/// A repository on `main` with the fixture's `INBOX.md` and `PRIORITIES.md`, and the draft "Look
/// and feel pass".
fn fixture_repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    for name in ["INBOX.md", "PRIORITIES.md", "drafts/git-listener.md"] {
        repo.write(
            &format!("specs/{name}"),
            &fixture_text(&format!("repo/main/specs/{name}")),
        );
    }
    repo.write(LOOK, LOOK_TEXT);
    repo.commit("chore: specs");
    repo
}

/// A note by its text, with its category and its index in it.
fn placed(inbox: &Inbox, text: &str) -> (InboxNote, Option<String>, u32) {
    for category in &inbox.categories {
        if let Some(index) = category.notes.iter().position(|note| note.text == text) {
            let index = u32::try_from(index).unwrap();
            return (
                category.notes[index as usize].clone(),
                category.name.clone(),
                index,
            );
        }
    }
    panic!("no note {text}")
}

/// Moves the note `text` to Next, and gives it with its place, and the key of the line it became.
fn moved_to_next(repo: &TestRepo, text: &str) -> (InboxNote, Option<String>, u32, String) {
    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();
    let (note, category, index) = placed(&inbox, text);
    api::note_to_priorities(repo.path(), &note.id, "next", &inbox.hash, &priorities.hash).unwrap();
    let after = api::read_priorities(repo.path()).unwrap();
    let next = after.sections.iter().find(|s| s.section == "next").unwrap();
    let key = next.entries.last().unwrap().key.clone();
    (note, category, index, key)
}

/// The Undo of a move to the priorities puts the note back over a change made meanwhile.
#[test]
fn undo_of_a_move_to_the_priorities_keeps_a_change_made_meanwhile() {
    let repo = fixture_repo();
    let (inbox, priorities) = (repo.read(INBOX), repo.read(PRIORITIES));
    let (note, category, index, key) = moved_to_next(&repo, NOTE);
    let elsewhere = repo
        .read(INBOX)
        .replace("We need a home icon", "A home icon");
    repo.write(INBOX, &elsewhere);

    api::undo_note_to_priorities(repo.path(), &note.lines, category, index, "next", Some(key))
        .unwrap();

    assert_eq!(
        repo.read(INBOX),
        inbox.replace("We need a home icon", "A home icon")
    );
    assert_eq!(repo.read(PRIORITIES), priorities);
}

/// A line of the same text the human added after the move is theirs: with several, the Undo takes
/// the move's line by the key it had, or refuses without one.
#[test]
fn undo_of_a_move_to_the_priorities_leaves_the_humans_same_line() {
    let repo = fixture_repo();
    let inbox = repo.read(INBOX);
    let (note, category, index, key) = moved_to_next(&repo, NOTE);
    let typed = repo
        .read(PRIORITIES)
        .replace(&format!("- {NOTE}\n"), &format!("- {NOTE}\n- {NOTE}\n"));
    repo.write(PRIORITIES, &typed);

    let refused = api::undo_note_to_priorities(
        repo.path(),
        &note.lines,
        category.clone(),
        index,
        "next",
        None,
    );
    assert!(refused.is_err());
    assert_eq!(repo.read(PRIORITIES), typed);
    assert!(!repo.read(INBOX).contains(NOTE));

    api::undo_note_to_priorities(repo.path(), &note.lines, category, index, "next", Some(key))
        .unwrap();
    assert_eq!(repo.read(INBOX), inbox);
    assert_eq!(
        repo.read(PRIORITIES)
            .matches(&format!("- {NOTE}\n"))
            .count(),
        1
    );
}

/// Once the line the move wrote is gone, the Undo is refused, and nothing is written.
#[test]
fn undo_of_a_move_to_the_priorities_is_refused_once_its_line_is_gone() {
    let repo = fixture_repo();
    let (note, category, index, key) = moved_to_next(&repo, NOTE);
    let edited = repo
        .read(PRIORITIES)
        .replace(&format!("- {NOTE}\n"), "- Mobile 404\n");
    repo.write(PRIORITIES, &edited);
    let inbox = repo.read(INBOX);

    let error =
        api::undo_note_to_priorities(repo.path(), &note.lines, category, index, "next", Some(key))
            .unwrap_err();

    assert_eq!(
        error.to_string(),
        format!("Could not undo: \"{NOTE}\" is no longer in PRIORITIES.md.")
    );
    assert_eq!(repo.read(PRIORITIES), edited);
    assert_eq!(repo.read(INBOX), inbox);
}

/// The Undo of an add to a draft takes the note's lines out of it, and keeps what the human typed.
#[test]
fn undo_of_an_add_to_a_draft_keeps_the_humans_typing() {
    let repo = fixture_repo();
    let before = repo.read(INBOX);
    let inbox = api::read_inbox(repo.path()).unwrap();
    let (note, category, index) = placed(&inbox, "Icons are blurry on retina screens");
    api::note_to_draft(repo.path(), &note.id, LOOK, &inbox.hash).unwrap();
    let typed = repo
        .read(LOOK)
        .replace("It looks unfinished.", "It looks unfinished, and dated.");
    repo.write(LOOK, &typed);

    api::undo_note_to_draft(repo.path(), LOOK, &note.lines, category.clone(), index).unwrap();

    assert_eq!(
        repo.read(LOOK),
        LOOK_TEXT.replace("It looks unfinished.", "It looks unfinished, and dated.")
    );
    assert_eq!(repo.read(INBOX), before);

    let error =
        api::undo_note_to_draft(repo.path(), LOOK, &note.lines, category, index).unwrap_err();
    assert_eq!(
        error.to_string(),
        "Could not undo: \"Icons are blurry on retina screens\" is no longer in \
         drafts/look-and-feel.md."
    );
}

/// The Undo of a move to another category puts the note back at its place, in one write, over a
/// change made meanwhile; once the note changed, it is refused.
#[test]
fn undo_of_a_category_move_puts_the_note_back_at_its_place() {
    let repo = fixture_repo();
    let before = repo.read(INBOX);
    let inbox = api::read_inbox(repo.path()).unwrap();
    let (note, category, index) = placed(&inbox, "We need a home icon");
    api::move_note_to_category(repo.path(), &note.id, Some("UI".into()), &inbox.hash).unwrap();
    let elsewhere = repo.read(INBOX).replace("Make sure", "Check that");
    repo.write(INBOX, &elsewhere);

    api::undo_note_category(repo.path(), &note.lines, category.clone(), index).unwrap();
    assert_eq!(repo.read(INBOX), before.replace("Make sure", "Check that"));

    let edited = repo
        .read(INBOX)
        .replace("We need a home icon", "A home icon");
    repo.write(INBOX, &edited);
    let error = api::undo_note_category(repo.path(), &note.lines, category, index).unwrap_err();
    assert_eq!(
        error.to_string(),
        "Could not undo: \"We need a home icon\" is no longer in INBOX.md."
    );
    assert_eq!(repo.read(INBOX), edited);
}
