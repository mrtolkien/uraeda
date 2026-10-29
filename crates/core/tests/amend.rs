//! A tool's commit of proposal files, note files, the inbox, or the priorities amends the latest
//! commit when it holds only those files too, and nothing else holds it: one commit for a run of
//! small edits, as the change `2026-10-29-amend-latest` asks.

mod common;

use common::repo::TestRepo;
use uraeda_core::actions::inbox::{self, Marks, Noted};
use uraeda_core::actions::{ActionError, Committed, place, priorities, text};
use uraeda_core::git::Git;

/// A repository on `main` whose latest commit holds `specs/README.md` too, so it is never amended.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/INBOX.md", "# Inbox\n\n- Kept\n");
    repo.commit("chore: specs");
    repo
}

fn main_place(repo: &TestRepo) -> place::Place {
    place::reach(&Git::discover(repo.path()).unwrap(), "main").unwrap()
}

/// Adds a note and commits it alone, as `ura note` does.
fn note(repo: &TestRepo, text: &str) -> Result<Committed, ActionError> {
    let marks = Marks {
        agent: false,
        about: None,
    };
    match inbox::note(&main_place(repo), None, &marks, text, true)? {
        Noted::Committed(committed) => Ok(committed),
        other => panic!("not committed: {other:?}"),
    }
}

fn body(repo: &TestRepo) -> String {
    repo.git(&["log", "-1", "--format=%b", "main"])
        .trim_end()
        .to_string()
}

#[test]
fn a_note_amends_the_latest_note() {
    let repo = repo();
    note(&repo, "An idea").unwrap();

    let committed = note(&repo, "Another idea").unwrap();

    assert_eq!(
        repo.subjects("main"),
        [
            "chore: add \"An idea\" to the inbox, and 1 more",
            "chore: specs",
            "chore: start"
        ]
    );
    assert_eq!(
        body(&repo),
        "- Add \"An idea\" to the inbox\n- Add \"Another idea\" to the inbox"
    );
    assert_eq!(
        committed.change.subject,
        "chore: add \"An idea\" to the inbox, and 1 more"
    );
    assert_eq!(
        repo.read("specs/INBOX.md"),
        "# Inbox\n\n- Kept\n- An idea\n- Another idea\n"
    );
    assert_eq!(repo.porcelain(), "");
    // The amend runs the hooks, as every commit does.
    assert_eq!(repo.hook_runs(), 2);
}

/// The commit bar's changes join the list of the commit they amend, each on its line.
#[test]
fn the_commit_bar_extends_the_list_of_the_latest_commit() {
    let repo = repo();
    note(&repo, "An idea").unwrap();
    note(&repo, "Another idea").unwrap();
    let place = main_place(&repo);
    let read = inbox::read(&place);
    inbox::add(&place, None, &Marks::default(), "A third", Some(&read.hash)).unwrap();
    let read = priorities::read(&place);
    priorities::add(
        &place,
        uraeda_core::files::priorities::Section::Next,
        "Later",
        &read.hash,
    )
    .unwrap();

    priorities::commit(&place).unwrap();

    assert_eq!(
        repo.subjects("main")[..2],
        [
            "chore: add \"An idea\" to the inbox, and 3 more",
            "chore: specs"
        ]
    );
    assert_eq!(
        body(&repo),
        "- Add \"An idea\" to the inbox\n- Add \"Another idea\" to the inbox\n\
         - Add to the inbox: A third\n- Add to Next: Later"
    );
}

/// A proposal file's commit, from its editor, amends as the lists' do.
#[test]
fn a_proposal_file_amends_the_latest_note() {
    let repo = repo();
    note(&repo, "An idea").unwrap();
    repo.write(
        "specs/proposals/dark-mode.md",
        "# Dark mode\n\nA dark theme.\n",
    );

    text::commit(&main_place(&repo), "specs/proposals/dark-mode.md").unwrap();

    assert_eq!(
        repo.subjects("main")[..2],
        [
            "chore: add \"An idea\" to the inbox, and 1 more",
            "chore: specs"
        ]
    );
    assert_eq!(
        repo.changed_in("main"),
        ["specs/INBOX.md", "specs/proposals/dark-mode.md"]
    );
}

