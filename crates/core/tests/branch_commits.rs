//! The Commit page's panes: a pane per branch with changes, each committed apart with its message.

mod common;

use std::path::{Path, PathBuf};

use common::repo::{TestRepo, run_git};
use common::texts::{proposal, spec};
use uraeda_core::actions::edited;
use uraeda_core::actions::place::Place;
use uraeda_core::api::{self, BranchPane};

const FOLDER: &str = "2026-10-11-web-ui";
const SPEC: &str = "specs/2026-10-11-web-ui/spec.md";
const PRIORITIES: &str = "specs/PRIORITIES.md";
const PRIORITIES_TEXT: &str = "# Priorities\n\n## Now\n\n- Dark mode\n";
const INBOX: &str = "specs/INBOX.md";
const INBOX_TEXT: &str = "# Inbox\n\n- A first note\n";

/// A repository on `main` with its priorities and inbox, and a feature on its own branch.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write(PRIORITIES, PRIORITIES_TEXT);
    repo.write(INBOX, INBOX_TEXT);
    repo.git(&["add", "."]);
    repo.git(&["commit", "--quiet", "--no-verify", "-m", "chore: specs"]);
    repo.switch_new(FOLDER);
    repo.write(&format!("specs/{FOLDER}/proposal.md"), &proposal());
    repo.write(SPEC, &spec("awaiting-human", 1, 0));
    repo.git(&["add", "specs"]);
    repo.git(&["commit", "--quiet", "--no-verify", "-m", "spec"]);
    repo.switch("main");
    repo
}

fn place(root: &Path) -> Place {
    Place {
        root: root.to_path_buf(),
        created: false,
        switched: None,
    }
}

fn worktree(repo: &TestRepo) -> PathBuf {
    repo.path().join(".worktrees").join(FOLDER)
}

/// Saves `path` in a buffer as `edit` makes its text.
fn save(repo: &TestRepo, path: &str, edit: impl Fn(&str) -> String) {
    let read = api::read_buffer(repo.path(), path).unwrap();
    api::save_buffer(repo.path(), path, &edit(&read.text), &read.hash).unwrap();
}

/// A line under Now of the priorities, and a line more in the feature's spec, both in buffers.
fn two_branches(repo: &TestRepo) {
    save(repo, PRIORITIES, |text| format!("{text}- Global undo\n"));
    save(repo, SPEC, |text| format!("{text}\nNo clock.\n"));
}

/// Break caught: a pane listing an agent's files, or a branch's buffer edits left off the page.
#[test]
fn each_branch_lists_its_buffer_edits() {
    let repo = repo();
    two_branches(&repo);
    // An agent's file in progress in the feature's worktree is not the pane's.
    std::fs::write(
        worktree(&repo).join("specs").join(FOLDER).join("plan.md"),
        "# Plan\n",
    )
    .unwrap();

    let panes = api::branch_changes(repo.path()).unwrap();

    assert_eq!(
        panes,
        vec![
            BranchPane {
                branch: "main".to_string(),
                folder: None,
                count: 1,
                lines: vec!["- Edit specs/PRIORITIES.md".to_string()],
                message: "chore: edit specs/PRIORITIES.md".to_string(),
            },
            BranchPane {
                branch: FOLDER.to_string(),
                folder: Some(FOLDER.to_string()),
                count: 1,
                lines: vec!["- Edit spec.md".to_string()],
                message: "chore(web-ui): edit spec.md".to_string(),
            },
        ]
    );
    // The commit bar's count holds every pane's.
    assert_eq!(api::read_priorities(repo.path()).unwrap().changes, 2);
}

/// Review focus 4. Break caught: structured lines beside a buffer's edit of the same file, or its
/// commit not holding the file as typed.
#[test]
fn a_buffer_edit_is_one_edit_line() {
    let repo = repo();
    let inbox = api::read_inbox(repo.path()).unwrap();
    api::add_note(repo.path(), None, None, "Added by the form", &inbox.hash).unwrap();
    save(&repo, INBOX, |text| {
        text.replace("A first note", "A first note, rewritten")
    });
    let typed = repo.read(INBOX);

    let panes = api::branch_changes(repo.path()).unwrap();

    assert_eq!(panes.len(), 1);
    assert_eq!(panes[0].lines, vec!["- Edit specs/INBOX.md"]);
    assert_eq!(panes[0].message, "chore: edit specs/INBOX.md");
    api::commit_branch(repo.path(), "main", &panes[0].message).unwrap();
    assert_eq!(repo.git(&["show", "main:specs/INBOX.md"]), typed);
    assert_eq!(repo.subjects("main")[0], "chore: edit specs/INBOX.md");
    assert!(edited::list(&place(repo.path())).is_empty());
    assert!(api::branch_changes(repo.path()).unwrap().is_empty());
}

