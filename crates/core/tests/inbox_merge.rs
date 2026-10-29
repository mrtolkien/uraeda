//! A note with a note file added to a proposal file: the note file's text goes into the proposal
//! file's `## Notes`, under the note's title, its images beside the proposal file, and the note
//! file and its row leave the inbox; Undo puts every one back.

mod common;

use common::repo::TestRepo;
use uraeda_core::actions::{changes, place};
use uraeda_core::api;
use uraeda_core::files::inbox::{Inbox, InboxNote};
use uraeda_core::git::Git;

const INBOX: &str = "specs/INBOX.md";
const PRIORITIES: &str = "specs/PRIORITIES.md";
/// The proposal file the priorities link, a single file.
const LISTENER: &str = "specs/proposals/git-listener.md";
/// A proposal file's folder, which no list links.
const LOOK: &str = "specs/proposals/look/proposal.md";
const LOOK_TEXT: &str = "# Look and feel pass\n\n## What\n\nA pass over the app's spacing.\n";
const DARK: &str = "specs/notes/dark-mode/note.md";
const IMAGE: &str = "specs/notes/dark-mode/images/phone.webp";

fn fixture_text(path: &str) -> String {
    std::fs::read_to_string(common::fixture(path)).unwrap()
}

/// A repository on `main` with the fixture's `INBOX.md`, `PRIORITIES.md`, and the proposal file
/// "Git listener process", and the proposal file folder "Look and feel pass", all committed.
fn fixture_repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    for name in ["INBOX.md", "PRIORITIES.md", "proposals/git-listener.md"] {
        repo.write(
            &format!("specs/{name}"),
            &fixture_text(&format!("repo/main/specs/{name}")),
        );
    }
    repo.write(LOOK, LOOK_TEXT);
    repo.commit("chore: specs");
    repo
}

fn main_place(repo: &TestRepo) -> place::Place {
    place::reach(&Git::discover(repo.path()).unwrap(), "main").unwrap()
}

/// Adds the note "Dark mode" under UI with `phone.png`, as the add form does: a note file folder
/// with the image, linked from the inbox.
fn add_dark_mode(repo: &TestRepo) {
    let inbox = api::read_inbox(repo.path()).unwrap();
    let image = std::fs::read(common::fixture("images/phone.png")).unwrap();
    let (_, file) = api::add_note_with_images(
        repo.path(),
        Some("UI".to_string()),
        None,
        "Dark mode",
        &[(image, Some("phone.png".to_string()))],
        &inbox.hash,
    )
    .unwrap();
    assert_eq!(file, DARK);
}

/// The note whose text, or its note file's title, is `text`, its category, and its index in it.
fn placed(inbox: &Inbox, text: &str) -> (InboxNote, Option<String>, u32) {
    for category in &inbox.categories {
        let found = category
            .notes
            .iter()
            .position(|note| note.text == text || note.file_title.as_deref() == Some(text));
        if let Some(index) = found {
            return (
                category.notes[index].clone(),
                category.name.clone(),
                index as u32,
            );
        }
    }
    panic!("no note {text}")
}

/// Adds the note `text` to the proposal file `proposal` over the inbox as it is: returns the note,
/// its category and index, and the path the proposal file has now.
fn add_to(repo: &TestRepo, text: &str, proposal: &str) -> (InboxNote, Option<String>, u32, String) {
    let inbox = api::read_inbox(repo.path()).unwrap();
    let (note, category, index) = placed(&inbox, text);
    let path = api::note_into_proposal(repo.path(), &note.id, proposal, &inbox.hash).unwrap();
    (note, category, index, path)
}

/// The files the add and its Undo touch, as they are, an image's bytes as text.
fn snapshot(repo: &TestRepo, paths: &[&str]) -> Vec<Option<String>> {
    paths
        .iter()
        .map(|path| {
            let bytes = std::fs::read(repo.path().join(path)).ok()?;
            Some(String::from_utf8_lossy(&bytes).into_owned())
        })
        .collect()
}

