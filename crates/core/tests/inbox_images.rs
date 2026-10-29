//! A note with an image (US6): added in one call as a note file's folder holding the note and the
//! image, linked from the inbox, all written or none; then committed, discarded, or undone with the
//! inbox.

mod common;

use common::repo::TestRepo;
use uraeda_core::api;

const INBOX: &str = "specs/INBOX.md";
const NOTE: &str = "The spec page's headings are body-sized";
/// `slug::from_text`'s rule, as `ura expand` names note_files: the apostrophe is a hyphen.
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

fn note_file() -> String {
    format!("specs/notes/{SLUG}/note.md")
}

fn image(name: &str) -> Vec<u8> {
    std::fs::read(common::fixture(&format!("images/{name}"))).unwrap()
}

/// An image of the fixtures, as the form sends it: its bytes and its file name.
fn note_image(fixture: &str, name: &str) -> (Vec<u8>, Option<String>) {
    (image(fixture), Some(name.to_string()))
}

/// Adds the note under UI with `spec-headings.png`, as the add form does. Returns the note file's
/// path.
fn add_with_image(repo: &TestRepo) -> String {
    let inbox = api::read_inbox(repo.path()).unwrap();
    let (after, file) = api::add_note_with_images(
        repo.path(),
        Some("UI".to_string()),
        None,
        NOTE,
        &[note_image("phone.png", "spec-headings.png")],
        &inbox.hash,
    )
    .unwrap();
    assert_eq!(after.count, inbox.count + 1);
    file
}

/// The names in the note_files' folder.
fn note_files(repo: &TestRepo) -> Vec<String> {
    std::fs::read_dir(repo.path().join("specs/notes"))
        .map(|entries| {
            entries
                .flatten()
                .map(|entry| entry.file_name().to_string_lossy().into_owned())
                .collect()
        })
        .unwrap_or_default()
}

/// US6 2: the note file holds the note as its title and What, then the image; the inbox links the
/// folder's proposal under UI; Commit holds the image with them.
#[test]
fn a_note_with_an_image_is_a_linked_note_file_committed_with_its_image() {
    let repo = fixture_repo();

    let path = add_with_image(&repo);

    assert_eq!(path, note_file());
    assert!(
        repo.read(&path).contains(&format!(
            "# {NOTE}\n\n## What\n\n{NOTE}\n\n{LINK}\n\n## Why\n"
        )),
        "{}",
        repo.read(&path)
    );
    assert!(repo.read(INBOX).contains(&format!(
        "- Text input feels laggy on the sessions page\n- [{NOTE}](notes/{SLUG}/note.md)\n\n## CLI"
    )));

    api::commit_changes(repo.path()).unwrap();

    let image = format!("specs/notes/{SLUG}/images/spec-headings.webp");
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

/// An image the core refuses is refused before anything is written.
#[test]
fn a_refused_image_writes_nothing() {
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();

    let error = api::add_note_with_images(
        repo.path(),
        Some("UI".to_string()),
        None,
        NOTE,
        &[note_image("drawing.svg", "diagram.svg")],
        &inbox.hash,
    )
    .unwrap_err();

    assert_eq!(
        error.message,
        "Only PNG, JPEG, GIF, and WebP images can be added: diagram.svg is not one."
    );
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
    assert!(note_files(&repo).is_empty());
}

/// An inbox changed since it was read is refused as a conflict, and nothing is written.
#[test]
fn a_stale_inbox_writes_nothing() {
    let repo = fixture_repo();

    let error = api::add_note_with_images(
        repo.path(),
        None,
        None,
        NOTE,
        &[note_image("phone.png", "spec-headings.png")],
        "stale",
    )
    .unwrap_err();

    assert_eq!(error.code, "conflict");
    assert!(note_files(&repo).is_empty());
}

/// A failed write of the inbox takes the note file's folder back out: no note file is left
/// unlinked.
#[cfg(unix)]
#[test]
fn a_failed_inbox_write_leaves_no_note_file() {
    use std::os::unix::fs::PermissionsExt;
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();
    let file = repo.path().join(INBOX);
    std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o444)).unwrap();
    if std::fs::OpenOptions::new().append(true).open(&file).is_ok() {
        // Root writes anyway.
        return;
    }

    let result = api::add_note_with_images(
        repo.path(),
        None,
        None,
        NOTE,
        &[note_image("phone.png", "spec-headings.png")],
        &inbox.hash,
    );
    std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o644)).unwrap();

    assert!(result.is_err());
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
    assert!(note_files(&repo).is_empty());
}

