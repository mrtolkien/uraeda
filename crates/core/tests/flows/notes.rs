//! The inbox and the priorities: the human's lists, written on the default branch from any
//! checkout, never over a change made elsewhere, committed and discarded together with the drafts
//! their moves made.

use uraeda_core::api;
use uraeda_core::files::inbox::Inbox;

use crate::common::fixture;
use crate::common::repo::TestRepo;

const INBOX: &str = "specs/INBOX.md";
const PRIORITIES: &str = "specs/PRIORITIES.md";

fn text(path: &str) -> String {
    std::fs::read_to_string(fixture(path)).unwrap()
}

/// `main` holding the fixture's inbox, priorities, and a draft.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    for name in ["INBOX.md", "PRIORITIES.md", "drafts/git-listener.md"] {
        repo.write(
            &format!("specs/{name}"),
            &text(&format!("repo/main/specs/{name}")),
        );
    }
    repo.commit("chore: specs");
    repo
}

/// The id of the note whose text is `text`.
fn note(inbox: &Inbox, text: &str) -> String {
    inbox
        .categories
        .iter()
        .flat_map(|category| &category.notes)
        .find(|note| note.text == text)
        .unwrap_or_else(|| panic!("no note {text}"))
        .id
        .clone()
}

#[test]
fn the_lists_are_written_on_the_default_branch_from_any_checkout() {
    let repo = repo();
    repo.switch_new("2026-10-15-add-scratchpad");
    let (inbox, priorities) = (
        api::read_inbox(repo.path()).unwrap(),
        api::read_priorities(repo.path()).unwrap(),
    );

    api::add_note(
        repo.path(),
        Some("CLI".into()),
        None,
        "Status hangs on a broken worktree",
        &inbox.hash,
    )
    .unwrap();
    api::add_priority(repo.path(), "next", "An idea", &priorities.hash).unwrap();

    let on_main = |file: &str| repo.read(&format!(".worktrees/main/{file}"));
    assert!(on_main(INBOX).contains("Status hangs on a broken worktree"));
    assert!(on_main(PRIORITIES).contains("An idea"));
    assert_eq!(
        repo.read(INBOX),
        text("repo/main/specs/INBOX.md"),
        "the feature's checkout is untouched"
    );
    assert_eq!(repo.current_branch(), "2026-10-15-add-scratchpad");
}

#[test]
fn an_edit_over_a_file_changed_elsewhere_is_refused() {
    let repo = repo();
    let (inbox, priorities) = (
        api::read_inbox(repo.path()).unwrap(),
        api::read_priorities(repo.path()).unwrap(),
    );
    let humans_inbox = format!("{}- A note the human just typed\n", repo.read(INBOX));
    let humans_priorities = format!("{}- A line the human just typed\n", repo.read(PRIORITIES));
    repo.write(INBOX, &humans_inbox);
    repo.write(PRIORITIES, &humans_priorities);

    let note = api::add_note(repo.path(), None, None, "Mine", &inbox.hash);
    let removed = api::remove_note(
        repo.path(),
        &self::note(&inbox, "We need a home icon"),
        &inbox.hash,
    );
    let line = api::add_priority(repo.path(), "next", "Mine", &priorities.hash);
    let moved = api::move_priority(repo.path(), "next-1", "later", 0, &priorities.hash);

    assert!(
        [
            note.is_err(),
            removed.is_err(),
            line.is_err(),
            moved.is_err()
        ]
        .iter()
        .all(|refused| *refused)
    );
    assert_eq!(repo.read(INBOX), humans_inbox);
    assert_eq!(repo.read(PRIORITIES), humans_priorities);
}

#[test]
fn a_new_note_creates_the_inbox_and_is_marked_with_its_feature() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    let read = api::read_inbox(repo.path()).unwrap();

    api::add_note(
        repo.path(),
        None,
        Some("2026-10-14-run-ui".into()),
        "The x is off",
        &read.hash,
    )
    .unwrap();

    let inbox = api::read_inbox(repo.path()).unwrap();
    let note = &inbox.categories[0].notes[0];
    assert_eq!(
        note.about.as_deref(),
        Some("run-ui"),
        "marked with its slug, not its folder"
    );
    assert_eq!(note.text, "The x is off");
}

