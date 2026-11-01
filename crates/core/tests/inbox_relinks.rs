//! Attach and the inbox's moves relink every file of `specs/`: a single proposal file made a
//! folder, a note file merged into a proposal file, and a note file moved among the proposals; and
//! their Undo relinks back, keeping a file edited since.

mod common;

use common::fixture;
use common::repo::TestRepo;
use uraeda_core::api;
use uraeda_core::files::inbox::{Inbox, InboxNote};

const RECORD: &str = "specs/done/2026-10-10-cli-core.md";
const FLOWS: &str = "specs/ui/flows.md";
const SCREENSHOTS: &str = "specs/proposals/inbox-screenshots.md";
const LOOK: &str = "specs/proposals/look.md";
const DARK: &str = "specs/notes/dark/note.md";
const CONTRAST: &str = "specs/notes/high-contrast.md";

/// `main` with a record and a guide linking a single proposal file and two note files, all
/// committed.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Next\n\n- [Inbox screenshots](proposals/inbox-screenshots.md)\n",
    );
    repo.write(
        "specs/INBOX.md",
        "# Inbox\n\n## UI\n\n- [Dark](notes/dark/note.md)\n\
         - [High contrast](notes/high-contrast.md)\n",
    );
    repo.write(SCREENSHOTS, "# Inbox screenshots\n\n## Why\n\nTo show.\n");
    repo.write(LOOK, "# Look\n\n## What\n\nA pass.\n");
    repo.write(DARK, "# Dark\n\nIn the evening.\n");
    repo.write(CONTRAST, "# High contrast\n\nFor low vision.\n");
    repo.write(
        RECORD,
        "# CLI core\n\nSee [why](/specs/proposals/inbox-screenshots.md#why), \
         [dark](/specs/notes/dark/note.md), [contrast](../notes/high-contrast.md).\n",
    );
    repo.write(
        FLOWS,
        "# Flows\n\n[Why](/specs/proposals/inbox-screenshots.md#why), \
         [contrast](../notes/high-contrast.md).\n",
    );
    repo.commit("chore: specs");
    repo
}

/// The note whose note file's title is `title`, its category, and its index in it.
fn placed(inbox: &Inbox, title: &str) -> (InboxNote, Option<String>, u32) {
    for category in &inbox.categories {
        let found = category
            .notes
            .iter()
            .position(|note| note.file_title.as_deref() == Some(title));
        if let Some(index) = found {
            let at = u32::try_from(index).unwrap();
            return (category.notes[index].clone(), category.name.clone(), at);
        }
    }
    panic!("no note {title}")
}

/// An attached image relinks every file to the proposal file made a folder; a note merged into a
/// proposal file relinks to its subsection, and its Undo links the note file again; a note file
/// moved among the proposals relinks, and its Undo links it back but in a file edited since. A
/// file edited before a merge is put back by the merge's failure, its Undo, and Discard, and a link
/// to the note's folder follows the note.
#[test]
fn inbox_moves_relink_and_undo_puts_back() {
    let repo = repo();
    let image = std::fs::read(fixture("images/phone.png")).unwrap();

    api::attach_image(repo.path(), SCREENSHOTS, &image, Some("shot.png")).unwrap();

    let folder = "/specs/proposals/inbox-screenshots/proposal.md#why";
    assert!(repo.read(FLOWS).contains(&format!("[Why]({folder})")));
    assert!(repo.read(RECORD).contains(&format!("[why]({folder})")));

    let inbox = api::read_inbox(repo.path()).unwrap();
    let (dark, category, index) = placed(&inbox, "Dark");
    api::note_into_proposal(repo.path(), &dark.id, LOOK, &inbox.hash).unwrap();

    assert!(
        repo.read(RECORD)
            .contains("[dark](/specs/proposals/look.md#dark)"),
        "{}",
        repo.read(RECORD)
    );

    api::undo_note_into_proposal(repo.path(), LOOK, &dark.lines, category, index).unwrap();

    assert!(
        repo.read(RECORD)
            .contains("[dark](/specs/notes/dark/note.md)")
    );

    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();
    let (contrast, category, index) = placed(&inbox, "High contrast");
    api::note_to_proposal(
        repo.path(),
        &contrast.id,
        "next",
        &inbox.hash,
        &priorities.hash,
    )
    .unwrap();

    let moved = "[contrast](../proposals/high-contrast.md)";
    assert!(repo.read(FLOWS).contains(moved), "{}", repo.read(FLOWS));
    assert!(repo.read(RECORD).contains(moved));
    let edited = repo
        .read(RECORD)
        .replace("# CLI core", "# CLI core, read again");
    repo.write(RECORD, &edited);

    api::undo_note_to_proposal(repo.path(), &contrast.lines, category, index, "next", None)
        .unwrap();

    assert!(repo.exists(CONTRAST));
    assert!(
        repo.read(FLOWS)
            .contains("[contrast](../notes/high-contrast.md)")
    );
    assert_eq!(repo.read(RECORD), edited);

    // A merge that makes the proposal file a folder, then fails, puts back a file edited before.
    let failing = self::repo();
    let edited = format!(
        "{}\nAgain, [look](/specs/proposals/look.md).\n",
        failing.read(RECORD)
    );
    failing.write(RECORD, &edited);
    std::fs::create_dir_all(failing.path().join("specs/notes/dark/images")).unwrap();
    std::fs::write(
        failing.path().join("specs/notes/dark/images/sky.png"),
        &image,
    )
    .unwrap();
    let inbox = api::read_inbox(failing.path()).unwrap();
    let (dark, category, index) = placed(&inbox, "Dark");
    let inbox_file = failing.path().join("specs/INBOX.md");
    let writable = std::fs::metadata(&inbox_file).unwrap().permissions();
    let mut read_only = writable.clone();
    read_only.set_readonly(true);
    std::fs::set_permissions(&inbox_file, read_only).unwrap();

    let failed = api::note_into_proposal(failing.path(), &dark.id, LOOK, &inbox.hash);

    std::fs::set_permissions(&inbox_file, writable).unwrap();
    assert!(failed.is_err());
    assert!(failing.exists(LOOK));
    assert_eq!(failing.read(RECORD), edited);

    api::note_into_proposal(failing.path(), &dark.id, LOOK, &inbox.hash).unwrap();
    api::undo_note_into_proposal(failing.path(), LOOK, &dark.lines, category, index).unwrap();

    assert!(failing.exists(LOOK));
    assert_eq!(failing.read(RECORD), edited);

    // Discard after a merge puts back a file edited before it, its link to the note's folder too.
    let discarded = self::repo();
    let edited = format!(
        "{}\nThe [folder](/specs/notes/dark/).\n",
        discarded.read(RECORD)
    );
    discarded.write(RECORD, &edited);
    let inbox = api::read_inbox(discarded.path()).unwrap();
    let (dark, ..) = placed(&inbox, "Dark");
    api::note_into_proposal(discarded.path(), &dark.id, LOOK, &inbox.hash).unwrap();

    let merged = discarded.read(RECORD);
    assert!(
        merged.contains("[dark](/specs/proposals/look.md#dark)")
            && merged.contains("[folder](/specs/proposals/look.md#dark)"),
        "{merged}"
    );

    api::discard_changes(discarded.path()).unwrap();

    assert_eq!(discarded.read(RECORD), edited);
}