/// The commit bar's Commit deletes an image of the note file's folder that nothing links, as a
/// note file's own commit does.
#[test]
fn commit_prunes_an_unlinked_image() {
    let repo = fixture_repo();
    add_with_image(&repo);
    let stray = format!("specs/notes/{SLUG}/images/stray.webp");
    repo.write(&stray, "x");

    api::commit_changes(repo.path()).unwrap();

    assert!(!repo.exists(&stray));
    assert!(!repo.changed_in("main").contains(&stray));
    assert_eq!(repo.porcelain(), "");
}

/// Discard (ruling R14): a note file the add wrote, untouched, goes with its whole `images/` and
/// its folder.
#[test]
fn discard_deletes_an_untouched_note_file_with_its_image() {
    let repo = fixture_repo();
    add_with_image(&repo);
    // An image nothing links, as a copy into the folder leaves it: it goes with the folder.
    repo.write(&format!("specs/notes/{SLUG}/images/stray.webp"), "x");

    api::discard_changes(repo.path()).unwrap();

    assert!(!repo.exists(&format!("specs/notes/{SLUG}")));
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
    assert_eq!(repo.porcelain(), "");
}

/// Discard never loses the human's text: a note file with an image, typed in, is kept with its
/// image.
#[test]
fn discard_keeps_a_note_file_with_an_image_typed_in() {
    let repo = fixture_repo();
    let path = add_with_image(&repo);
    let typed = repo
        .read(&path)
        .replace("## Why\n", "## Why\n\nIt reads flat.\n");
    repo.write(&path, &typed);

    api::discard_changes(repo.path()).unwrap();

    assert_eq!(repo.read(&path), typed);
    assert!(repo.exists(&format!("specs/notes/{SLUG}/images/spec-headings.webp")));
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
}

/// The toast's Undo takes the note out, with the note file it wrote and its image.
#[test]
fn undo_takes_back_the_note_and_its_untouched_note_file() {
    let repo = fixture_repo();
    add_with_image(&repo);
    repo.write(&format!("specs/notes/{SLUG}/images/stray.webp"), "x");
    let lines = vec![format!("- [{NOTE}](notes/{SLUG}/note.md)")];

    let inbox = api::undo_note_as_file(repo.path(), &lines).unwrap();

    assert_eq!(inbox.changes, 0);
    assert!(!repo.exists(&format!("specs/notes/{SLUG}")));
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
}

/// Undo never loses the human's text: once typed in, the note file stays, and only the note goes.
/// Once the note is gone, Undo is refused.
#[test]
fn undo_keeps_a_note_file_typed_in_and_is_refused_once_the_note_is_gone() {
    let repo = fixture_repo();
    let path = add_with_image(&repo);
    let typed = repo
        .read(&path)
        .replace("## Why\n", "## Why\n\nIt reads flat.\n");
    repo.write(&path, &typed);
    let lines = vec![format!("- [{NOTE}](notes/{SLUG}/note.md)")];

    api::undo_note_as_file(repo.path(), &lines).unwrap();

    assert_eq!(repo.read(&path), typed);
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
    let error = api::undo_note_as_file(repo.path(), &lines).unwrap_err();
    assert_eq!(
        error.message,
        format!("Could not undo: \"{NOTE}\" is no longer in INBOX.md.")
    );
}

/// Moves the note with an image to Next, over the files as read. Returns its lines as written and
/// its place in UI, what its Undo takes.
fn move_to_next(repo: &TestRepo) -> (Vec<String>, u32) {
    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();
    let ui = inbox
        .categories
        .iter()
        .find(|category| category.name.as_deref() == Some("UI"))
        .unwrap();
    let index = ui
        .notes
        .iter()
        .position(|note| note.file == Some(note_file()))
        .unwrap();
    let note = &ui.notes[index];
    api::note_to_proposal(repo.path(), &note.id, "next", &inbox.hash, &priorities.hash).unwrap();
    (note.lines.clone(), index as u32)
}