#[test]
fn moved_notes_and_the_drafts_they_made_are_committed_together_or_discarded() {
    let repo = repo();
    let before = (repo.read(INBOX), repo.read(PRIORITIES));
    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();
    api::note_to_priorities(
        repo.path(),
        &note(&inbox, "Draft to proposal on mobile went 404"),
        "next",
        &inbox.hash,
        &priorities.hash,
    )
    .unwrap();
    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();
    let draft = api::note_to_new_draft(
        repo.path(),
        &note(&inbox, "We need a home icon"),
        "later",
        &inbox.hash,
        &priorities.hash,
    )
    .unwrap();
    assert!(!repo.read(INBOX).contains("Draft to proposal"));
    assert!(
        repo.read(PRIORITIES)
            .contains("Draft to proposal on mobile went 404")
    );
    assert!(repo.exists(&draft));

    api::discard_changes(repo.path()).unwrap();

    assert_eq!(
        (repo.read(INBOX), repo.read(PRIORITIES)),
        before,
        "discarding restores both lists"
    );
    assert!(!repo.exists(&draft), "and removes the draft the move made");

    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();
    let draft = api::note_to_new_draft(
        repo.path(),
        &note(&inbox, "We need a home icon"),
        "later",
        &inbox.hash,
        &priorities.hash,
    )
    .unwrap();
    api::commit_changes(repo.path()).unwrap();

    let committed = repo.changed_in("main");
    for file in [INBOX, PRIORITIES, &draft] {
        assert!(
            committed.contains(&file.to_string()),
            "{file} in {committed:?}"
        );
    }
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn an_undo_takes_a_note_back_and_keeps_what_the_human_changed_meanwhile() {
    let repo = repo();
    let read = api::read_inbox(repo.path()).unwrap();
    let inbox = api::add_note(
        repo.path(),
        Some("CLI".into()),
        None,
        "A mistaken note",
        &read.hash,
    )
    .unwrap();
    let mistaken = inbox
        .categories
        .iter()
        .flat_map(|c| &c.notes)
        .find(|n| n.text == "A mistaken note")
        .unwrap()
        .lines
        .clone();
    repo.write(INBOX, &format!("{}- Typed meanwhile\n", repo.read(INBOX)));

    api::undo_note_add(repo.path(), &mistaken).unwrap();

    assert!(!repo.read(INBOX).contains("A mistaken note"));
    assert!(repo.read(INBOX).contains("Typed meanwhile"));
}

#[test]
fn priorities_are_edited_then_committed_in_one_commit() {
    let repo = repo();
    let before = repo.read(PRIORITIES);
    let mut read = api::read_priorities(repo.path()).unwrap();
    read = api::add_priority(repo.path(), "next", "A fresh idea", &read.hash).unwrap();
    read = api::move_priority(repo.path(), "next-1", "later", 0, &read.hash).unwrap();
    read = api::edit_priority(repo.path(), "later-1", "- Reworded", &read.hash).unwrap();
    read = api::remove_priority(repo.path(), "later-2", &read.hash).unwrap();
    assert!(read.changes > 0);
    let commits = repo.subjects("main").len();

    api::commit_priorities(repo.path()).unwrap();

    assert_eq!(repo.subjects("main").len(), commits + 1);
    assert_eq!(repo.changed_in("main"), [PRIORITIES]);
    let after = repo.read(PRIORITIES);
    assert!(after.contains("A fresh idea") && after.contains("Reworded"));
    assert_ne!(after, before);
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn a_removed_line_comes_back_byte_for_byte_with_its_nested_lines() {
    let repo = repo();
    let before = repo.read(PRIORITIES);
    let read = api::read_priorities(repo.path()).unwrap();
    let later = &read
        .sections
        .iter()
        .find(|s| s.section == "later")
        .unwrap()
        .entries[0];
    let (id, lines) = (later.id.clone(), later.lines.clone());
    let removed = api::remove_priority(repo.path(), &id, &read.hash).unwrap();

    api::insert_priority(repo.path(), "later", 0, &lines, &removed.hash).unwrap();

    assert_eq!(repo.read(PRIORITIES), before);
}

#[test]
fn a_line_is_drafted_by_its_id_and_linked() {
    let repo = repo();
    repo.write(
        PRIORITIES,
        &repo.read(PRIORITIES).replace(
            "- Claude Code runner (triggered manually)",
            "- Claude Code runner",
        ),
    );
    repo.commit("chore: shorter line");
    let read = api::read_priorities(repo.path()).unwrap();
    let commits = repo.subjects("main").len();

    let draft = api::create_draft(repo.path(), "next-1", &read.hash).unwrap();

    assert!(repo.exists(&draft.path));
    assert!(
        repo.read(PRIORITIES)
            .contains(&format!("]({})", draft.path.trim_start_matches("specs/")))
    );
    assert_eq!(
        repo.subjects("main").len(),
        commits,
        "a draft waits for its commit"
    );
    api::commit_text(repo.path(), &draft.path).unwrap();
    assert_eq!(repo.subjects("main").len(), commits + 1);
    let committed = repo.changed_in("main");
    assert!(
        committed.contains(&draft.path) && committed.contains(&PRIORITIES.to_string()),
        "{committed:?}"
    );
}

#[test]
fn a_note_with_an_image_is_a_draft_committed_with_its_image() {
    let repo = repo();
    let inbox = api::read_inbox(repo.path()).unwrap();
    let image = std::fs::read(fixture("images/phone.png")).unwrap();

    let (_, draft) = api::add_note_with_image(
        repo.path(),
        None,
        None,
        "Mobile looks off",
        &image,
        Some("phone.png"),
        &inbox.hash,
    )
    .unwrap();

    let folder = draft.rsplit_once('/').unwrap().0.to_string();
    assert!(repo.exists(&format!("{folder}/images/phone.webp")));
    api::commit_changes(repo.path()).unwrap();
    let committed = repo.changed_in("main");
    assert!(
        committed.contains(&format!("{folder}/images/phone.webp")),
        "{committed:?}"
    );
    assert!(committed.contains(&INBOX.to_string()));
}