/// Review focus 3 and 5. Breaks caught: a commit on the wrong branch, or with another file of the
/// worktree, and a message rewritten or not trimmed of its blank lines.
#[test]
fn a_branch_commits_alone() {
    let repo = repo();
    two_branches(&repo);
    let untracked = worktree(&repo).join("specs").join(FOLDER).join("plan.md");
    std::fs::write(&untracked, "# Plan\n").unwrap();
    let main_tip = repo.git(&["rev-parse", "main"]);

    api::commit_branch(repo.path(), FOLDER, "chore: drop the clock").unwrap();

    assert_eq!(repo.subjects(FOLDER)[0], "chore: drop the clock");
    assert_eq!(repo.changed_in(FOLDER), [SPEC]);
    assert_eq!(repo.git(&["rev-parse", "main"]), main_tip);
    assert!(untracked.exists());
    assert_eq!(
        run_git(&worktree(&repo), &["status", "--porcelain"]),
        format!("?? specs/{FOLDER}/plan.md\n")
    );
    let panes = api::branch_changes(repo.path()).unwrap();
    assert_eq!(panes.len(), 1);
    assert_eq!(panes[0].branch, "main");

    api::commit_branch(repo.path(), "main", "\n\nchore: add Global undo to Now\n").unwrap();

    assert_eq!(
        repo.git(&["log", "-1", "--format=%B", "main"]).trim_end(),
        "chore: add Global undo to Now"
    );
    assert_eq!(repo.changed_in("main"), [PRIORITIES]);
    assert!(api::branch_changes(repo.path()).unwrap().is_empty());
}

/// Edge case. Break caught: an empty commit message committed.
#[test]
fn an_empty_message_is_refused() {
    for message in ["", " ", "\n \n"] {
        let repo = repo();
        two_branches(&repo);
        let main_tip = repo.git(&["rev-parse", "main"]);
        let feature_tip = repo.git(&["rev-parse", FOLDER]);

        for branch in ["main", FOLDER] {
            let error = api::commit_branch(repo.path(), branch, message).unwrap_err();
            assert_eq!(
                error.message, "A commit needs a message.",
                "{message:?} on {branch}"
            );
        }

        assert_eq!(repo.git(&["rev-parse", "main"]), main_tip);
        assert_eq!(repo.git(&["rev-parse", FOLDER]), feature_tip);
        assert_eq!(repo.git(&["diff", "--cached", "--name-only"]), "");
        assert_eq!(
            run_git(&worktree(&repo), &["diff", "--cached", "--name-only"]),
            ""
        );
    }
}

/// Ruling R3. Break caught: a pane's Discard leaving the files a buffer edited, or touching
/// another branch's.
#[test]
fn a_branch_discards_alone() {
    let repo = repo();
    two_branches(&repo);
    let spec_typed = std::fs::read_to_string(worktree(&repo).join(SPEC)).unwrap();

    api::discard_branch(repo.path(), "main").unwrap();

    assert_eq!(repo.read(PRIORITIES), PRIORITIES_TEXT);
    assert_eq!(
        std::fs::read_to_string(worktree(&repo).join(SPEC)).unwrap(),
        spec_typed
    );
    let panes = api::branch_changes(repo.path()).unwrap();
    assert_eq!(panes.len(), 1);
    assert_eq!(panes[0].branch, FOLDER);

    api::discard_branch(repo.path(), FOLDER).unwrap();

    assert_eq!(
        std::fs::read_to_string(worktree(&repo).join(SPEC)).unwrap(),
        spec("awaiting-human", 1, 0)
    );
    assert!(api::branch_changes(repo.path()).unwrap().is_empty());
}