/// A folder note with an image goes into a folder proposal file without `## Notes`: the section is
/// added, the note file's text is under the note's title, its headings nested, its image copied
/// beside the proposal file and linked there, and the note file and its row leave. Undo puts all of
/// it back as it was.
#[test]
fn a_folder_note_with_an_image_goes_into_a_new_notes_section_and_undo_puts_it_back() {
    let repo = fixture_repo();
    add_dark_mode(&repo);
    let paths = [INBOX, LOOK, DARK, IMAGE];
    let before = snapshot(&repo, &paths);

    let (note, category, index, path) = add_to(&repo, "Dark mode", LOOK);

    assert_eq!(path, LOOK);
    assert_eq!(
        repo.read(LOOK),
        format!(
            "{LOOK_TEXT}\n## Notes\n\n### Dark mode\n\n\
             ![phone](images/phone.webp)\n"
        )
    );
    assert_eq!(
        snapshot(&repo, &["specs/proposals/look/images/phone.webp"])[0],
        before[3]
    );
    assert!(!repo.exists("specs/notes/dark-mode"));
    assert!(!repo.read(INBOX).contains("Dark mode"));

    let inbox =
        api::undo_note_into_proposal(repo.path(), LOOK, &note.lines, category, index).unwrap();

    assert_eq!(snapshot(&repo, &paths), before);
    assert!(!repo.exists("specs/proposals/look/images"));
    assert_eq!(inbox.changes, 1);
}

/// A single-file note goes into a proposal file that has `## Notes`, after what it holds, and Undo
/// takes it back out, keeping what the human typed meanwhile.
#[test]
fn a_single_file_note_goes_at_the_end_of_notes_and_undo_keeps_the_typing() {
    let repo = fixture_repo();
    let with_notes = format!("{LOOK_TEXT}\n## Notes\n\n- Keep it calm.\n\n## Later\n\nMaybe.\n");
    repo.write(LOOK, &with_notes);
    repo.write(
        "specs/notes/high-contrast.md",
        "# High contrast\n\n## What\n\nFor [low vision](../README.md).\n\n### Colours\n\nBlack.\n",
    );
    let inbox = repo.read(INBOX).replace(
        "\n\n## CLI",
        "\n- [High contrast](notes/high-contrast.md)\n\n## CLI",
    );
    repo.write(INBOX, &inbox);
    repo.commit("chore: a note file");
    let before = snapshot(&repo, &[INBOX, LOOK, "specs/notes/high-contrast.md"]);

    let (note, category, index, path) = add_to(&repo, "High contrast", LOOK);

    assert_eq!(path, LOOK);
    assert_eq!(
        repo.read(LOOK),
        format!(
            "{LOOK_TEXT}\n## Notes\n\n- Keep it calm.\n\n### High contrast\n\n#### What\n\n\
             For [low vision](../../README.md).\n\n##### Colours\n\nBlack.\n\n## Later\n\nMaybe.\n"
        )
    );
    assert!(!repo.exists("specs/notes/high-contrast.md"));
    assert!(!repo.read(INBOX).contains("High contrast"));
    let typed = repo.read(LOOK).replace("Maybe.", "Maybe, later.");
    repo.write(LOOK, &typed);

    api::undo_note_into_proposal(repo.path(), LOOK, &note.lines, category, index).unwrap();

    let after = snapshot(&repo, &[INBOX, LOOK, "specs/notes/high-contrast.md"]);
    assert_eq!(after[0], before[0]);
    assert_eq!(
        repo.read(LOOK),
        with_notes.replace("Maybe.", "Maybe, later.")
    );
    assert_eq!(after[2], before[2]);
}

/// A note with an image goes into a single proposal file, which becomes a folder for the image, as
/// an attached image makes it, the priorities linking its new path. Undo makes it a single file
/// again. Committed, the add holds the folder, its image, and the note file's removal.
#[test]
fn a_note_with_an_image_makes_a_single_proposal_file_a_folder_and_undo_takes_it_back() {
    let repo = fixture_repo();
    add_dark_mode(&repo);
    api::commit_changes(repo.path()).unwrap();
    let paths = [INBOX, PRIORITIES, LISTENER, DARK, IMAGE];
    let before = snapshot(&repo, &paths);
    let folder = "specs/proposals/git-listener/proposal.md";

    let (note, category, index, path) = add_to(&repo, "Dark mode", LISTENER);

    assert_eq!(path, folder);
    assert!(!repo.exists(LISTENER));
    assert!(
        repo.read(folder).ends_with(
            "So agents start without me.\n\n## Notes\n\n### Dark mode\n\n\
             ![phone](images/phone.webp)\n"
        ),
        "{}",
        repo.read(folder)
    );
    assert!(repo.exists("specs/proposals/git-listener/images/phone.webp"));
    assert!(
        repo.read(PRIORITIES)
            .contains("- [Git listener process](proposals/git-listener/proposal.md)\n")
    );

    api::undo_note_into_proposal(repo.path(), LISTENER, &note.lines, category, index).unwrap();

    for (at, (now, then)) in snapshot(&repo, &paths).iter().zip(&before).enumerate() {
        assert_eq!(now, then, "{}", paths[at]);
    }
    assert!(!repo.exists("specs/proposals/git-listener"));

    let (_, _, _, path) = add_to(&repo, "Dark mode", LISTENER);
    api::commit_changes(repo.path()).unwrap();

    let changed = repo.changed_in("main");
    for file in [
        INBOX,
        LISTENER,
        path.as_str(),
        "specs/proposals/git-listener/images/phone.webp",
        DARK,
        IMAGE,
    ] {
        assert!(changed.iter().any(|c| c == file), "{file} {changed:?}");
    }
    assert_eq!(repo.porcelain(), "");
}

