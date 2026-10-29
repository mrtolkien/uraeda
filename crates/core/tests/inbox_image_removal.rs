//! An image taken out of a note: the line linking it leaves the note's note file, checked against
//! the note file's version, the image's file left for `ura inbox clean` or a commit; and its Undo,
//! which puts the line back where it was.

mod common;

use common::repo::TestRepo;
use uraeda_core::api;
use uraeda_core::files::document::hash;
use uraeda_core::files::image_links::without_image;
use uraeda_core::files::inbox::Inbox;

const NOTE: &str = "Headings are flat";
const NOTE_FILE: &str = "specs/notes/headings-are-flat/note.md";
const FIRST: &str = "specs/notes/headings-are-flat/images/first.webp";
const SECOND: &str = "specs/notes/headings-are-flat/images/second.webp";

/// A repository on `main` with an inbox of one category.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/INBOX.md",
        "# Inbox\n\n## UI\n\n- Text input feels laggy\n",
    );
    repo.commit("chore: specs");
    repo
}

fn image(name: &str) -> (Vec<u8>, Option<String>) {
    let bytes = std::fs::read(common::fixture("images/phone.png")).unwrap();
    (bytes, Some(name.to_string()))
}

/// Adds the note with `first.png` and `second.png`, as the add form does.
fn with_two_images(repo: &TestRepo) {
    let inbox = api::read_inbox(repo.path()).unwrap();
    let images = [image("first.png"), image("second.png")];
    let (_, file) =
        api::add_note_with_images(repo.path(), None, None, NOTE, &images, &inbox.hash).unwrap();
    assert_eq!(file, NOTE_FILE);
}

/// The images of the note that links the note file, as the inbox reads them.
fn images(inbox: &Inbox) -> Vec<String> {
    inbox
        .categories
        .iter()
        .flat_map(|category| &category.notes)
        .find(|note| note.file.as_deref() == Some(NOTE_FILE))
        .map(|note| note.images.clone())
        .unwrap_or_default()
}

/// The image's line leaves the note file with the blank line before it, the file stays, and Undo
/// puts the note file back as it was, byte for byte.
#[test]
fn an_image_leaves_its_note_and_comes_back_on_undo() {
    let repo = repo();
    with_two_images(&repo);
    let before = repo.read(NOTE_FILE);

    let (inbox, removed) =
        api::remove_note_image(repo.path(), NOTE_FILE, FIRST, &hash(&before)).unwrap();

    let after = repo.read(NOTE_FILE);
    assert_eq!(
        after,
        before.replace("\n\n![first](images/first.webp)", ""),
        "{after}"
    );
    assert!(after.contains("![second](images/second.webp)"), "{after}");
    assert!(repo.exists(FIRST), "the image's file stays");
    assert_eq!(images(&inbox), [SECOND]);

    let inbox = api::restore_note_image(repo.path(), &removed).unwrap();

    assert_eq!(repo.read(NOTE_FILE), before);
    assert_eq!(images(&inbox), [FIRST, SECOND]);
}

/// The last image leaves no blank line where it was.
#[test]
fn the_last_image_leaves_the_note_file_as_it_was_written() {
    let repo = repo();
    with_two_images(&repo);
    let text = repo.read(NOTE_FILE);
    let (_, _) = api::remove_note_image(repo.path(), NOTE_FILE, FIRST, &hash(&text)).unwrap();
    let text = repo.read(NOTE_FILE);

    let (inbox, _) = api::remove_note_image(repo.path(), NOTE_FILE, SECOND, &hash(&text)).unwrap();

    let text = repo.read(NOTE_FILE);
    assert_eq!(text, format!("# {NOTE}\n"));
    assert!(images(&inbox).is_empty());
}

/// A note file changed since it was read is not written: a conflict, as other writes are.
#[test]
fn a_stale_note_file_is_a_conflict() {
    let repo = repo();
    with_two_images(&repo);
    let before = repo.read(NOTE_FILE);

    let error = api::remove_note_image(repo.path(), NOTE_FILE, FIRST, "stale").unwrap_err();

    assert_eq!(error.code, "conflict");
    assert_eq!(repo.read(NOTE_FILE), before);
}

