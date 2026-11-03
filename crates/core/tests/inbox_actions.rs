mod common;

use common::repo::TestRepo;
use uraeda_core::actions::inbox::{self as actions, Marks};
use uraeda_core::actions::{ActionError, changes, place};
use uraeda_core::api;
use uraeda_core::git::Git;

const INBOX: &str = "specs/INBOX.md";

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

fn main_place(repo: &TestRepo) -> place::Place {
    place::reach(&Git::discover(repo.path()).unwrap(), "main").unwrap()
}

/// US1 1: a note added to a category is its last note. The priorities' hash differs from the
/// inbox's, so a check against it refuses this add.
#[test]
fn a_note_is_added_last_in_its_category() {
    let repo = fixture_repo();
    let read = api::read_inbox(repo.path()).unwrap();

    let added = api::add_note(
        repo.path(),
        Some("UI".into()),
        None,
        "The plan's task list scrolls under the top bar",
        &read.hash,
    )
    .unwrap();

    assert!(repo.read(INBOX).contains(
        "- Text input feels laggy on the sessions page\n\
         - The plan's task list scrolls under the top bar\n\n## CLI"
    ));
    assert_eq!(added.count, 11);
    assert_eq!(added.changes, 1);
    assert_eq!(api::read_inbox(repo.path()).unwrap(), added);
}

/// A blank category is no category: the note goes with the notes without one, under no heading of
/// no name.
#[test]
fn a_note_added_to_a_blank_category_has_none() {
    let repo = fixture_repo();
    let before = repo.read(INBOX);
    let read = api::read_inbox(repo.path()).unwrap();

    api::add_note(repo.path(), Some("  ".into()), None, "Loose", &read.hash).unwrap();

    let after = repo.read(INBOX);
    assert!(!after.contains("## \n"), "{after}");
    assert!(!after.contains("##  \n"), "{after}");
    let expected = api::read_inbox(repo.path()).unwrap();
    let loose = expected
        .categories
        .iter()
        .find(|category| category.name.is_none())
        .unwrap();
    assert!(
        loose.notes.iter().any(|note| note.text == "Loose"),
        "{after}"
    );
    assert_ne!(after, before);
}

/// US1 6: the first note creates the file.
#[test]
fn the_first_note_creates_the_inbox() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    let read = api::read_inbox(repo.path()).unwrap();
    assert_eq!(read.count, 0);

    api::add_note(repo.path(), None, None, "A first note", &read.hash).unwrap();

    assert_eq!(repo.read(INBOX), "# Inbox\n\n- A first note\n");
}

/// US1 4: a note added from a feature's page is marked with its slug, not its folder.
#[test]
fn a_note_about_a_feature_is_marked_with_its_slug() {
    let repo = fixture_repo();
    let read = api::read_inbox(repo.path()).unwrap();

    api::add_note(
        repo.path(),
        None,
        Some("2026-10-14-run-ui".into()),
        "The x is not centered",
        &read.hash,
    )
    .unwrap();

    assert!(
        repo.read(INBOX)
            .contains("- We need a home icon\n- [run-ui] The x is not centered\n\n## UI")
    );
}

/// The CLI's add: marks of its own, and no hash to check.
#[test]
fn an_agents_note_is_added_without_a_hash() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    let marks = Marks {
        agent: true,
        about: Some("session-view".into()),
    };

    actions::add(&place, Some("Editor"), &marks, "Scrolling stutters", None).unwrap();

    assert!(
        repo.read(INBOX)
            .ends_with("\n## Editor\n\n- [agent] [session-view] Scrolling stutters\n")
    );
    let error = actions::add(&place, None, &marks, "  \n", None).unwrap_err();
    assert_eq!(error.to_string(), "A note needs text.");
}