/// US6 3: the note, moved to Next, links its file there, moved among the proposals, `note.md`
/// becoming `proposal.md`, its image with it; the move's Undo moves the file back.
#[test]
fn a_note_file_moves_to_the_proposals_with_its_note_and_back_on_undo() {
    let repo = fixture_repo();
    add_with_image(&repo);
    let written = repo.read(&note_file());

    let (lines, index) = move_to_next(&repo);

    let moved = format!("specs/proposals/{SLUG}/proposal.md");
    let priorities = repo.read("specs/PRIORITIES.md");
    assert!(
        priorities.contains(&format!("- [{NOTE}](proposals/{SLUG}/proposal.md)\n")),
        "{priorities}"
    );
    assert_eq!(repo.read(&moved), written);
    assert!(repo.exists(&format!("specs/proposals/{SLUG}/images/spec-headings.webp")));
    assert!(!repo.exists(&format!("specs/notes/{SLUG}")));

    api::undo_note_to_proposal(repo.path(), &lines, Some("UI".into()), index, "next", None)
        .unwrap();

    assert_eq!(repo.read(&note_file()), written);
    assert!(repo.exists(&format!("specs/notes/{SLUG}/images/spec-headings.webp")));
    assert!(!repo.exists(&format!("specs/proposals/{SLUG}")));
    assert!(!repo.read("specs/PRIORITIES.md").contains(NOTE));
    assert!(
        repo.read(INBOX)
            .contains(&format!("- [{NOTE}](notes/{SLUG}/note.md)\n"))
    );
}

/// A note with a note file made a new proposal file moves its file there, rather than writing one:
/// the path it gives is the moved folder's `proposal.md`.
#[test]
fn a_note_with_a_file_made_a_proposal_file_moves_its_file() {
    let repo = fixture_repo();
    add_with_image(&repo);
    let (note, _) = noted(&repo);
    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();

    let path = api::note_to_proposal_file(
        repo.path(),
        &note.id,
        "later",
        &inbox.hash,
        &priorities.hash,
    )
    .unwrap();

    assert_eq!(path, format!("specs/proposals/{SLUG}/proposal.md"));
    assert!(!repo.exists(&format!("specs/notes/{SLUG}")));
}

/// A note whose link names a note file the disk lacks moves to the priorities as text, and its
/// Undo takes that line back.
#[test]
fn a_note_linking_a_missing_note_file_moves_as_text() {
    let repo = fixture_repo();
    add_with_image(&repo);
    std::fs::remove_dir_all(repo.path().join(format!("specs/notes/{SLUG}"))).unwrap();

    let (lines, index) = move_to_next(&repo);

    assert!(
        repo.read("specs/PRIORITIES.md")
            .contains(&format!("- [{NOTE}](notes/{SLUG}/note.md)\n"))
    );
    api::undo_note_to_proposal(repo.path(), &lines, Some("UI".into()), index, "next", None)
        .unwrap();
    assert!(!repo.read("specs/PRIORITIES.md").contains(NOTE));
}

/// A committed note's file its move put among the proposals: Discard moves it back, and Commit
/// holds the move, the note file's deletion with the proposal file and its image.
#[test]
fn a_moved_note_file_is_discarded_back_or_committed_as_a_move() {
    let repo = fixture_repo();
    add_with_image(&repo);
    api::commit_changes(repo.path()).unwrap();
    let written = repo.read(&note_file());
    move_to_next(&repo);

    api::discard_changes(repo.path()).unwrap();

    assert_eq!(repo.read(&note_file()), written);
    assert!(!repo.exists(&format!("specs/proposals/{SLUG}")));
    assert_eq!(repo.porcelain(), "");

    move_to_next(&repo);
    api::commit_changes(repo.path()).unwrap();

    assert_eq!(
        repo.changed_in("main"),
        [
            INBOX.to_string(),
            "specs/PRIORITIES.md".to_string(),
            format!("specs/notes/{SLUG}/images/spec-headings.webp"),
            note_file(),
            format!("specs/proposals/{SLUG}/images/spec-headings.webp"),
            format!("specs/proposals/{SLUG}/proposal.md"),
        ]
    );
    assert_eq!(repo.porcelain(), "");
}

