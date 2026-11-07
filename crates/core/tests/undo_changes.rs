//! A write recorded as a change: undo writes back what each file held before it, and redo what it
//! left, never through git, and each refuses once a file of the change holds something else.

mod common;

use common::repo::TestRepo;
use uraeda_core::api;
use uraeda_core::api::undo::{self, Direction};
use uraeda_core::files::inbox::Inbox;

const INBOX: &str = "specs/INBOX.md";
const PRIORITIES: &str = "specs/PRIORITIES.md";
const NOTE: &str = "Draft to proposal on mobile went 404";

fn fixture_text(path: &str) -> String {
    std::fs::read_to_string(common::fixture(path)).unwrap()
}

/// A repository on `main` with the fixture's `INBOX.md` and `PRIORITIES.md`, committed.
fn fixture_repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    for name in ["INBOX.md", "PRIORITIES.md", "proposals/git-listener.md"] {
        repo.write(
            &format!("specs/{name}"),
            &fixture_text(&format!("repo/main/specs/{name}")),
        );
    }
    repo.commit("chore: specs");
    repo
}

fn note_id(inbox: &Inbox, text: &str) -> String {
    inbox
        .categories
        .iter()
        .flat_map(|category| &category.notes)
        .find(|note| note.text.contains(text))
        .unwrap_or_else(|| panic!("no note {text}"))
        .id
        .clone()
}

fn commit_count(repo: &TestRepo) -> String {
    repo.git(&["rev-list", "--count", "HEAD"])
}

/// Records the move of "Claude Code runner" from Next to the top of Now.
fn recorded_move(repo: &TestRepo) -> undo::Change {
    let priorities = api::read_priorities(repo.path()).unwrap();
    let (_, change) = undo::recorded(repo.path(), undo::PRIORITIES, || {
        api::move_proposal(repo.path(), "next-1", "now", 0, &priorities.hash)
    })
    .unwrap();
    change
}

#[test]
fn undo_and_redo_of_a_move_put_the_file_back_then_forward() {
    let repo = fixture_repo();
    let before = repo.read(PRIORITIES);
    let change = recorded_move(&repo);
    let after = repo.read(PRIORITIES);
    assert_ne!(before, after);
    assert_eq!(change.files.len(), 1);
    assert_eq!(change.files[0].path, PRIORITIES);

    undo::apply_change(repo.path(), &change, Direction::Undo, "Claude Code runner").unwrap();
    assert_eq!(repo.read(PRIORITIES), before);

    undo::apply_change(repo.path(), &change, Direction::Redo, "Claude Code runner").unwrap();
    assert_eq!(repo.read(PRIORITIES), after);
}

/// Review focus 1: a change across two files, one changed since, writes nothing back.
#[test]
fn undo_refuses_once_a_file_changed_since_writing_nothing() {
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();
    let id = note_id(&inbox, NOTE);
    let (_, change) = undo::recorded(repo.path(), undo::PROMOTION, || {
        api::note_to_proposal(repo.path(), &id, "next", &inbox.hash, &priorities.hash)
    })
    .unwrap();
    assert_eq!(change.files.len(), 2);
    let promoted_inbox = repo.read(INBOX);
    let edited = repo
        .read(PRIORITIES)
        .replace("Claude Code runner", "A runner");
    repo.write(PRIORITIES, &edited);

    let error = undo::apply_change(repo.path(), &change, Direction::Undo, NOTE).unwrap_err();

    assert_eq!(error.code, "conflict");
    assert_eq!(
        error.message,
        format!("Could not undo: “{NOTE}” changed since in PRIORITIES.md.")
    );
    assert_eq!(repo.read(INBOX), promoted_inbox);
    assert_eq!(repo.read(PRIORITIES), edited);
    let redo = undo::apply_change(repo.path(), &change, Direction::Redo, NOTE).unwrap_err();
    assert_eq!(
        redo.message,
        format!("Could not redo: “{NOTE}” changed since in INBOX.md.")
    );
}

/// Review focus 2: a note file's image, never committed, comes back with its bytes.
#[test]
fn a_note_deleted_with_its_folder_comes_back_with_its_image() {
    let repo = fixture_repo();
    let note = "A note with a shot";
    let read = api::read_inbox(repo.path()).unwrap();
    let shot = std::fs::read(common::fixture("images/phone.png")).unwrap();
    let images = [(shot, Some("shot.png".to_string()))];
    let (_, file) =
        api::add_note_with_images(repo.path(), None, None, note, &images, &read.hash).unwrap();
    let folder = file.trim_end_matches("/note.md").to_string();
    let files = |repo: &TestRepo| -> Vec<(String, Vec<u8>)> {
        let mut files: Vec<_> = walk(&repo.path().join(&folder))
            .into_iter()
            .map(|path| {
                let bytes = std::fs::read(&path).unwrap();
                (path.display().to_string(), bytes)
            })
            .collect();
        files.sort();
        files
    };
    let (inbox, written) = (repo.read(INBOX), files(&repo));
    assert!(written.iter().any(|(path, _)| path.contains("/images/")));

    let read = api::read_inbox(repo.path()).unwrap();
    let id = note_id(&read, note);
    let (_, change) = undo::recorded(repo.path(), undo::NOTES, || {
        api::remove_note(repo.path(), &id, &read.hash)
    })
    .unwrap();
    assert!(!repo.read(INBOX).contains(note));
    assert!(!repo.exists(&folder));

    undo::apply_change(repo.path(), &change, Direction::Undo, note).unwrap();

    assert_eq!(repo.read(INBOX), inbox);
    assert_eq!(files(&repo), written);
}