/// A pushed commit would need a force-push once amended: the next note is a commit of its own.
#[test]
fn a_pushed_commit_is_not_amended() {
    let repo = repo();
    note(&repo, "An idea").unwrap();
    repo.push("main");

    note(&repo, "Another idea").unwrap();

    assert_eq!(
        repo.subjects("main")[..2],
        [
            "chore: add \"Another idea\" to the inbox",
            "chore: add \"An idea\" to the inbox"
        ]
    );
}

/// A branch started from the latest commit keeps it: amending it would put the commit twice in the
/// history once the branch is merged.
#[test]
fn a_commit_another_branch_holds_is_not_amended() {
    let repo = repo();
    note(&repo, "An idea").unwrap();
    repo.branch("2026-10-29-dark-mode");

    note(&repo, "Another idea").unwrap();

    assert_eq!(repo.subjects("main").len(), 4);
}

#[test]
fn a_commit_holding_other_files_is_not_amended() {
    let repo = repo();
    repo.write("specs/INBOX.md", "# Inbox\n\n- An idea\n");
    repo.write("README.md", "# Changed\n");
    repo.commit("chore: an idea and the readme");

    note(&repo, "Another idea").unwrap();

    assert_eq!(repo.subjects("main").len(), 4);
}

/// The human's own commit of the same files, typed or scoped otherwise, keeps its message.
#[test]
fn a_commit_other_than_an_unscoped_chore_is_not_amended() {
    let repo = repo();
    for (index, subject) in ["docs: next steps", "chore(dark-mode): proposal"]
        .iter()
        .enumerate()
    {
        repo.write(
            "specs/PRIORITIES.md",
            &format!("# Priorities\n\n## Now\n\n- {index}\n"),
        );
        repo.commit(subject);

        note(&repo, &format!("Idea {index}")).unwrap();

        assert_eq!(repo.subjects("main")[1], *subject);
    }
}

/// A body written by hand, not a list of changes, keeps its commit.
#[test]
fn a_commit_with_a_written_body_is_not_amended() {
    let repo = repo();
    repo.write("specs/INBOX.md", "# Inbox\n\n- An idea\n");
    repo.git(&[
        "commit",
        "--quiet",
        "--all",
        "--message",
        "chore: an idea",
        "--message",
        "Why it matters.",
    ]);

    note(&repo, "Another idea").unwrap();

    assert_eq!(repo.subjects("main")[1], "chore: an idea");
}

/// A commit undoing the whole latest commit would leave it empty: it is a commit of its own.
#[test]
fn an_undo_of_the_whole_latest_commit_is_not_amended() {
    let repo = repo();
    note(&repo, "An idea").unwrap();
    let place = main_place(&repo);
    let read = inbox::read(&place);
    inbox::remove(&place, "note-2", Some(&read.hash)).unwrap();

    priorities::commit(&place).unwrap();

    assert_eq!(
        repo.subjects("main")[..2],
        [
            "chore: remove \"An idea\" from the inbox",
            "chore: add \"An idea\" to the inbox"
        ]
    );
    assert_eq!(repo.read("specs/INBOX.md"), "# Inbox\n\n- Kept\n");
}

/// Only the default branch's commits are amended: a branch's commits are its steps' record.
#[test]
fn a_commit_off_the_default_branch_is_not_amended() {
    let repo = repo();
    repo.switch_new("2026-10-29-dark-mode");
    let place = place::reach(&Git::discover(repo.path()).unwrap(), "2026-10-29-dark-mode").unwrap();
    let marks = Marks::default();
    inbox::note(&place, None, &marks, "An idea", true).unwrap();

    inbox::note(&place, None, &marks, "Another idea", true).unwrap();

    assert_eq!(repo.subjects("2026-10-29-dark-mode").len(), 4);
}
