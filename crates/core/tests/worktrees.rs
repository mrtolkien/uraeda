mod common;

use common::repo::TestRepo;
use uraeda_core::actions::place::{self, Place};
use uraeda_core::git::{Git, GitError};

const BRANCH: &str = "2026-10-11-web-ui";

/// A repository on `main` with the feature branch `2026-10-11-web-ui`, checked out nowhere.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.switch_new(BRANCH);
    repo.write("specs/2026-10-11-web-ui/proposal.md", "# Web UI\n");
    repo.commit("chore(web-ui): proposal");
    repo.switch("main");
    repo
}

fn reach(repo: &TestRepo) -> Result<Place, place::PlaceError> {
    place::reach(&Git::discover(repo.path()).unwrap(), BRANCH)
}

fn worktrees(repo: &TestRepo) -> usize {
    repo.git(&["worktree", "list", "--porcelain"])
        .lines()
        .filter(|line| line.starts_with("worktree "))
        .count()
}

/// US5.1
#[test]
fn creates_a_worktree_for_a_branch_checked_out_nowhere() {
    let repo = repo();

    let place = reach(&repo).unwrap();

    assert_eq!(place.root, repo.path().join(".worktrees").join(BRANCH));
    assert!(place.created);
    assert!(
        place
            .root
            .join("specs/2026-10-11-web-ui/proposal.md")
            .exists()
    );
    assert_eq!(repo.current_branch(), "main");
    assert_eq!(worktrees(&repo), 2);
}

/// US5.2
#[test]
fn reuses_the_worktree() {
    let repo = repo();
    reach(&repo).unwrap();

    let place = reach(&repo).unwrap();

    assert!(!place.created);
    assert_eq!(worktrees(&repo), 2);
}

/// US5.3
#[test]
fn writes_in_the_checkout_on_the_branch() {
    let repo = repo();
    repo.switch(BRANCH);

    let place = reach(&repo).unwrap();

    assert_eq!(place.root, repo.path());
    assert_eq!(worktrees(&repo), 1);
}

/// US5.4
#[test]
fn tracks_a_branch_only_on_origin() {
    let repo = repo();
    repo.push(BRANCH);
    repo.delete_branch(BRANCH);

    let place = reach(&repo).unwrap();

    assert!(
        place
            .root
            .join("specs/2026-10-11-web-ui/proposal.md")
            .exists()
    );
    let upstream = repo.git(&[
        "rev-parse",
        "--abbrev-ref",
        &format!("{BRANCH}@{{upstream}}"),
    ]);
    assert_eq!(upstream.trim(), format!("origin/{BRANCH}"));
}

/// US5.5 and SC-003: the test repository's hooks path, `.git/hooks`, is relative.
#[test]
fn commits_in_a_worktree_run_the_main_checkouts_hook() {
    let repo = repo();
    let place = reach(&repo).unwrap();
    std::fs::write(
        place.root.join("specs/2026-10-11-web-ui/proposal.md"),
        "# Changed\n",
    )
    .unwrap();

    Git::open(&place.root)
        .unwrap()
        .commit(
            &["specs/2026-10-11-web-ui/proposal.md".to_string()],
            "chore(web-ui): edit the proposal",
            None,
        )
        .unwrap();

    assert_eq!(repo.hook_runs(), 1);
    assert_eq!(repo.subjects(BRANCH)[0], "chore(web-ui): edit the proposal");
}

/// US5.6
#[test]
fn worktrees_stay_out_of_git_status() {
    let repo = repo();
    reach(&repo).unwrap();
    repo.branch("2026-10-12-other");
    place::reach(&Git::discover(repo.path()).unwrap(), "2026-10-12-other").unwrap();

    assert_eq!(repo.porcelain(), "");
    let exclude = repo.read(".git/info/exclude");
    assert_eq!(
        exclude
            .lines()
            .filter(|line| *line == "/.worktrees/")
            .count(),
        1
    );
}

#[test]
fn refuses_a_folder_in_the_way() {
    let repo = repo();
    repo.write(".worktrees/2026-10-11-web-ui/notes.txt", "mine\n");

    let error = reach(&repo).unwrap_err();

    assert_eq!(
        error.to_string(),
        "cannot create the worktree: .worktrees/2026-10-11-web-ui exists"
    );
}

/// Review focus 1: a worktree deleted by hand is pruned and created again.
#[test]
fn recreates_a_worktree_deleted_by_hand() {
    let repo = repo();
    let first = reach(&repo).unwrap();
    std::fs::remove_dir_all(&first.root).unwrap();

    let place = reach(&repo).unwrap();

    assert!(place.created);
    assert!(
        place
            .root
            .join("specs/2026-10-11-web-ui/proposal.md")
            .exists()
    );
}

#[test]
fn a_refused_commit_keeps_the_hooks_whole_output() {
    let repo = repo();
    repo.set_hook("echo first problem\necho second problem\nexit 1");
    repo.write("README.md", "# Changed\n");

    let error = Git::discover(repo.path())
        .unwrap()
        .commit(&["README.md".to_string()], "docs: change", None)
        .unwrap_err();

    let GitError::Command {
        message, output, ..
    } = error
    else {
        panic!("{error}");
    };
    assert_eq!(message, "first problem");
    assert!(output.contains("first problem\nsecond problem"), "{output}");
}
