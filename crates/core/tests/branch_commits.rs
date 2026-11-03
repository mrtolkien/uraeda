//! The Commit page's panes: a pane per branch with changes, each committed apart with its message.

mod common;

use std::path::{Path, PathBuf};

use common::repo::{TestRepo, run_git};
use common::texts::{proposal, record, spec};
use uraeda_core::actions::edited;
use uraeda_core::actions::place::Place;
use uraeda_core::api::{self, BranchPane};
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

/// Ruling R13. Break caught: a later suggested commit amending the commit whose message the human
/// typed, which rewrites it into "…, and 1 more".
#[test]
fn a_typed_message_is_never_amended() {
    let repo = repo();
    save(&repo, PRIORITIES, |text| format!("{text}- Global undo\n"));
    api::commit_branch(repo.path(), "main", "chore: add Global undo to Now").unwrap();
    save(&repo, INBOX, |text| format!("{text}- A second note\n"));

    let suggested = api::branch_changes(repo.path()).unwrap()[0].message.clone();
    api::commit_branch(repo.path(), "main", &suggested).unwrap();

    assert_eq!(
        repo.subjects("main")[..2],
        [
            "chore: edit specs/INBOX.md",
            "chore: add Global undo to Now"
        ]
    );
}

/// Ruling R16. Break caught: a feature pane's commit taking the one mark of the git folder every
/// worktree shares, so a later suggested commit amends the default branch's typed commit.
#[test]
fn a_feature_commit_keeps_the_typed_mark_of_the_default_branch() {
    let repo = repo();
    two_branches(&repo);
    api::commit_branch(repo.path(), "main", "chore: add Global undo to Now").unwrap();
    api::commit_branch(repo.path(), FOLDER, "docs: drop the clock").unwrap();
    save(&repo, INBOX, |text| format!("{text}- A second note\n"));

    let suggested = api::branch_changes(repo.path()).unwrap()[0].message.clone();
    api::commit_branch(repo.path(), "main", &suggested).unwrap();

    assert_eq!(
        repo.subjects("main")[..2],
        [
            "chore: edit specs/INBOX.md",
            "chore: add Global undo to Now"
        ]
    );
}

/// Break caught: a suggested message no longer joining the latest suggested commit, a run of small
/// edits split into a commit each.
#[test]
fn a_suggested_message_amends_the_latest_suggested_one() {
    let repo = repo();
    save(&repo, PRIORITIES, |text| format!("{text}- Global undo\n"));
    let suggested = api::branch_changes(repo.path()).unwrap()[0].message.clone();
    api::commit_branch(repo.path(), "main", &suggested).unwrap();
    save(&repo, INBOX, |text| format!("{text}- A second note\n"));

    let suggested = api::branch_changes(repo.path()).unwrap()[0].message.clone();
    api::commit_branch(repo.path(), "main", &suggested).unwrap();

    assert_eq!(
        repo.subjects("main")[..2],
        [
            "chore: edit specs/PRIORITIES.md, and 1 more",
            "chore: specs"
        ]
    );
}

/// Break caught: a deferred commit forgetting the buffer's edits before it lands, so a hook's
/// refusal leaves them uncommitted, and off the Commit page.
#[test]
fn a_refused_deferred_commit_keeps_its_pane() {
    let repo = repo();
    two_branches(&repo);
    api::defer_commits(repo.path(), true);
    repo.set_hook("echo refused\nexit 1");
    let before = api::branch_changes(repo.path()).unwrap();

    for branch in [FOLDER, "main"] {
        api::commit_branch(repo.path(), branch, "chore: a message of my own").unwrap();
        let deferred = api::take_deferred(repo.path());
        assert_eq!(deferred.len(), 1, "{branch}");
        let refused = api::land(repo.path(), &deferred[0].id, |_| {}).unwrap_err();
        assert_eq!(refused.code, "hook", "{branch}");
    }

    assert_eq!(api::branch_changes(repo.path()).unwrap(), before);
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

    let panes = api::branch_changes(repo.path()).unwrap();

    assert_eq!(panes.len(), 1, "{panes:?}");
    assert_eq!(panes[0].branch, "main");
    assert_ne!(panes[0].lines, ["- Edit specs/PRIORITIES.md"]);
}

/// Break caught: a feature pane's commit carrying a file an agent staged.
#[test]
fn a_feature_pane_leaves_a_staged_file_out() {
    let repo = repo();
    two_branches(&repo);
    let plan = format!("specs/{FOLDER}/plan.md");
    std::fs::write(worktree(&repo).join(&plan), "# Plan\n").unwrap();
    run_git(&worktree(&repo), &["add", "--", &plan]);

    api::commit_branch(repo.path(), FOLDER, "chore: drop the clock").unwrap();

    assert_eq!(repo.changed_in(FOLDER), [SPEC]);
    assert_eq!(
        run_git(&worktree(&repo), &["diff", "--cached", "--name-only"]),
        format!("{plan}\n")
    );
}