/// The note with an image in UI, and its place there.
fn noted(repo: &TestRepo) -> (uraeda_core::files::inbox::InboxNote, u32) {
    let inbox = api::read_inbox(repo.path()).unwrap();
    let ui = inbox
        .categories
        .into_iter()
        .find(|category| category.name.as_deref() == Some("UI"))
        .unwrap();
    let index = ui
        .notes
        .iter()
        .position(|note| note.file == Some(note_file()))
        .unwrap();
    (ui.notes[index].clone(), index as u32)
}

/// A removed note takes its note file with it, image included, while it holds only what the note
/// wrote; Undo, which inserts the note's lines back, writes the file back byte for byte.
#[test]
fn a_removed_notes_file_comes_back_byte_for_byte_on_undo() {
    let repo = fixture_repo();
    add_with_image(&repo);
    let written = repo.read(&note_file());
    let image = repo
        .path()
        .join(format!("specs/notes/{SLUG}/images/spec-headings.webp"));
    let bytes = std::fs::read(&image).unwrap();
    let (note, index) = noted(&repo);
    let hash = api::read_inbox(repo.path()).unwrap().hash;

    let removed = api::remove_note(repo.path(), &note.id, &hash).unwrap();

    assert!(!repo.exists(&format!("specs/notes/{SLUG}")));

    api::insert_note(
        repo.path(),
        Some("UI".into()),
        index,
        &note.lines,
        &removed.hash,
    )
    .unwrap();

    assert_eq!(repo.read(&note_file()), written);
    assert_eq!(std::fs::read(&image).unwrap(), bytes);
}

/// A note file typed in since its note wrote it, and not committed so, survives the note's
/// removal, as the git decision keeps the user's work: only the line goes.
#[test]
fn a_typed_in_uncommitted_note_file_survives_its_notes_removal() {
    let repo = fixture_repo();
    add_with_image(&repo);
    let typed = repo
        .read(&note_file())
        .replace("## Why\n", "## Why\n\nMy eyes.\n");
    repo.write(&note_file(), &typed);
    let (note, _) = noted(&repo);
    let hash = api::read_inbox(repo.path()).unwrap().hash;

    api::remove_note(repo.path(), &note.id, &hash).unwrap();

    assert!(!repo.read(INBOX).contains(NOTE));
    assert_eq!(repo.read(&note_file()), typed);
}

/// A category removed with its notes takes their note files, and its restore brings them back.
#[test]
fn a_category_removed_with_its_notes_takes_their_files_until_restored() {
    let repo = fixture_repo();
    add_with_image(&repo);
    let written = repo.read(&note_file());
    let hash = api::read_inbox(repo.path()).unwrap().hash;

    let (removed, before) = api::remove_category(repo.path(), "UI", false, &hash).unwrap();

    assert!(!repo.exists(&format!("specs/notes/{SLUG}")));

    api::restore_category(repo.path(), &before, &removed.hash).unwrap();

    assert_eq!(repo.read(&note_file()), written);
}

/// A committed note's file its note's removal took away: Discard brings it back, and Commit holds
/// its deletion with the inbox.
#[test]
fn a_removed_notes_file_is_discarded_back_or_committed_with_its_note() {
    let repo = fixture_repo();
    add_with_image(&repo);
    api::commit_changes(repo.path()).unwrap();
    let written = repo.read(&note_file());
    let remove = |repo: &TestRepo| {
        let (note, _) = noted(repo);
        let hash = api::read_inbox(repo.path()).unwrap().hash;
        api::remove_note(repo.path(), &note.id, &hash).unwrap();
    };
    remove(&repo);

    api::discard_changes(repo.path()).unwrap();

    assert_eq!(repo.read(&note_file()), written);
    assert_eq!(repo.porcelain(), "");

    remove(&repo);
    api::commit_changes(repo.path()).unwrap();

    assert_eq!(
        repo.changed_in("main"),
        [
            INBOX.to_string(),
            format!("specs/notes/{SLUG}/images/spec-headings.webp"),
            note_file(),
        ]
    );
    assert_eq!(
        repo.subjects("main")[0],
        format!("chore: remove \"{NOTE}\" from the inbox")
    );
    assert_eq!(repo.porcelain(), "");
}