/// From a feature's checkout, the note lands in the default branch's checkout.
#[test]
fn from_a_feature_branch_notes_go_to_the_default_branchs_worktree() {
    let repo = fixture_repo();
    repo.switch_new("2026-10-15-add-scratchpad");
    let read = api::read_inbox(repo.path()).unwrap();

    api::add_note(
        repo.path(),
        Some("CLI".into()),
        None,
        "Status hangs on a broken worktree",
        &read.hash,
    )
    .unwrap();

    assert!(
        repo.read(".worktrees/main/specs/INBOX.md")
            .ends_with("- Status hangs on a broken worktree\n")
    );
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
    assert_eq!(repo.current_branch(), "2026-10-15-add-scratchpad");
}

#[test]
fn an_edit_over_a_change_made_elsewhere_is_refused() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    let read = actions::read(&place);
    repo.write(INBOX, &repo.read(INBOX).replace("home icon", "home button"));
    let marks = Marks {
        agent: false,
        about: None,
    };

    let error = actions::add(&place, None, &marks, "An idea", Some(&read.hash)).unwrap_err();

    assert_eq!(
        error.to_string(),
        "INBOX.md changed on disk. Your change was not applied."
    );
    assert!(matches!(error, ActionError::Refused(_)));
    let error = api::add_note(repo.path(), None, None, "An idea", &read.hash).unwrap_err();
    assert_eq!(error.code, "conflict");
    assert!(!repo.read(INBOX).contains("An idea"));
}

/// US1 7: Undo of a removal puts the note back, byte for byte.
#[test]
fn remove_then_insert_restores_the_bytes() {
    let repo = fixture_repo();
    let before = repo.read(INBOX);
    let read = api::read_inbox(repo.path()).unwrap();
    let note = &read.categories[1].notes[2];
    assert_eq!(note.text, "Icons are blurry on retina screens");

    let removed = api::remove_note(repo.path(), &note.id, &read.hash).unwrap();
    assert_eq!(removed.count, 9);
    api::insert_note(
        repo.path(),
        Some("UI".into()),
        2,
        &note.lines,
        &removed.hash,
    )
    .unwrap();

    assert_eq!(repo.read(INBOX), before);
}

/// A note's text edited, and moved to another category, with its marks kept.
#[test]
fn a_note_is_edited_and_moved() {
    let repo = fixture_repo();
    let read = api::read_inbox(repo.path()).unwrap();
    let id = &read.categories[1].notes[0].id;

    let edited = api::edit_note(repo.path(), id, "The x is off center", &read.hash).unwrap();
    api::move_note_to_category(repo.path(), id, Some("CLI".into()), &edited.hash).unwrap();

    assert!(
        repo.read(INBOX)
            .ends_with("- Make sure agents are resumable\n- [run-ui] The x is off center\n")
    );
    let read = api::read_inbox(repo.path()).unwrap();
    let error = api::remove_note(repo.path(), "note-99", &read.hash).unwrap_err();
    assert_eq!(error.code, "refused");
}

/// The triage's status, read from `INBOX-TRIAGE.md` next to the inbox.
#[test]
fn the_triage_status_is_read() {
    let repo = fixture_repo();
    assert_eq!(api::read_inbox(repo.path()).unwrap().triage, None);

    repo.write("specs/INBOX-TRIAGE.md", &fixture_text("INBOX-TRIAGE.md"));

    assert_eq!(
        api::read_inbox(repo.path()).unwrap().triage.as_deref(),
        Some("awaiting-human")
    );
    assert_eq!(
        actions::read(&main_place(&repo)).triage.as_deref(),
        Some("awaiting-human")
    );
}

/// A mark must parse back: a folder whose slug is not lowercase letters, digits, and `-` is
/// refused, and nothing is written.
#[test]
fn a_note_about_a_folder_that_is_not_a_slug_is_refused() {
    let repo = fixture_repo();
    let before = repo.read(INBOX);
    let read = api::read_inbox(repo.path()).unwrap();

    for folder in ["2026-10-14-Run UI", "2026-10-14-a]b"] {
        let error = api::add_note(repo.path(), None, Some(folder.into()), "A note", &read.hash)
            .unwrap_err();
        assert_eq!(error.code, "refused", "{folder}");
    }
    let marks = Marks {
        agent: false,
        about: Some("Run UI".into()),
    };
    actions::add(&main_place(&repo), None, &marks, "A note", None).unwrap_err();

    assert_eq!(repo.read(INBOX), before);
}