/// The files under `dir`, at any depth.
fn walk(dir: &std::path::Path) -> Vec<std::path::PathBuf> {
    std::fs::read_dir(dir)
        .unwrap()
        .flatten()
        .flat_map(|entry| match entry.path() {
            path if path.is_dir() => walk(&path),
            path => vec![path],
        })
        .collect()
}

/// SC-004: no git command commits, resets, or reverts.
#[test]
fn undo_and_redo_write_files_and_never_commit() {
    let repo = fixture_repo();
    let (count, head) = (commit_count(&repo), repo.git(&["rev-parse", "HEAD"]));
    let change = recorded_move(&repo);

    let undone = undo::apply_change(repo.path(), &change, Direction::Undo, "runner").unwrap();
    assert_eq!(repo.porcelain(), "");
    let redone = undo::apply_change(repo.path(), &change, Direction::Redo, "runner").unwrap();

    assert_eq!(commit_count(&repo), count);
    assert_eq!(repo.git(&["rev-parse", "HEAD"]), head);
    assert_eq!(undone.as_deref(), Some(head.trim()));
    assert_eq!(redone.as_deref(), Some(head.trim()));
    assert_eq!(change.commit.as_deref(), Some(head.trim()));
    assert_eq!(repo.porcelain(), " M specs/PRIORITIES.md\n");
}

#[test]
fn committed_since_false_until_a_commit_touches_the_files() {
    let repo = fixture_repo();
    let change = recorded_move(&repo);
    assert!(!undo::committed_since(repo.path(), &change).unwrap());

    repo.write("specs/README.md", "# Specs, again\n");
    repo.git(&["add", "specs/README.md"]);
    repo.git(&["commit", "-q", "--no-verify", "-m", "docs: readme"]);
    assert!(!undo::committed_since(repo.path(), &change).unwrap());

    repo.commit("chore: priorities");
    assert!(undo::committed_since(repo.path(), &change).unwrap());
}

/// A change handed back by the web UI may name any path: one outside `specs/` is refused.
#[test]
fn a_change_naming_a_path_outside_specs_is_refused() {
    let repo = fixture_repo();
    let mut change = recorded_move(&repo);
    change.files[0].path = "specs/../outside.md".to_string();

    let error = undo::apply_change(repo.path(), &change, Direction::Undo, "x").unwrap_err();

    assert_eq!(error.code, "refused");
    assert!(!repo.path().join("outside.md").exists());
}

/// A hidden file in the scope, as a note folder's `.DS_Store`, is undone and redone with the rest.
#[test]
fn a_note_folder_holding_a_hidden_file_is_undone_and_redone() {
    let repo = fixture_repo();
    let note = "A note with a hidden file";
    let read = api::read_inbox(repo.path()).unwrap();
    let shot = std::fs::read(common::fixture("images/phone.png")).unwrap();
    let images = [(shot, Some("shot.png".to_string()))];
    let (_, file) =
        api::add_note_with_images(repo.path(), None, None, note, &images, &read.hash).unwrap();
    let folder = file.trim_end_matches("/note.md").to_string();
    let hidden = format!("{folder}/.DS_Store");
    repo.write(&hidden, "finder");
    // Committed, the folder is as git keeps it: its removal deletes it, hidden file and all.
    repo.commit("docs: a note");
    let inbox = repo.read(INBOX);

    let read = api::read_inbox(repo.path()).unwrap();
    let id = note_id(&read, note);
    let (_, change) = undo::recorded(repo.path(), undo::NOTES, || {
        api::remove_note(repo.path(), &id, &read.hash)
    })
    .unwrap();
    assert!(change.files.iter().any(|file| file.path == hidden));
    assert!(!repo.exists(&folder));

    undo::apply_change(repo.path(), &change, Direction::Undo, note).unwrap();
    assert_eq!(repo.read(INBOX), inbox);
    assert_eq!(repo.read(&hidden), "finder");

    undo::apply_change(repo.path(), &change, Direction::Redo, note).unwrap();
    assert!(!repo.exists(&folder));
}