/// Several images: the note file links each in the order they came, and holds every file.
#[test]
fn a_note_takes_several_images_in_order() {
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();

    let (_, path) = api::add_note_with_images(
        repo.path(),
        None,
        None,
        NOTE,
        &[
            note_image("phone.png", "first.png"),
            note_image("desktop.png", "second.png"),
        ],
        &inbox.hash,
    )
    .unwrap();

    let text = repo.read(&path);
    let first = text.find("![first](images/first.webp)").unwrap();
    let second = text.find("![second](images/second.webp)").unwrap();
    assert!(first < second, "{text}");
    assert!(repo.exists(&format!("specs/notes/{SLUG}/images/first.webp")));
    assert!(repo.exists(&format!("specs/notes/{SLUG}/images/second.webp")));
}

/// One refused image among several writes nothing.
#[test]
fn a_refused_image_among_several_writes_nothing() {
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();

    let error = api::add_note_with_images(
        repo.path(),
        None,
        None,
        NOTE,
        &[
            note_image("phone.png", "ok.png"),
            note_image("drawing.svg", "diagram.svg"),
        ],
        &inbox.hash,
    )
    .unwrap_err();

    assert!(error.message.contains("diagram.svg"), "{}", error.message);
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
    assert!(note_files(&repo).is_empty());
}

/// The id of the note whose text is `text`.
fn note_id(repo: &TestRepo, text: &str) -> String {
    let inbox = api::read_inbox(repo.path()).unwrap();
    inbox
        .categories
        .iter()
        .flat_map(|category| &category.notes)
        .find(|note| note.text == text)
        .unwrap()
        .id
        .clone()
}

/// An image on a note of the inbox that links no note file makes it a note file's folder holding
/// the note and the image, linked from the note's own place, its marks kept.
#[test]
fn an_image_on_a_note_makes_it_a_note_file_linked_in_place() {
    let repo = fixture_repo();
    let text = "Opening a session with 2,000 messages takes 4 s";
    let id = note_id(&repo, text);
    let inbox = api::read_inbox(repo.path()).unwrap();

    let (after, path) = api::attach_note_images(
        repo.path(),
        &id,
        &[note_image("phone.png", "slow.png")],
        &inbox.hash,
    )
    .unwrap();

    assert_eq!(after.count, inbox.count);
    assert_eq!(
        path,
        "specs/notes/opening-a-session-with-2-000-messages-takes-4-s/note.md"
    );
    assert!(
        repo.read(&path).contains(&format!(
            "# {text}\n\n## What\n\n{text}\n\n![slow](images/slow.webp)\n"
        )),
        "{}",
        repo.read(&path)
    );
    assert!(repo.read(INBOX).contains(&format!(
        "- [agent] [session-view] [{text}](notes/opening-a-session-with-2-000-messages-takes-4-s/note.md)\n- Text input feels laggy"
    )));
}

/// A note's sub-items go into its note file, after its text, and leave the inbox.
#[test]
fn the_sub_items_of_a_note_go_into_its_note_file() {
    let repo = fixture_repo();
    repo.write(
        INBOX,
        "# Inbox\n\n- Slow lists\n  - on the home page\n  - and in the sidebar\n- Other\n",
    );
    repo.commit("chore: nested");
    let id = note_id(&repo, "Slow lists");
    let inbox = api::read_inbox(repo.path()).unwrap();

    let (_, path) = api::attach_note_images(
        repo.path(),
        &id,
        &[note_image("phone.png", "list.png")],
        &inbox.hash,
    )
    .unwrap();

    let file = repo.read(&path);
    assert!(
        file.contains(
            "Slow lists\n\n- on the home page\n- and in the sidebar\n\n![list](images/list.webp)"
        ),
        "{file}"
    );
    assert_eq!(
        repo.read(INBOX),
        "# Inbox\n\n- [Slow lists](notes/slow-lists/note.md)\n- Other\n"
    );
}

/// A note that links a single-file note file: the note file becomes a folder, the image's link goes
/// at the end of its What, and the note's link follows the note file.
#[test]
fn an_image_on_a_note_with_a_note_file_goes_into_that_note_file() {
    let repo = fixture_repo();
    repo.write(
        INBOX,
        "# Inbox\n\n- [Git listener](notes/git-listener.md)\n",
    );
    repo.write(
        "specs/notes/git-listener.md",
        &fixture_text("repo/main/specs/proposals/git-listener.md"),
    );
    repo.commit("chore: link");
    let id = note_id(&repo, "[Git listener](notes/git-listener.md)");
    let inbox = api::read_inbox(repo.path()).unwrap();

    let (_, path) = api::attach_note_images(
        repo.path(),
        &id,
        &[
            note_image("phone.png", "one.png"),
            note_image("desktop.png", "two.png"),
        ],
        &inbox.hash,
    )
    .unwrap();

    assert_eq!(path, "specs/notes/git-listener/note.md");
    let file = repo.read(&path);
    assert!(
        file.contains("Run the next step when a branch changes.\n\n![one](images/one.webp)\n\n![two](images/two.webp)\n\n## Why"),
        "{file}"
    );
    assert!(repo.exists("specs/notes/git-listener/images/one.webp"));
    assert!(!repo.exists("specs/notes/git-listener.md"));
    assert_eq!(
        repo.read(INBOX),
        "# Inbox\n\n- [Git listener](notes/git-listener/note.md)\n"
    );
}

