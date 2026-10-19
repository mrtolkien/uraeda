//! The git decision's rules: writes go through the user's hooks, never sweep in what the human
//! staged, never switch the human's checkout, and keep worktrees out of `git status`.

use uraeda_core::actions::place;
use uraeda_core::git::{Git, GitError};

use crate::common::repo::TestRepo;

const BRANCH: &str = "2026-10-11-web-ui";
const PROPOSAL: &str = "specs/2026-10-11-web-ui/proposal.md";

/// A repository on `main` with a feature branch checked out nowhere.
fn repo_with_branch() -> TestRepo {
    let repo = TestRepo::new();
    repo.switch_new(BRANCH);
    repo.write(PROPOSAL, "# Web UI\n");
    repo.commit("chore(web-ui): proposal");
    repo.switch("main");
    repo
}

fn commit(repo: &TestRepo, paths: &[&str]) -> Result<(), GitError> {
    let paths: Vec<String> = paths.iter().map(ToString::to_string).collect();
    Git::discover(repo.path())
        .unwrap()
        .commit(&paths, "docs: change", None)
}

#[test]
fn a_commit_runs_the_users_hook_and_takes_only_the_given_files() {
    let repo = TestRepo::new();
    repo.write("a.md", "a\n");
    repo.write("b.md", "b\n");
    repo.commit("files");
    repo.write("a.md", "a2\n");
    repo.write("b.md", "b2\n");

    commit(&repo, &["a.md"]).unwrap();

    assert_eq!(repo.changed_in("HEAD"), ["a.md"]);
    assert!(repo.porcelain().contains("b.md"), "b.md stays uncommitted");
    assert_eq!(repo.hook_runs(), 1);
}

#[test]
fn a_commit_keeps_what_the_hook_reformats() {
    let repo = TestRepo::new();
    repo.set_hook(
        "for f in $(git diff --cached --name-only); do echo formatted >> \"$f\"; git add \"$f\"; done",
    );
    repo.write("a.md", "a\n");

    commit(&repo, &["a.md"]).unwrap();

    assert_eq!(repo.git(&["show", "HEAD:a.md"]), "a\nformatted\n");
    assert_eq!(
        repo.porcelain(),
        "",
        "the reformat is committed, not left over"
    );
}

#[test]
fn a_hook_that_refuses_stops_the_commit_and_says_why() {
    let repo = TestRepo::new();
    repo.set_hook("echo the-hook-says-no >&2; exit 1");
    repo.write("a.md", "a\n");
    let before = repo.subjects("main").len();

    let error = commit(&repo, &["a.md"]).unwrap_err();

    assert!(error.to_string().contains("the-hook-says-no"), "{error}");
    assert_eq!(repo.subjects("main").len(), before, "nothing was committed");
    assert_eq!(repo.git(&["diff", "--cached", "--name-only"]), "");
}

#[test]
fn files_the_human_staged_are_never_swept_into_a_commit() {
    let repo = TestRepo::new();
    repo.write("a.md", "a\n");
    repo.write("b.md", "b\n");
    repo.git(&["add", "b.md"]);
    let before = repo.subjects("main").len();

    let result = commit(&repo, &["a.md"]);

    assert!(result.is_err());
    assert_eq!(repo.subjects("main").len(), before);
    assert_eq!(repo.git(&["diff", "--cached", "--name-only"]), "b.md\n");
}

#[test]
fn reading_and_writing_a_branch_never_switches_the_checkout() {
    let repo = repo_with_branch();
    let git = Git::discover(repo.path()).unwrap();

    let proposal = git.read_file(git.tip(BRANCH).unwrap(), PROPOSAL).unwrap();
    let place = place::reach(&git, BRANCH).unwrap();
    std::fs::write(place.root.join(PROPOSAL), "# New\n").unwrap();
    Git::open(&place.root)
        .unwrap()
        .commit(&[PROPOSAL.to_string()], "docs: edit", None)
        .unwrap();

    assert_eq!(proposal.as_deref(), Some(b"# Web UI\n".as_slice()));
    assert_eq!(repo.current_branch(), "main");
    assert_eq!(repo.changed_in(BRANCH), [PROPOSAL]);
    assert_eq!(
        repo.hook_runs(),
        1,
        "the commit in the worktree ran the hook"
    );
}

#[test]
fn worktrees_are_reused_and_stay_out_of_git_status() {
    let repo = repo_with_branch();
    repo.branch("2026-10-12-other");
    let git = Git::discover(repo.path()).unwrap();

    let first = place::reach(&git, BRANCH).unwrap();
    let again = place::reach(&git, BRANCH).unwrap();
    place::reach(&git, "2026-10-12-other").unwrap();

    assert!(first.created);
    assert!(!again.created);
    assert_eq!(first.root, again.root);
    assert_eq!(repo.porcelain(), "", "no worktree shows as untracked");
}

#[test]
fn a_worktree_deleted_by_hand_is_made_again() {
    let repo = repo_with_branch();
    let git = Git::discover(repo.path()).unwrap();
    let first = place::reach(&git, BRANCH).unwrap();
    std::fs::remove_dir_all(&first.root).unwrap();

    let place = place::reach(&git, BRANCH).unwrap();

    assert!(place.root.join(PROPOSAL).exists());
}

#[test]
fn a_branch_only_on_origin_gets_a_tracking_worktree() {
    let repo = repo_with_branch();
    repo.push(BRANCH);
    repo.delete_branch(BRANCH);

    let place = place::reach(&Git::discover(repo.path()).unwrap(), BRANCH).unwrap();

    assert!(place.root.join(PROPOSAL).exists());
    let upstream = repo.git(&[
        "rev-parse",
        "--abbrev-ref",
        &format!("{BRANCH}@{{upstream}}"),
    ]);
    assert_eq!(upstream.trim(), format!("origin/{BRANCH}"));
}
