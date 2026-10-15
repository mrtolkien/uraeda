//! A note with an image (US6): added as a draft, which the image makes a folder, its link put at
//! the end of the draft's What, and committed, discarded, or undone with the inbox.

mod common;

use common::repo::TestRepo;
use uraeda_core::api;

const INBOX: &str = "specs/INBOX.md";
const NOTE: &str = "The spec page's headings are body-sized";
/// `slug::from_text`'s rule, as `ura draft` names drafts: the apostrophe is a hyphen.
const SLUG: &str = "the-spec-page-s-headings-are-body-sized";
const LINK: &str = "![spec-headings](images/spec-headings.webp)";

fn fixture_text(path: &str) -> String {
    std::fs::read_to_string(common::fixture(path)).unwrap()
}

/// A repository on `main` with the fixture's `INBOX.md` and `PRIORITIES.md`.
fn fixture_repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    for name in ["INBOX.md", "PRIORITIES.md"] {
        repo.write(
            &format!("specs/{name}"),
            &fixture_text(&format!("repo/main/specs/{name}")),
        );
    }
    repo.commit("chore: specs");
    repo
}

fn proposal() -> String {
    format!("specs/drafts/{SLUG}/proposal.md")
}

/// Adds the note as a draft under UI, attaches `spec-headings.png` to it, and links the image from
/// the draft, as the add form does. Returns the draft's path once it is a folder.
fn add_with_image(repo: &TestRepo) -> String {
    let inbox = api::read_inbox(repo.path()).unwrap();
    let draft =
        api::add_note_as_draft(repo.path(), Some("UI".to_string()), None, NOTE, &inbox.hash)
            .unwrap();
    let written = api::read_text(repo.path(), &draft).unwrap();
    let bytes = std::fs::read(common::fixture("images/phone.png")).unwrap();
    let attached =
        api::attach_image(repo.path(), &draft, &bytes, Some("spec-headings.png")).unwrap();
    let moved = attached.moved.unwrap();
    api::link_note_image(repo.path(), &moved, &attached.link, &written.hash).unwrap();
    moved
}

/// US6 2: the draft holds the note as its title and What, then the image; the inbox links the
/// folder's proposal under UI; Commit holds the image with them.
#[test]
fn a_note_with_an_image_is_a_linked_draft_committed_with_its_image() {
    let repo = fixture_repo();

    let path = add_with_image(&repo);

    assert_eq!(path, proposal());
    assert!(
        repo.read(&path).contains(&format!(
            "# {NOTE}\n\n## What\n\n{NOTE}\n\n{LINK}\n\n## Why\n"
        )),
        "{}",
        repo.read(&path)
    );
    assert!(repo.read(INBOX).contains(&format!(
        "- Text input feels laggy on the sessions page\n- [{NOTE}](drafts/{SLUG}/proposal.md)\n\n## CLI"
    )));

    api::commit_changes(repo.path()).unwrap();

    let image = format!("specs/drafts/{SLUG}/images/spec-headings.webp");
    assert_eq!(
        repo.changed_in("main"),
        [INBOX.to_string(), image, path.clone()]
    );
    assert_eq!(
        repo.subjects("main")[0],
        format!("chore: add \"{NOTE}\" to the inbox")
    );
    assert_eq!(repo.porcelain(), "");
}

/// Only an image of the draft's own `images/` is linked, and only over the text the page read.
#[test]
fn an_image_link_is_refused_unless_it_is_the_drafts_image() {
    let repo = fixture_repo();
    let path = add_with_image(&repo);
    let read = api::read_text(repo.path(), &path).unwrap();

    for link in [
        "![x](images/missing.webp)",
        "Some text",
        "![x](../secret.webp)",
    ] {
        let error = api::link_note_image(repo.path(), &path, link, &read.hash).unwrap_err();
        assert_eq!(error.code, "refused", "{link}");
    }
    let error = api::link_note_image(repo.path(), &path, LINK, "stale").unwrap_err();
    assert_eq!(error.code, "conflict");
    assert_eq!(repo.read(&path), read.text);
}

/// Discard (ruling R14): a draft the add wrote, with only its image added, goes with its image
/// and its folder.
#[test]
fn discard_deletes_an_untouched_draft_with_its_image() {
    let repo = fixture_repo();
    add_with_image(&repo);

    api::discard_changes(repo.path()).unwrap();

    assert!(!repo.exists(&format!("specs/drafts/{SLUG}")));
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
    assert_eq!(repo.porcelain(), "");
}

/// Discard never loses the human's text: a draft with an image, typed in, is kept with its image.
#[test]
fn discard_keeps_a_draft_with_an_image_typed_in() {
    let repo = fixture_repo();
    let path = add_with_image(&repo);
    let typed = repo
        .read(&path)
        .replace("## Why\n", "## Why\n\nIt reads flat.\n");
    repo.write(&path, &typed);

    api::discard_changes(repo.path()).unwrap();

    assert_eq!(repo.read(&path), typed);
    assert!(repo.exists(&format!("specs/drafts/{SLUG}/images/spec-headings.webp")));
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
}

/// The toast's Undo takes the note out, with the draft it wrote and its image.
#[test]
fn undo_takes_back_the_note_and_its_untouched_draft() {
    let repo = fixture_repo();
    add_with_image(&repo);
    let lines = vec![format!("- [{NOTE}](drafts/{SLUG}/proposal.md)")];

    let inbox = api::undo_note_as_draft(repo.path(), &lines).unwrap();

    assert_eq!(inbox.changes, 0);
    assert!(!repo.exists(&format!("specs/drafts/{SLUG}")));
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
}

/// Undo never loses the human's text: once typed in, the draft stays, and only the note goes.
/// Once the note is gone, Undo is refused.
#[test]
fn undo_keeps_a_draft_typed_in_and_is_refused_once_the_note_is_gone() {
    let repo = fixture_repo();
    let path = add_with_image(&repo);
    let typed = repo
        .read(&path)
        .replace("## Why\n", "## Why\n\nIt reads flat.\n");
    repo.write(&path, &typed);
    let lines = vec![format!("- [{NOTE}](drafts/{SLUG}/proposal.md)")];

    api::undo_note_as_draft(repo.path(), &lines).unwrap();

    assert_eq!(repo.read(&path), typed);
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
    let error = api::undo_note_as_draft(repo.path(), &lines).unwrap_err();
    assert_eq!(
        error.message,
        format!("Could not undo: \"{NOTE}\" is no longer in INBOX.md.")
    );
}

/// US6 3: the linked note, moved to Next, keeps its link there.
#[test]
fn the_linked_note_keeps_its_link_in_the_priorities() {
    let repo = fixture_repo();
    add_with_image(&repo);
    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();
    let note = inbox
        .categories
        .iter()
        .flat_map(|category| &category.notes)
        .find(|note| note.draft == Some(proposal()))
        .unwrap();

    api::note_to_priorities(repo.path(), &note.id, "next", &inbox.hash, &priorities.hash).unwrap();

    let priorities = repo.read("specs/PRIORITIES.md");
    assert!(
        priorities.contains(&format!("- [{NOTE}](drafts/{SLUG}/proposal.md)\n")),
        "{priorities}"
    );
}