/// An image whose name the proposal file's folder has already is copied under a free name, and the
/// moved text links it there.
#[test]
fn an_image_whose_name_is_taken_is_renamed_and_linked() {
    let repo = fixture_repo();
    repo.write("specs/proposals/look/images/phone.webp", "taken");
    repo.commit("chore: an image");
    add_dark_mode(&repo);

    add_to(&repo, "Dark mode", LOOK);

    assert!(repo.read(LOOK).ends_with("![phone](images/phone-2.webp)\n"));
    assert_eq!(repo.read("specs/proposals/look/images/phone.webp"), "taken");
    assert!(repo.exists("specs/proposals/look/images/phone-2.webp"));
}

/// A note file whose folder holds another file than the note and its images is refused, and
/// nothing is written, as with an inbox changed since it was read.
#[test]
fn a_refused_add_writes_nothing() {
    let repo = fixture_repo();
    add_dark_mode(&repo);
    repo.write("specs/notes/dark-mode/draft.txt", "mine");
    let paths = [INBOX, LISTENER, PRIORITIES, DARK, IMAGE];
    let before = snapshot(&repo, &paths);
    let inbox = api::read_inbox(repo.path()).unwrap();
    let (note, _, _) = placed(&inbox, "Dark mode");

    let error = api::note_into_proposal(repo.path(), &note.id, LISTENER, &inbox.hash).unwrap_err();

    assert_eq!(
        error.message,
        "specs/notes/dark-mode holds draft.txt: move it out of the folder first."
    );
    let error = api::note_into_proposal(repo.path(), &note.id, LISTENER, "stale").unwrap_err();
    assert_eq!(error.code, "conflict");
    assert_eq!(snapshot(&repo, &paths), before);
    assert!(!repo.exists("specs/proposals/git-listener"));
}

/// The proposal of Later without a file, with a nested line.
const NIX: &str = "Nix + Docker based execution environments";
/// The file a note with images makes for it: a folder, for the images.
const NIX_FILE: &str = "specs/proposals/nix-docker-based-execution-environments/proposal.md";
/// The proposal of Next without a file.
const RUNNER: &str = "Claude Code runner (triggered manually)";
const RUNNER_FILE: &str = "specs/proposals/claude-code-runner-triggered-manually.md";
/// A note file without images, a single file.
const SLOW: &str = "specs/notes/slow-lists.md";
const SLOW_TEXT: &str = "# Slow lists\n\nOn the home page.\n";

/// Adds the note "Slow lists" under UI, linking its single note file, committed.
fn add_slow_lists(repo: &TestRepo) {
    let inbox = repo
        .read(INBOX)
        .replace("\n## CLI", "- [Slow lists](notes/slow-lists.md)\n\n## CLI");
    repo.write(INBOX, &inbox);
    repo.write(SLOW, SLOW_TEXT);
    repo.commit("chore: slow lists");
}

/// Adds the note `text` to the proposal `id` of the priorities, which has no file, over both lists
/// as they are: returns the note, its category and index, and the new proposal file's path.
fn add_to_line(repo: &TestRepo, text: &str, id: &str) -> (InboxNote, Option<String>, u32, String) {
    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();
    let (note, category, index) = placed(&inbox, text);
    let path =
        api::note_into_proposal_line(repo.path(), &note.id, id, &inbox.hash, &priorities.hash)
            .unwrap();
    (note, category, index, path)
}