/// Only a missing file reads as empty: one that cannot be read is not overwritten.
#[test]
fn an_unreadable_inbox_is_not_overwritten() {
    let repo = fixture_repo();
    let path = repo.path().join(INBOX);
    std::fs::write(&path, b"# Inbox\n\n- \xff\n").unwrap();

    let error = actions::add(
        &main_place(&repo),
        None,
        &Marks {
            agent: false,
            about: None,
        },
        "A note",
        None,
    )
    .unwrap_err();

    assert!(matches!(error, ActionError::Io(_)), "{error:?}");
    assert_eq!(std::fs::read(&path).unwrap(), b"# Inbox\n\n- \xff\n");
}

/// An Undo with no line to put back has a refusal of its own.
#[test]
fn inserting_no_line_is_refused() {
    let repo = fixture_repo();
    let read = api::read_inbox(repo.path()).unwrap();

    let error = api::insert_note(repo.path(), None, 0, &[], &read.hash).unwrap_err();

    assert_eq!(error.message, "Nothing to put back.");
}

/// Reading from a feature's checkout, with the default branch checked out nowhere, reads its tip
/// and creates no worktree.
#[test]
fn reading_from_a_feature_branch_creates_no_worktree() {
    let repo = fixture_repo();
    repo.switch_new("2026-10-15-add-scratchpad");

    let read = api::read_inbox(repo.path()).unwrap();

    assert_eq!(read.count, 10);
    assert!(!repo.exists(".worktrees/main"));
}

/// Only a save or an edit over a changed file is a conflict, whatever its file.
#[test]
fn only_a_stale_edit_is_a_conflict() {
    let code = |message: &str| api::ApiError::from(ActionError::Refused(message.into())).code;

    assert_eq!(
        code("INBOX.md changed on disk. Your change was not applied."),
        "conflict"
    );
    assert_eq!(code("the branch changed on disk meanwhile"), "refused");
    assert_eq!(
        api::ApiError::from(ActionError::changed("specs/proposals/x.md")).code,
        "conflict"
    );
}

/// Adds `note` to `category` of a repository whose inbox is `text`, without a hash, as the
/// editor's note command does; returns the new text and the note's line.
fn added_at(text: &str, category: Option<&str>, note: &str) -> (String, u32) {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(INBOX, text);
    repo.commit("chore: specs");
    let (inbox, line) =
        api::add_note_at(repo.path(), category.map(String::from), None, note).unwrap();
    assert_eq!(api::read_inbox(repo.path()).unwrap(), inbox);
    (repo.read(INBOX), line)
}

/// The line of the added note, 1-based, from where the add put it: an untitled inbox gets its
/// title, which moves every line down; a new category goes last.
#[test]
fn the_line_of_a_note_added_to_an_untitled_inbox() {
    let (text, line) = added_at("## UI\n\n- a\n", Some("CLI"), "b");
    assert_eq!(text, "# Inbox\n\n## UI\n\n- a\n\n## CLI\n\n- b\n");
    assert_eq!(line, 9);

    let (text, line) = added_at("## UI\n\n- a\n", None, "b");
    assert_eq!(text.lines().nth(line as usize - 1), Some("- b"), "{text}");
    let (text, line) = added_at("## UI\n\n- a\n", Some("UI"), "b");
    assert_eq!(text.lines().nth(line as usize - 1), Some("- b"), "{text}");
    assert_eq!(line, 6);
}

