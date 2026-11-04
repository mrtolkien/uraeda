//! The changes a buffer's saves leave waiting for a commit, each branch's, as the lists' count of
//! changes reads them, and the lists' own commits, which leave a buffer's edit out.

mod common;

use std::path::PathBuf;

use common::repo::{TestRepo, run_git};
use common::texts::{proposal, spec};
use uraeda_core::api;
use uraeda_core::files::document::hash;

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

/// Break caught: a recorded file committed by another route, then edited by an agent, listed as
/// the human's edit: committed under the human's message, or thrown away by Discard.
#[test]
fn a_recorded_file_committed_elsewhere_is_forgotten() {
    let repo = repo();
    two_branches(&repo);
    let tree = worktree(&repo);
    run_git(
        &tree,
        &[
            "commit",
            "--quiet",
            "--no-verify",
            "-am",
            "spec(web-ui): agent",
        ],
    );
    let spec_path = tree.join(SPEC);
    let agent = std::fs::read_to_string(&spec_path).unwrap() + "\nThe agent's line.\n";
    std::fs::write(&spec_path, agent).unwrap();
    repo.git(&["commit", "--quiet", "--no-verify", "-am", "chore: by hand"]);
    repo.write(
        PRIORITIES,
        &format!("{PRIORITIES_TEXT}- Global undo\n- Search\n"),
    );

    let priorities = api::read_priorities(repo.path()).unwrap();

    // The feature's branch has nothing waiting: every change counted is the default branch's.
    assert_eq!(
        priorities.changes as usize,
        priorities.change_lines.len(),
        "{priorities:?}"
    );
    assert_ne!(priorities.change_lines, ["- Edit specs/PRIORITIES.md"]);
}

/// Break caught: the lists' commit, the editor's or a proposal file's, sweeping in a file a buffer
/// edited, which only the Git page commits.
#[test]
fn the_lists_commits_leave_a_buffers_edit() {
    let decision = "specs/decisions/storage.md";
    let proposal_file = "specs/proposals/undo.md";
    for route in ["lists", "priorities", "text"] {
        let repo = repo();
        repo.write("specs/proposals/search.md", "# Search\n");
        repo.commit("docs: search");
        api::save_buffer(repo.path(), decision, "# Storage\n", &hash("")).unwrap();
        save(&repo, "specs/proposals/search.md", |text| {
            format!("{text}\nFast.\n")
        });
        repo.write(proposal_file, "# Undo\n");
        repo.write(
            PRIORITIES,
            &format!("{PRIORITIES_TEXT}- [Undo](proposals/undo.md)\n"),
        );

        match route {
            "lists" => api::commit_changes(repo.path()).unwrap(),
            "priorities" => drop(api::commit_priorities(repo.path()).unwrap()),
            _ => drop(api::commit_text(repo.path(), proposal_file).unwrap()),
        }

        assert_eq!(
            repo.changed_in("main"),
            [PRIORITIES, proposal_file],
            "{route}"
        );
        assert_eq!(
            api::read_priorities(repo.path()).unwrap().change_lines,
            [
                format!("- Edit {decision}"),
                "- Edit specs/proposals/search.md".to_string()
            ],
            "{route}"
        );
    }
}