/// Break caught: a pane leaving out a file a buffer created, or one deleted since its save.
#[test]
fn a_pane_commits_a_created_file_and_a_deleted_one() {
    let repo = repo();
    let created = "specs/decisions/storage.md";
    api::save_buffer(repo.path(), created, "# Storage\n", &hash("")).unwrap();
    save(&repo, INBOX, |text| format!("{text}- A second note\n"));
    std::fs::remove_file(repo.path().join(INBOX)).unwrap();

    let panes = api::branch_changes(repo.path()).unwrap();
    assert_eq!(
        panes[0].lines,
        ["- Edit specs/INBOX.md", &format!("- Edit {created}")]
    );
    api::commit_branch(repo.path(), "main", "chore: storage, and no inbox").unwrap();

    assert_eq!(repo.changed_in("main"), [INBOX, created]);
    assert_eq!(
        repo.git(&["show", &format!("main:{created}")]),
        "# Storage\n"
    );
    assert!(api::branch_changes(repo.path()).unwrap().is_empty());
}

/// Break caught: a typed message of a subject and a body on the next line committed with a blank
/// line put between them, or its other lines rewritten.
#[test]
fn a_typed_message_is_committed_as_typed() {
    let repo = repo();
    two_branches(&repo);
    let message = "chore: plan the undo\nWith a body on the next line.\n\n\nAnd two  spaces.";

    for branch in ["main", FOLDER] {
        api::commit_branch(repo.path(), branch, &format!("\n{message}\n\n")).unwrap();

        assert_eq!(
            repo.git(&["log", "-1", "--format=%B", branch]).trim_end(),
            message,
            "{branch}"
        );
    }
}

/// Break caught: a finished feature's branch read as no feature's, its pane committed under the
/// default branch's scope, without the agent's check.
#[test]
fn a_finished_unmerged_features_pane_is_its_own() {
    let repo = repo();
    repo.switch(FOLDER);
    repo.git(&["rm", "-r", "--quiet", &format!("specs/{FOLDER}")]);
    let path = format!("specs/done/{FOLDER}.md");
    repo.write(&path, &record("feature", "Web UI"));
    repo.commit("finish: web UI");
    repo.switch("main");
    save(&repo, &path, |text| format!("{text}\nOne more line.\n"));

    let panes = api::branch_changes(repo.path()).unwrap();

    assert_eq!(panes.len(), 1, "{panes:?}");
    assert_eq!(panes[0].folder.as_deref(), Some(FOLDER));
    assert!(
        panes[0].message.starts_with("chore(web-ui): "),
        "{}",
        panes[0].message
    );
}

/// Break caught: the lists' commit, the editor's or a proposal file's, sweeping in a file a buffer
/// edited, which only the Commit page commits.
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
        let panes = api::branch_changes(repo.path()).unwrap();
        assert_eq!(
            panes[0].lines,
            [
                format!("- Edit {decision}"),
                "- Edit specs/proposals/search.md".to_string()
            ],
            "{route}"
        );
    }
}

/// A note added with an image, a note file no commit has, then the inbox saved in a buffer.
/// Returns the note file's path.
fn note_with_image_then_buffer(repo: &TestRepo) -> String {
    let inbox = api::read_inbox(repo.path()).unwrap();
    let image = std::fs::read(common::fixture("images/phone.png")).unwrap();
    let (_, file) = api::add_note_with_images(
        repo.path(),
        None,
        None,
        "A note with a picture",
        &[(image, Some("picture.png".to_string()))],
        &inbox.hash,
    )
    .unwrap();
    save(repo, INBOX, |text| {
        text.replace("A first note", "A first note, rewritten")
    });
    file
}

/// Edge case. Break caught: a buffer's edit of the inbox committing its link to a note file no
/// commit has without the file and its images.
#[test]
fn a_buffer_edit_of_the_inbox_commits_the_note_files_it_links() {
    let repo = repo();
    let file = note_with_image_then_buffer(&repo);
    let panes = api::branch_changes(repo.path()).unwrap();
    assert_eq!(panes[0].lines, vec!["- Edit specs/INBOX.md"]);

    api::commit_branch(repo.path(), "main", &panes[0].message).unwrap();

    let changed = repo.changed_in("main");
    assert!(changed.contains(&INBOX.to_string()), "{changed:?}");
    assert!(changed.contains(&file), "{changed:?}");
    assert!(
        changed.iter().any(|path| path.contains("/images/")),
        "{changed:?}"
    );
    assert_eq!(repo.porcelain(), "");
}

/// Edge case. Break caught: Discard of a buffer's edit of the inbox leaving behind the note file
/// with its images that the inbox no longer links.
#[test]
fn a_buffer_edit_of_the_inbox_discards_the_note_files_it_links() {
    let repo = repo();
    let file = note_with_image_then_buffer(&repo);
    let folder = file.strip_suffix("/note.md").unwrap();

    api::discard_branch(repo.path(), "main").unwrap();

    assert_eq!(repo.read(INBOX), INBOX_TEXT);
    assert!(!repo.exists(folder), "{folder} left behind");
    assert_eq!(repo.porcelain(), "");
    assert!(api::branch_changes(repo.path()).unwrap().is_empty());
}