/// CRLF line endings keep their line count, and so the line.
#[test]
fn the_line_of_a_note_added_with_crlf() {
    let (text, line) = added_at(
        "# Inbox\r\n\r\n## UI\r\n\r\n- a\r\n\r\n## CLI\r\n",
        Some("UI"),
        "b",
    );
    assert_eq!(
        text,
        "# Inbox\r\n\r\n## UI\r\n\r\n- a\r\n- b\r\n\r\n## CLI\r\n"
    );
    assert_eq!(line, 6);
}

/// A note whose text is already in its category is the last one, not the first.
#[test]
fn the_line_of_a_note_added_twice() {
    let (text, line) = added_at("# Inbox\n\n## UI\n\n- Same\n- b\n", Some("UI"), "Same");
    assert_eq!(text, "# Inbox\n\n## UI\n\n- Same\n- b\n- Same\n");
    assert_eq!(line, 7);
}

/// The core decides what a page's folder is: one that is no feature's or change's, without its
/// date, marks nothing, and the note is added without a mark.
#[test]
fn a_note_from_a_folder_without_a_date_has_no_mark() {
    let repo = fixture_repo();
    let read = api::read_inbox(repo.path()).unwrap();

    api::add_note(
        repo.path(),
        None,
        Some("run-ui".into()),
        "A note",
        &read.hash,
    )
    .unwrap();

    assert!(
        repo.read(INBOX)
            .contains("- We need a home icon\n- A note\n\n## UI")
    );
}

/// US3 4: "Add and commit" commits a note alone, the other staged files left staged.
#[test]
fn a_note_commits_alone() {
    let repo = fixture_repo();
    repo.write("README.md", "# Test, staged\n");
    repo.git(&["add", "README.md"]);
    let read = api::read_inbox(repo.path()).unwrap();

    let (inbox, added) =
        api::add_note_and_commit(repo.path(), None, None, "Icons are blurry", &read.hash).unwrap();

    assert!(added.committed);
    assert_eq!(
        repo.subjects("main")[0],
        "chore: add \"Icons are blurry\" to the inbox"
    );
    assert_eq!(repo.changed_in("HEAD"), [INBOX]);
    assert_eq!(
        repo.git(&["diff", "--cached", "--name-only"]),
        "README.md\n"
    );
    assert!(repo.read(INBOX).contains("- Icons are blurry\n"));
    assert_eq!(inbox.changes, 0);
}

/// US3 3, for a note: an inbox with other changes gets the note, and no commit.
#[test]
fn a_note_on_a_changed_inbox_is_not_committed() {
    let repo = fixture_repo();
    repo.write(INBOX, &format!("{}- Typed by hand\n", repo.read(INBOX)));
    let read = api::read_inbox(repo.path()).unwrap();

    let (_, added) =
        api::add_note_and_commit(repo.path(), None, None, "Icons are blurry", &read.hash).unwrap();

    assert!(!added.committed);
    assert_eq!(added.reason.as_deref(), Some("other-changes"));
    assert_eq!(repo.subjects("main")[0], "chore: specs");
    assert!(repo.read(INBOX).contains("- Icons are blurry\n"));
}

/// US3 6, for a note: Undo of a committed add commits the note's removal alone; over an inbox
/// changed since, it is refused as a conflict.
#[test]
fn undo_of_a_committed_note_commits_the_removal() {
    let repo = fixture_repo();
    let before = repo.read(INBOX);
    let read = api::read_inbox(repo.path()).unwrap();
    let (added, _) =
        api::add_note_and_commit(repo.path(), None, None, "Icons are blurry", &read.hash).unwrap();
    let lines = ["- Icons are blurry".to_string()];

    let stale = api::undo_committed_note(repo.path(), &lines, &read.hash).unwrap_err();
    assert_eq!(stale.code, "conflict");
    let undone = api::undo_committed_note(repo.path(), &lines, &added.hash).unwrap();

    assert_eq!(
        repo.subjects("main")[0],
        "chore: remove \"Icons are blurry\" from the inbox"
    );
    assert_eq!(repo.changed_in("HEAD"), [INBOX]);
    assert_eq!(repo.read(INBOX), before);
    assert_eq!(undone.changes, 0);
}