/// An image the note file does not link, or a file that is no note file, is refused.
#[test]
fn an_image_not_linked_or_a_file_not_a_note_file_is_refused() {
    let repo = repo();
    with_two_images(&repo);
    let text = repo.read(NOTE_FILE);
    let inbox = repo.read("specs/INBOX.md");
    let missing = "specs/notes/headings-are-flat/images/third.webp";

    let error = api::remove_note_image(repo.path(), NOTE_FILE, missing, &hash(&text)).unwrap_err();
    assert_eq!(error.code, "refused");
    assert!(error.message.contains("third.webp"), "{}", error.message);

    let error =
        api::remove_note_image(repo.path(), "specs/INBOX.md", FIRST, &hash(&inbox)).unwrap_err();
    assert_eq!(error.code, "refused");
    assert_eq!(repo.read(NOTE_FILE), text);
}

/// Undo goes over the note file as it is now, an edit elsewhere kept; it refuses once the place it
/// goes back to changed, or the image is linked again.
#[test]
fn undo_keeps_other_edits_and_refuses_a_changed_place() {
    let repo = repo();
    with_two_images(&repo);
    let text = repo.read(NOTE_FILE);
    let (_, removed) = api::remove_note_image(repo.path(), NOTE_FILE, FIRST, &hash(&text)).unwrap();
    // Typed after the images, at the end of the freeform note file.
    let edited = format!("{}\nTyped meanwhile.\n", repo.read(NOTE_FILE));
    repo.write(NOTE_FILE, &edited);

    api::restore_note_image(repo.path(), &removed).unwrap();

    assert_eq!(repo.read(NOTE_FILE), format!("{text}\nTyped meanwhile.\n"));

    let error = api::restore_note_image(repo.path(), &removed).unwrap_err();
    assert_eq!(error.code, "refused");

    let (_, removed) =
        api::remove_note_image(repo.path(), NOTE_FILE, FIRST, &hash(&repo.read(NOTE_FILE)))
            .unwrap();
    let moved = repo.read(NOTE_FILE).replace(
        &format!("# {NOTE}\n"),
        &format!("# {NOTE}\n\nA paragraph above.\n"),
    );
    repo.write(NOTE_FILE, &moved);

    let error = api::restore_note_image(repo.path(), &removed).unwrap_err();
    assert_eq!(error.code, "refused");
    assert_eq!(repo.read(NOTE_FILE), moved);
}

/// Only the links to that image go: a line they leave empty with them, and the blank line before
/// it when a blank line or the end follows; another line keeps its other words.
#[test]
fn only_the_links_to_the_image_go() {
    let shot = |target: &str| target == "images/shot.webp";
    let cases = [
        (
            "# Flat\n\nHeadings are flat\n\n![shot](images/shot.webp)\n",
            "# Flat\n\nHeadings are flat\n",
        ),
        (
            "Flat\n\n![shot](images/shot.webp)\n\n![other](images/other.webp)\n",
            "Flat\n\n![other](images/other.webp)\n",
        ),
        (
            "See ![shot](./images/shot.webp) and more\n",
            "See and more\n",
        ),
        (
            "Flat\r\n\r\n![shot](images/shot.webp)\r\n\r\n## Why\r\n",
            "Flat\r\n\r\n## Why\r\n",
        ),
        ("  - item ![shot](images/shot.webp)\n", "  - item\n"),
    ];
    for (text, expected) in cases {
        let resolved = |target: &str| shot(target.trim_start_matches("./"));
        assert_eq!(
            without_image(text, resolved).as_deref(),
            Some(expected),
            "{text}"
        );
    }
    let spaced = "Flat\n\n![a (1)](<images/a (1).webp> \"A title\")\n";
    assert_eq!(
        without_image(spaced, |target| target == "images/a (1).webp").as_deref(),
        Some("Flat\n")
    );
    let other = "Flat\n\n![shot](images/shot.webp.old)\n";
    assert_eq!(without_image(other, shot), None);
}