/// Discard takes back what attaching to a note did: the note as it was, and no note file left
/// behind.
#[test]
fn discard_takes_back_an_image_on_a_note() {
    let repo = fixture_repo();
    let id = note_id(&repo, "Draft to proposal on mobile went 404");
    let inbox = api::read_inbox(repo.path()).unwrap();
    api::attach_note_images(
        repo.path(),
        &id,
        &[note_image("phone.png", "mobile.png")],
        &inbox.hash,
    )
    .unwrap();

    api::discard_changes(repo.path()).unwrap();

    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
    assert!(note_files(&repo).is_empty() || note_files(&repo) == ["git-listener.md".to_string()]);
}

/// Commit holds the note's note file and its image with the inbox.
#[test]
fn commit_holds_the_note_file_of_a_note_with_an_image() {
    let repo = fixture_repo();
    let id = note_id(&repo, "Draft to proposal on mobile went 404");
    let inbox = api::read_inbox(repo.path()).unwrap();
    let (_, path) = api::attach_note_images(
        repo.path(),
        &id,
        &[note_image("phone.png", "mobile.png")],
        &inbox.hash,
    )
    .unwrap();

    api::commit_changes(repo.path()).unwrap();

    let image = path.replace("note.md", "images/mobile.webp");
    assert_eq!(repo.changed_in("main"), [INBOX.to_string(), image, path]);
    assert_eq!(repo.porcelain(), "");
}

/// The inbox lists the images of each note's note file, in the order the note file links them: what
/// the note's row and pane draw. A note with no note file has none.
#[test]
fn the_inbox_lists_the_images_of_each_notes_note_file() {
    let repo = fixture_repo();
    let id = note_id(&repo, "Draft to proposal on mobile went 404");
    let inbox = api::read_inbox(repo.path()).unwrap();
    let (after, path) = api::attach_note_images(
        repo.path(),
        &id,
        &[
            note_image("phone.png", "one.png"),
            note_image("desktop.png", "two.png"),
        ],
        &inbox.hash,
    )
    .unwrap();

    let folder = path.trim_end_matches("note.md");
    let expected = vec![
        format!("{folder}images/one.webp"),
        format!("{folder}images/two.webp"),
    ];
    for inbox in [after, api::read_inbox(repo.path()).unwrap()] {
        let notes: Vec<_> = inbox
            .categories
            .iter()
            .flat_map(|category| &category.notes)
            .collect();
        let with = notes.iter().find(|note| note.file.is_some()).unwrap();
        assert_eq!(with.images, expected);
        assert!(
            notes
                .iter()
                .filter(|note| note.file.is_none())
                .all(|note| note.images.is_empty())
        );
    }
}

/// A committed note file edited since: its note's removal with a commit keeps it, with the edits,
/// out of the commit, as removing it would lose them.
#[test]
fn a_committed_note_file_edited_since_survives_its_notes_removal_and_commit() {
    let repo = fixture_repo();
    add_with_image(&repo);
    api::commit_changes(repo.path()).unwrap();
    let edited = repo
        .read(&note_file())
        .replace("## Why\n", "## Why\n\nMy eyes.\n");
    repo.write(&note_file(), &edited);
    let (note, _) = noted(&repo);
    let hash = api::read_inbox(repo.path()).unwrap().hash;

    api::remove_note_and_commit(repo.path(), &note.id, &hash).unwrap();

    assert_eq!(repo.read(&note_file()), edited);
    assert_eq!(repo.changed_in("main"), [INBOX]);
}

/// The proposal file the notes go into, committed.
const LISTENER: &str = "specs/proposals/git-listener.md";