/// An inbox staged by the human, its working copy then put back as committed, still has changes:
/// "Add and commit" writes the note without committing, and the staged version stays staged.
#[test]
fn a_note_over_a_staged_inbox_is_not_committed() {
    let repo = fixture_repo();
    let committed = repo.read(INBOX);
    let staged = format!("{committed}- Typed by hand\n");
    repo.write(INBOX, &staged);
    repo.git(&["add", INBOX]);
    repo.write(INBOX, &committed);
    let read = api::read_inbox(repo.path()).unwrap();

    let (_, added) =
        api::add_note_and_commit(repo.path(), None, None, "Icons are blurry", &read.hash).unwrap();

    assert!(!added.committed);
    assert_eq!(added.reason.as_deref(), Some("other-changes"));
    assert_eq!(repo.subjects("main")[0], "chore: specs");
    assert_eq!(repo.git(&["show", &format!(":{INBOX}")]), staged);
    assert!(repo.read(INBOX).contains("- Icons are blurry\n"));
}

/// `ura note` over a staged inbox, its working copy put back as committed, writes the note and
/// commits nothing.
#[test]
fn ura_note_over_a_staged_inbox_is_not_committed() {
    let repo = fixture_repo();
    let committed = repo.read(INBOX);
    let staged = format!("{committed}- Typed by hand\n");
    repo.write(INBOX, &staged);
    repo.git(&["add", INBOX]);
    repo.write(INBOX, &committed);

    let noted = actions::note(
        &main_place(&repo),
        None,
        &Marks {
            agent: false,
            about: None,
        },
        "Icons are blurry",
        true,
    )
    .unwrap();

    assert_eq!(noted, actions::Noted::Uncommitted);
    assert_eq!(repo.subjects("main")[0], "chore: specs");
    assert_eq!(repo.git(&["show", &format!(":{INBOX}")]), staged);
    assert!(repo.read(INBOX).contains("- Icons are blurry\n"));
}

/// US3 2: a note started as a change leaves the inbox in a commit of `INBOX.md` alone; over an
/// inbox read before it changed, it is refused as a conflict.
#[test]
fn a_note_started_as_a_change_leaves_the_inbox_in_its_own_commit() {
    let repo = fixture_repo();
    repo.write("README.md", "Typed by hand\n");
    let read = api::read_inbox(repo.path()).unwrap();

    let (inbox, removed) = api::remove_note_and_commit(repo.path(), "note-3", &read.hash).unwrap();

    assert!(removed.committed);
    assert_eq!(
        repo.subjects("main")[0],
        "chore: remove \"We need a home icon\" from the inbox"
    );
    assert_eq!(repo.changed_in("HEAD"), [INBOX]);
    assert!(!repo.read(INBOX).contains("We need a home icon"));
    assert_eq!(inbox.changes, 0);
    let stale = api::remove_note_and_commit(repo.path(), "note-1", &read.hash).unwrap_err();
    assert_eq!(stale.code, "conflict");
}

/// A note started as a change, from an inbox with other changes, leaves it without a commit.
#[test]
fn a_note_started_from_a_changed_inbox_is_not_committed() {
    let repo = fixture_repo();
    repo.write(INBOX, &format!("{}- Typed by hand\n", repo.read(INBOX)));
    let read = api::read_inbox(repo.path()).unwrap();

    let (_, removed) = api::remove_note_and_commit(repo.path(), "note-3", &read.hash).unwrap();

    assert!(!removed.committed);
    assert_eq!(removed.reason.as_deref(), Some("other-changes"));
    assert_eq!(repo.subjects("main")[0], "chore: specs");
    assert!(!repo.read(INBOX).contains("We need a home icon"));
}

