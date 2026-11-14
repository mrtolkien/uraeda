mod common;

use common::repo::TestRepo;
use uraeda_core::actions::place::{self, Place};
use uraeda_core::git::Git;

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

/// A branch checked out nowhere is refused, and nothing is made: no worktree, no folder.
#[test]
fn refuses_a_branch_checked_out_nowhere() {
    let repo = repo();

    let error = reach(&repo).unwrap_err();

    assert!(matches!(error, place::PlaceError::NoWorktree(_)), "{error}");
    assert_eq!(
        error.to_string(),
        "no worktree holds the branch 2026-10-11-web-ui: check it out in a worktree first"
    );
    assert_eq!(repo.current_branch(), "main");
    assert_eq!(worktrees(&repo), 1);
    assert!(!repo.exists(".worktrees"));
}

/// A branch another worktree holds is reached there.
#[test]
fn reaches_the_worktree_that_holds_the_branch() {
    let repo = repo();
    let path = repo.worktree(BRANCH);

    let place = reach(&repo).unwrap();

    assert_eq!(
        place.root.canonicalize().unwrap(),
        path.canonicalize().unwrap()
    );
    assert!(
        place
            .root
            .join("specs/2026-10-11-web-ui/proposal.md")
            .exists()
    );
    assert_eq!(repo.current_branch(), "main");
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

/// A worktree deleted by hand holds nothing: the branch is refused again.
#[test]
fn refuses_a_worktree_deleted_by_hand() {
    let repo = repo();
    let path = repo.worktree(BRANCH);
    std::fs::remove_dir_all(&path).unwrap();

    let error = reach(&repo).unwrap_err();

    assert!(matches!(error, place::PlaceError::NoWorktree(_)), "{error}");
}