/// A note with images added to a proposal line without a file: the line gets its proposal file
/// first, from the template, a folder for the images, the line's nested lines in its What, and
/// links it; the note file's text goes into its `## Notes`, its image beside it, and the note and
/// its note file leave the inbox. Undo puts all of it back: the line as it was, no proposal file,
/// and the note with its note file.
#[test]
fn a_note_goes_into_a_new_proposal_file_for_a_line_and_undo_takes_it_all_back() {
    let repo = fixture_repo();
    add_dark_mode(&repo);
    api::commit_changes(repo.path()).unwrap();
    let paths = [INBOX, PRIORITIES, DARK, IMAGE];
    let before = snapshot(&repo, &paths);

    let (note, category, index, path) = add_to_line(&repo, "Dark mode", "later-1");

    assert_eq!(path, NIX_FILE);
    let text = repo.read(NIX_FILE);
    assert!(text.starts_with("---\ndiscovery: high"), "{text}");
    assert!(
        text.ends_with(&format!(
            "---\n\n# {NIX}\n\n## What\n\n{NIX}\n\n- with a cache\n\n## Why\n\n## Notes\n\n\
             ### Dark mode\n\n![phone](images/phone.webp)\n"
        )),
        "{text}"
    );
    assert!(
        repo.exists("specs/proposals/nix-docker-based-execution-environments/images/phone.webp")
    );
    assert!(repo.read(PRIORITIES).contains(&format!(
        "- [{NIX}](proposals/nix-docker-based-execution-environments/proposal.md)\n- Benchmarks"
    )));
    assert!(!repo.exists("specs/notes/dark-mode"));
    assert!(!repo.read(INBOX).contains("Dark mode"));

    let inbox =
        api::undo_note_into_proposal(repo.path(), &path, &note.lines, category, index).unwrap();

    assert_eq!(snapshot(&repo, &paths), before);
    assert!(!repo.exists("specs/proposals/nix-docker-based-execution-environments"));
    assert_eq!(inbox.changes, 0);
    assert_eq!(repo.porcelain(), "");
}

/// A note file without images makes a single proposal file. The commit bar counts the add as one
/// move to the proposal, and its line's link as part of it; Discard takes all of it back, and
/// Commit holds the new file, both lists, and the note file's removal.
#[test]
fn a_new_proposal_file_for_a_line_is_one_move_that_discard_or_commit_takes() {
    for commit in [false, true] {
        let repo = fixture_repo();
        add_slow_lists(&repo);
        let paths = [INBOX, PRIORITIES, SLOW];
        let before = snapshot(&repo, &paths);

        let (_, _, _, path) = add_to_line(&repo, "Slow lists", "next-1");

        assert_eq!(path, RUNNER_FILE);
        assert!(
            repo.read(RUNNER_FILE).ends_with(&format!(
                "# {RUNNER}\n\n## What\n\n{RUNNER}\n\n## Why\n\n## Notes\n\n### Slow lists\n\n\
                 On the home page.\n"
            )),
            "{}",
            repo.read(RUNNER_FILE)
        );
        let place = main_place(&repo);
        assert_eq!(
            changes::list(&place).lines,
            [format!(
                "- Move from the inbox to the proposal {RUNNER}: Slow lists"
            )]
        );

        if commit {
            api::commit_changes(repo.path()).unwrap();
            let changed = repo.changed_in("main");
            for file in [INBOX, PRIORITIES, RUNNER_FILE, SLOW] {
                assert!(changed.iter().any(|c| c == file), "{file} {changed:?}");
            }
        } else {
            api::discard_changes(repo.path()).unwrap();
            assert_eq!(snapshot(&repo, &paths), before);
            assert!(!repo.exists(RUNNER_FILE));
        }
        assert_eq!(repo.porcelain(), "", "{commit}");
    }
}

/// Discard takes back a new proposal file's folder made for a note with images, its image with it.
#[test]
fn discard_takes_back_a_new_proposal_folder_for_a_line() {
    let repo = fixture_repo();
    add_dark_mode(&repo);
    api::commit_changes(repo.path()).unwrap();
    let paths = [INBOX, PRIORITIES, DARK, IMAGE];
    let before = snapshot(&repo, &paths);
    add_to_line(&repo, "Dark mode", "later-1");

    api::discard_changes(repo.path()).unwrap();

    assert_eq!(snapshot(&repo, &paths), before);
    assert!(!repo.exists("specs/proposals/nix-docker-based-execution-environments"));
    assert_eq!(repo.porcelain(), "");
}