/// SC-002: the inbox read from `main` holds an agent's note file merged there, as its line would.
#[test]
fn read_inbox_lists_an_agents_note_from_main() {
    let repo = fixture_repo();
    repo.write(
        "specs/notes/feature-state-the-workspace-records-running.md",
        "---\nagent: true\nabout: feature-state\ncategory: CLI\n---\n\n# The workspace record's running is read by no view\n",
    );
    repo.commit("chore: an agent's note");

    let read = api::read_inbox(repo.path()).unwrap();

    let cli = read
        .categories
        .iter()
        .find(|c| c.name.as_deref() == Some("CLI"))
        .unwrap();
    let note = cli.notes.last().unwrap();
    assert_eq!(
        note.id,
        "specs/notes/feature-state-the-workspace-records-running.md"
    );
    assert_eq!(
        note.lines,
        [
            "- [agent] [feature-state] [The workspace record's running is read by no view](notes/feature-state-the-workspace-records-running.md)"
        ]
    );
}

const AGENTS_NOTE: &str = "specs/notes/feature-state-the-workspace-records-running.md";

/// The fixture repository with an agent's note file committed in it, in a category `INBOX.md`
/// lacks: `Deferred fixes`.
fn repo_with_agents_note(title: &str) -> (TestRepo, String) {
    let repo = fixture_repo();
    repo.write(
        AGENTS_NOTE,
        &format!(
            "---\nagent: true\nabout: feature-state\ncategory: Deferred fixes\n---\n\n# {title}\n"
        ),
    );
    repo.commit("chore: an agent's note");
    (repo, AGENTS_NOTE.to_string())
}

/// US2 more 2: removing an agent's note deletes its file, in `chore: remove "..." from the inbox`,
/// and leaves `INBOX.md` as it was.
#[test]
fn removing_an_agents_note_deletes_its_file() {
    let (repo, path) = repo_with_agents_note("The workspace record's running is read by no view");
    let read = api::read_inbox(repo.path()).unwrap();

    let (_, removed) = api::remove_note_and_commit(repo.path(), &path, &read.hash).unwrap();

    assert!(removed.committed);
    assert!(!repo.exists(&path));
    assert_eq!(
        repo.subjects("main")[0],
        "chore: remove \"The workspace record's running is read…\" from the inbox"
    );
    assert_eq!(repo.changed_in("HEAD"), [path]);
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
    assert_eq!(repo.porcelain(), "");
}

/// US2 more 2, without committing: the commit bar names the removal, and its commit holds the
/// deleted file.
#[test]
fn the_commit_bar_holds_an_agents_note_removed() {
    let (repo, path) = repo_with_agents_note("The workspace record's running is read by no view");
    let read = api::read_inbox(repo.path()).unwrap();

    let removed = api::remove_note(repo.path(), &path, &read.hash).unwrap();

    assert_eq!(removed.count, read.count - 1);
    assert_eq!(removed.changes, 1);
    let (subject, _) = changes::message(&main_place(&repo));
    assert!(
        subject.contains("remove \"The workspace record's running is read…\" from the inbox"),
        "{subject}"
    );
    api::commit_changes(repo.path()).unwrap();
    assert_eq!(repo.changed_in("HEAD"), [path]);
    assert_eq!(repo.porcelain(), "");
}

/// US2 more 2: Undo of an agent's note's removal writes its line back, linking the file it
/// restores.
#[test]
fn undo_of_an_agents_note_removal_links_its_file() {
    let (repo, path) = repo_with_agents_note("The workspace record's running is read by no view");
    let file = repo.read(&path);
    let read = api::read_inbox(repo.path()).unwrap();
    let note = read
        .categories
        .iter()
        .flat_map(|category| &category.notes)
        .find(|note| note.id == path)
        .unwrap()
        .clone();

    let removed = api::remove_note(repo.path(), &path, &read.hash).unwrap();
    let back = api::insert_note(
        repo.path(),
        Some("Deferred fixes".into()),
        0,
        &note.lines,
        &removed.hash,
    )
    .unwrap();

    assert_eq!(repo.read(&path), file);
    assert!(repo.read(INBOX).ends_with(&format!("{}\n", note.lines[0])));
    assert_eq!(back.count, read.count);
}