/// A note with a note file added to a proposal file goes into its `## Notes`, its image beside it,
/// the single proposal file made a folder for it, and its note file leaves; Undo puts the note file
/// back, and the proposal file as it was. Committed or not before, the commit holds the proposal
/// file's folder and its image.
#[test]
fn a_note_file_goes_into_the_notes_of_a_proposal_file_with_its_image() {
    for committed in [false, true] {
        let repo = fixture_repo();
        repo.write(
            LISTENER,
            &fixture_text("repo/main/specs/proposals/git-listener.md"),
        );
        repo.commit("chore: listener");
        add_with_image(&repo);
        if committed {
            api::commit_changes(repo.path()).unwrap();
        }
        let written = repo.read(&note_file());
        let (note, index) = noted(&repo);
        let hash = api::read_inbox(repo.path()).unwrap().hash;

        let moved = api::note_into_proposal(repo.path(), &note.id, LISTENER, &hash).unwrap();

        assert_eq!(moved, "specs/proposals/git-listener/proposal.md");
        assert!(!repo.exists(&format!("specs/notes/{SLUG}")));
        assert!(!repo.exists(LISTENER));
        assert!(
            repo.read(&moved).ends_with(&format!(
                "## Notes\n\n### {NOTE}\n\n#### What\n\n{NOTE}\n\n{LINK}\n"
            )),
            "{}",
            repo.read(&moved)
        );

        let inbox = api::undo_note_into_proposal(
            repo.path(),
            LISTENER,
            &note.lines,
            Some("UI".into()),
            index,
        )
        .unwrap();

        assert_eq!(repo.read(&note_file()), written);
        assert_eq!(
            repo.read(LISTENER),
            fixture_text("repo/main/specs/proposals/git-listener.md")
        );
        assert!(!repo.exists("specs/proposals/git-listener"));

        api::note_into_proposal(repo.path(), &note.id, LISTENER, &inbox.hash).unwrap();
        api::commit_changes(repo.path()).unwrap();

        let changed = repo.changed_in("main");
        let image = "specs/proposals/git-listener/images/spec-headings.webp";
        for path in [LISTENER, image, moved.as_str()] {
            assert!(changed.iter().any(|c| c == path), "{committed} {changed:?}");
        }
        assert_eq!(
            changed.contains(&note_file()),
            committed,
            "{committed} {changed:?}"
        );
        assert_eq!(repo.porcelain(), "", "{committed}");
    }
}

/// Adds a second note linking the note file of the first, committed.
fn share_note_file(repo: &TestRepo) {
    add_with_image(repo);
    let text = repo.read(INBOX).replace(
        "\n## CLI",
        &format!("- [Also {NOTE}](notes/{SLUG}/note.md)\n\n## CLI"),
    );
    repo.write(INBOX, &text);
    api::commit_changes(repo.path()).unwrap();
}

/// A note sharing its note file with another moves to the priorities as text, and its removal
/// leaves the file: the other note still links it.
#[test]
fn a_shared_note_file_stays_for_the_other_note() {
    let moved = fixture_repo();
    share_note_file(&moved);

    move_to_next(&moved);

    assert!(moved.exists(&note_file()));
    assert!(
        moved
            .read("specs/PRIORITIES.md")
            .contains(&format!("- [{NOTE}](notes/{SLUG}/note.md)\n"))
    );

    let removed = fixture_repo();
    share_note_file(&removed);
    let (note, _) = noted(&removed);
    let hash = api::read_inbox(removed.path()).unwrap().hash;

    api::remove_note(removed.path(), &note.id, &hash).unwrap();

    assert!(removed.exists(&note_file()));
}

/// A note with a note file removed and committed alone is named in the subject by its file's
/// title, not by its link's markdown.
#[test]
fn a_note_with_a_file_removed_and_committed_is_named_by_its_title() {
    let repo = fixture_repo();
    add_with_image(&repo);
    api::commit_changes(repo.path()).unwrap();
    let (note, _) = noted(&repo);
    let hash = api::read_inbox(repo.path()).unwrap().hash;

    api::remove_note_and_commit(repo.path(), &note.id, &hash).unwrap();

    assert_eq!(
        repo.subjects("main")[0],
        format!("chore: remove \"{NOTE}\" from the inbox")
    );
}