/// An add to a line without a file is refused, and writes nothing, when either list changed since
/// it was read, when the line has a file already, when the note has no note file, or when the note
/// file's folder holds another file.
#[test]
fn a_refused_add_to_a_line_writes_nothing() {
    let repo = fixture_repo();
    add_dark_mode(&repo);
    add_slow_lists(&repo);
    let paths = [INBOX, PRIORITIES, DARK, IMAGE, SLOW];
    let before = snapshot(&repo, &paths);
    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();
    let (slow, _, _) = placed(&inbox, "Slow lists");
    let (dark, _, _) = placed(&inbox, "Dark mode");
    let (plain, _, _) = placed(&inbox, "Text input feels laggy on the sessions page");
    let add = |id: &str, line: &str, hash: &str, priorities_hash: &str| {
        api::note_into_proposal_line(repo.path(), id, line, hash, priorities_hash).unwrap_err()
    };

    assert_eq!(
        add(&slow.id, "next-1", "stale", &priorities.hash).code,
        "conflict"
    );
    assert_eq!(
        add(&slow.id, "next-1", &inbox.hash, "stale").code,
        "conflict"
    );
    let linked = add(&slow.id, "next-2", &inbox.hash, &priorities.hash);
    assert!(
        linked.message.contains("already links"),
        "{}",
        linked.message
    );
    let plain = add(&plain.id, "next-1", &inbox.hash, &priorities.hash);
    assert!(plain.message.contains("no note file"), "{}", plain.message);
    repo.write("specs/notes/dark-mode/draft.txt", "mine");
    let held = add(&dark.id, "later-1", &inbox.hash, &priorities.hash);
    assert_eq!(
        held.message,
        "specs/notes/dark-mode holds draft.txt: move it out of the folder first."
    );

    assert_eq!(snapshot(&repo, &paths), before);
    assert!(!repo.exists(RUNNER_FILE));
    assert!(!repo.exists("specs/proposals/nix-docker-based-execution-environments"));
}

/// Undo keeps a new proposal file the human typed in since, linked from its line, and still puts
/// the note back.
#[test]
fn undo_keeps_a_new_proposal_file_typed_in() {
    let repo = fixture_repo();
    add_slow_lists(&repo);
    let (note, category, index, path) = add_to_line(&repo, "Slow lists", "next-1");
    let typed = repo
        .read(&path)
        .replace("## Why\n", "## Why\n\nSo I can sleep.\n");
    repo.write(&path, &typed);

    api::undo_note_into_proposal(repo.path(), &path, &note.lines, category, index).unwrap();

    assert_eq!(repo.read(SLOW), SLOW_TEXT);
    assert!(
        repo.read(INBOX)
            .contains("- [Slow lists](notes/slow-lists.md)")
    );
    assert!(!repo.read(&path).contains("### Slow lists"));
    assert!(repo.read(&path).contains("So I can sleep."));
    assert!(repo.read(PRIORITIES).contains(&format!(
        "- [{RUNNER}](proposals/claude-code-runner-triggered-manually.md)"
    )));
}

/// The commit bar counts a committed note added to a proposal file as one move, which Discard takes
/// back: the proposal file as committed, the note file and its image back, and nothing left over,
/// for a proposal file's folder and for a single proposal file made a folder.
#[test]
fn an_add_is_one_move_that_discard_takes_back() {
    for proposal in [LOOK, LISTENER] {
        let repo = fixture_repo();
        add_dark_mode(&repo);
        api::commit_changes(repo.path()).unwrap();
        let paths = [INBOX, PRIORITIES, LOOK, LISTENER, DARK, IMAGE];
        let before = snapshot(&repo, &paths);

        add_to(&repo, "Dark mode", proposal);

        let title = match proposal {
            LOOK => "Look and feel pass",
            _ => "Git listener process",
        };
        let place = main_place(&repo);
        // A single proposal file made a folder has its link edited in the priorities too, as an
        // attached image makes it.
        assert_eq!(
            changes::list(&place).lines[0],
            format!("- Move from the inbox to the proposal {title}: Dark mode"),
            "{proposal}"
        );
        assert!(
            changes::message(&place).0.starts_with(&format!(
                "chore: move \"Dark mode\" from the inbox to the proposal {title}"
            )),
            "{proposal}"
        );

        api::discard_changes(repo.path()).unwrap();

        for (at, (now, then)) in snapshot(&repo, &paths).iter().zip(&before).enumerate() {
            assert_eq!(now, then, "{proposal} {}", paths[at]);
        }
        assert_eq!(repo.porcelain(), "", "{proposal}");
    }
}