/// US2 more 3: a moved agent's note becomes a line linking its file, its `category` dropped; its
/// old id, now that a line links the file, is refused.
#[test]
fn placing_an_agents_note_writes_its_line() {
    let (repo, path) = repo_with_agents_note("The workspace record's running is read by no view");
    let read = api::read_inbox(repo.path()).unwrap();

    let placed = api::place_note(repo.path(), &path, Some("UI".into()), 0, &read.hash).unwrap();

    let ui = placed
        .categories
        .iter()
        .find(|c| c.name.as_deref() == Some("UI"))
        .unwrap();
    assert_eq!(
        ui.notes[0].lines,
        [
            "- [agent] [feature-state] [The workspace record's running is read by no view](notes/feature-state-the-workspace-records-running.md)"
        ]
    );
    assert!(
        !repo.read(&path).contains("category:"),
        "{}",
        repo.read(&path)
    );
    assert!(!repo.read(INBOX).contains("Deferred fixes"));

    let again = api::place_note(repo.path(), &path, Some("CLI".into()), 0, &placed.hash);

    assert_eq!(again.unwrap_err().to_string(), format!("no note {path}"));
    assert_eq!(api::read_inbox(repo.path()).unwrap().hash, placed.hash);
}

/// Review focus 1: the id of an agent's note whose file is gone is refused, and nothing is
/// written.
#[test]
fn an_agents_note_whose_file_is_gone_is_refused() {
    let (repo, path) = repo_with_agents_note("The workspace record's running is read by no view");
    let read = api::read_inbox(repo.path()).unwrap();
    repo.remove(&path);

    let edited = api::edit_note(repo.path(), &path, "Anything", &read.hash);

    assert_eq!(edited.unwrap_err().to_string(), format!("no note {path}"));
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
}

/// An action that refuses once the agent's note is a line takes the line back: nothing is written.
#[test]
fn a_refused_action_on_an_agents_note_writes_nothing() {
    let (repo, path) = repo_with_agents_note("The workspace record's running is read by no view");
    let read = api::read_inbox(repo.path()).unwrap();

    let moved = api::note_into_proposal(repo.path(), &path, "specs/proposals/none.md", &read.hash);

    assert!(moved.is_err());
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
    assert!(repo.exists(&path));
}

/// Edge case "a note file with uncommitted changes stays": removing an agent's note whose file was
/// edited since its commit is refused, naming the file, and nothing is written.
#[test]
fn removing_an_edited_agents_note_is_refused() {
    let (repo, path) = repo_with_agents_note("The workspace record's running is read by no view");
    let edited = format!("{}\nA line the human typed.\n", repo.read(&path));
    repo.write(&path, &edited);
    let read = api::read_inbox(repo.path()).unwrap();

    let removed = api::remove_note_and_commit(repo.path(), &path, &read.hash);

    assert_eq!(
        removed.unwrap_err().to_string(),
        format!("{path} has uncommitted changes: the note was not removed")
    );
    assert_eq!(repo.read(&path), edited);
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
    assert_eq!(repo.subjects("main")[0], "chore: an agent's note");
}

/// Edge case "a note file with uncommitted changes stays", for a file never committed: removing it
/// is refused, and it stays.
#[test]
fn removing_an_untracked_agents_note_is_refused() {
    let repo = fixture_repo();
    let text = "---\nagent: true\n---\n\n# Typed and never committed\n";
    let path = "specs/notes/typed.md";
    repo.write(path, text);
    let read = api::read_inbox(repo.path()).unwrap();

    let removed = api::remove_note(repo.path(), path, &read.hash);

    assert_eq!(
        removed.unwrap_err().to_string(),
        format!("{path} has uncommitted changes: the note was not removed")
    );
    assert_eq!(repo.read(path), text);
}

/// US2 more 2, in a repository without `INBOX.md`: the removal commits the deleted file alone.
#[test]
fn removing_an_agents_note_without_an_inbox_commits_its_deletion() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        AGENTS_NOTE,
        "---\nagent: true\nabout: feature-state\n---\n\n# The workspace record's running is read by no view\n",
    );
    repo.commit("chore: an agent's note");
    let read = api::read_inbox(repo.path()).unwrap();

    let (_, removed) = api::remove_note_and_commit(repo.path(), AGENTS_NOTE, &read.hash).unwrap();

    assert!(removed.committed, "{removed:?}");
    assert_eq!(repo.changed_in("HEAD"), [AGENTS_NOTE]);
    assert!(!repo.exists(INBOX));
    assert_eq!(repo.porcelain(), "");
}

/// US2 more 4: an agent's note made a proposal moves its file among the proposals, its frontmatter
/// left behind: the proposal has one title, and no `agent:`. Its Undo writes the note file back as
/// it was committed.
#[test]
fn an_agents_note_made_a_proposal_leaves_its_frontmatter() {
    let (repo, path) = repo_with_agents_note("The workspace record's running is read by no view");
    let file = repo.read(&path);
    let read = api::read_inbox(repo.path()).unwrap();
    let note = read
        .categories
        .iter()
        .flat_map(|category| &category.notes)
        .find(|note| note.id == path)
        .unwrap()
        .clone();
    let priorities = api::read_priorities(repo.path()).unwrap();

    let proposal =
        api::note_to_proposal_file(repo.path(), &path, "later", &read.hash, &priorities.hash)
            .unwrap();

    let text = repo.read(&proposal);
    assert!(!text.contains("agent:"), "{text}");
    assert!(!text.contains("category:"), "{text}");
    assert_eq!(
        text.lines().filter(|line| line.starts_with("# ")).count(),
        1,
        "{text}"
    );
    assert!(
        text.contains(
            "# The workspace record's running is read by no view\n\n## What\n\nThe workspace record's running is read by no view\n\n## Why"
        ),
        "{text}"
    );

    api::undo_note_to_proposal(
        repo.path(),
        &note.lines,
        Some("Deferred fixes".into()),
        0,
        "later",
        None,
    )
    .unwrap();

    assert_eq!(repo.read(&path), file);
}

/// US2 more 3, in the commit bar: the move of an agent's note is one change, its file's dropped
/// `category` part of it, and Discard puts `INBOX.md` and the file back as `HEAD` has them.
#[test]
fn discarding_a_placed_agents_note_restores_its_file() {
    let (repo, path) = repo_with_agents_note("The workspace record's running is read by no view");
    let file = repo.read(&path);
    let read = api::read_inbox(repo.path()).unwrap();

    let placed = api::place_note(repo.path(), &path, Some("UI".into()), 0, &read.hash).unwrap();

    assert_eq!(placed.changes, 1);
    let (subject, _) = changes::message(&main_place(&repo));
    assert!(!subject.contains("more"), "{subject}");

    changes::discard(&main_place(&repo)).unwrap();

    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
    assert_eq!(repo.read(&path), file);
    assert_eq!(repo.porcelain(), "");
}

/// An action refused once the agent's note is a line, in a repository without `INBOX.md`, leaves
/// no `INBOX.md` behind.
#[test]
fn a_refused_action_without_an_inbox_leaves_no_inbox() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        AGENTS_NOTE,
        "---\nagent: true\nabout: feature-state\n---\n\n# The workspace record's running is read by no view\n",
    );
    repo.commit("chore: an agent's note");
    let read = api::read_inbox(repo.path()).unwrap();

    let moved = api::note_into_proposal(
        repo.path(),
        AGENTS_NOTE,
        "specs/proposals/none.md",
        &read.hash,
    );

    assert!(moved.is_err());
    assert!(!repo.exists(INBOX));
    assert_eq!(repo.porcelain(), "");
}
