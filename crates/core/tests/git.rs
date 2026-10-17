mod common;

use common::repo::TestRepo;
use uraeda_core::git::{Git, GitError};

#[test]
fn discovers_the_top_level_from_a_subfolder() {
    let repo = TestRepo::new();
    repo.write("crates/a.txt", "a\n");

    let git = Git::discover(&repo.path().join("crates")).unwrap();

    assert_eq!(git.root(), repo.path());
}

#[test]
fn outside_a_repository() {
    let folder = tempfile::TempDir::new().unwrap();

    let error = Git::discover(folder.path()).err().unwrap();

    assert!(matches!(error, GitError::NotARepository(_)));
    assert_eq!(
        error.to_string(),
        "not in a git repository: run git init first"
    );
}

#[test]
fn status_returns_an_error_when_the_object_directory_disappears() {
    let repo = TestRepo::new();
    // An unborn HEAD lets status reach the worktree without first reading a commit's tree.
    repo.git(&["update-ref", "-d", "refs/heads/main"]);
    let git = Git::discover(repo.path()).unwrap();
    std::fs::remove_dir_all(repo.path().join(".git/objects")).unwrap();

    assert!(matches!(
        git.has_local_changes(),
        Err(GitError::Read { .. })
    ));
    assert!(matches!(git.changed_files(), Err(GitError::Read { .. })));
    assert!(matches!(git.staged_files(), Err(GitError::Read { .. })));
}

#[test]
fn lists_local_and_remote_branches() {
    let repo = TestRepo::new();
    repo.branch("2026-10-10-a");
    repo.branch("2026-10-12-b");
    repo.push("2026-10-12-b");
    repo.delete_branch("2026-10-12-b");

    let branches = Git::discover(repo.path()).unwrap().branches().unwrap();

    let a = branches.iter().find(|b| b.name == "2026-10-10-a").unwrap();
    let b = branches.iter().find(|b| b.name == "2026-10-12-b").unwrap();
    assert!(a.local.is_some() && a.remote.is_none());
    assert!(b.local.is_none() && b.remote.is_some());
}

#[test]
fn default_branch_follows_origin_head() {
    let repo = TestRepo::new();
    repo.switch_new("trunk");
    repo.push("trunk");
    repo.git(&["remote", "set-head", "origin", "trunk"]);

    let git = Git::discover(repo.path()).unwrap();

    assert_eq!(git.default_branch().as_deref(), Some("trunk"));
}

#[test]
fn default_branch_falls_back_to_main() {
    let repo = TestRepo::new();

    let git = Git::discover(repo.path()).unwrap();

    assert_eq!(git.default_branch().as_deref(), Some("main"));
}

#[test]
fn reads_a_file_on_another_branch_without_switching() {
    let repo = TestRepo::new();
    repo.switch_new("2026-10-10-a");
    repo.write("specs/2026-10-10-a/spec.md", "# Spec\n");
    repo.commit("spec");
    repo.switch("main");

    let git = Git::discover(repo.path()).unwrap();
    let tip = git.tip("2026-10-10-a").unwrap();

    assert_eq!(
        git.read_file(tip, "specs/2026-10-10-a/spec.md").unwrap(),
        Some(b"# Spec\n".to_vec())
    );
    assert_eq!(git.read_file(tip, "specs/missing.md").unwrap(), None);
    assert_eq!(git.current_branch().as_deref(), Some("main"));
}

#[test]
fn lists_files_under_a_folder() {
    let repo = TestRepo::new();
    repo.write("specs/a/one.md", "1\n");
    repo.write("specs/a/sub/two.md", "2\n");
    repo.write("other.md", "3\n");
    repo.commit("files");

    let git = Git::discover(repo.path()).unwrap();
    let files = git.list_files(git.head().unwrap(), "specs").unwrap();

    assert_eq!(files, ["specs/a/one.md", "specs/a/sub/two.md"]);
}

#[test]
fn finds_linked_worktrees() {
    let repo = TestRepo::new();
    repo.branch("2026-10-10-a");
    let worktree = repo.parent().join("wt");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        worktree.to_str().unwrap(),
        "2026-10-10-a",
    ]);

    let worktrees = Git::discover(repo.path()).unwrap().worktrees().unwrap();

    assert_eq!(worktrees.len(), 2);
    assert_eq!(worktrees[0].branch.as_deref(), Some("main"));
    assert_eq!(worktrees[1].path, worktree);
    assert_eq!(worktrees[1].branch.as_deref(), Some("2026-10-10-a"));
}

#[test]
fn changed_files_lists_staged_and_unstaged_tracked_files() {
    let repo = TestRepo::new();
    repo.write("a.md", "a\n");
    repo.commit("a");
    repo.write("README.md", "# Changed\n");
    repo.write("a.md", "staged\n");
    repo.git(&["add", "a.md"]);
    repo.write("untracked.md", "u\n");

    let changed = Git::discover(repo.path()).unwrap().changed_files().unwrap();

    assert_eq!(changed, ["README.md", "a.md"]);
}

#[test]
fn changed_files_ignores_a_touched_but_identical_file() {
    let repo = TestRepo::new();
    repo.write("README.md", "# Test\n");

    let changed = Git::discover(repo.path()).unwrap().changed_files().unwrap();

    assert!(changed.is_empty(), "{changed:?}");
}

#[test]
fn commit_runs_the_hook_and_commits_only_the_given_paths() {
    let repo = TestRepo::new();
    repo.write("a.md", "a\n");
    repo.write("b.md", "b\n");
    repo.commit("files");
    repo.write("a.md", "a2\n");
    repo.write("b.md", "b2\n");

    let git = Git::discover(repo.path()).unwrap();
    git.commit(&["a.md".to_string()], "docs: a", Some("Body."))
        .unwrap();

    assert_eq!(repo.subjects("main")[0], "docs: a");
    assert_eq!(repo.changed_in("HEAD"), ["a.md"]);
    assert_eq!(repo.porcelain(), " M b.md\n");
    assert_eq!(repo.hook_runs(), 1);
}

#[test]
fn commit_refuses_other_staged_files() {
    let repo = TestRepo::new();
    repo.write("a.md", "a\n");
    repo.write("b.md", "b\n");
    repo.git(&["add", "b.md"]);

    let error = Git::discover(repo.path())
        .unwrap()
        .commit(&["a.md".to_string()], "docs: a", None)
        .err()
        .unwrap();

    assert_eq!(
        error.to_string(),
        "other files are staged: b.md: commit or unstage them first"
    );
    assert_eq!(repo.subjects("main").len(), 1);
}

#[test]
fn commit_keeps_what_the_hook_reformats() {
    let repo = TestRepo::new();
    repo.set_hook("for f in $(git diff --cached --name-only); do echo formatted >> \"$f\"; git add \"$f\"; done");
    repo.write("a.md", "a\n");

    Git::discover(repo.path())
        .unwrap()
        .commit(&["a.md".to_string()], "docs: a", None)
        .unwrap();

    assert_eq!(repo.git(&["show", "HEAD:a.md"]), "a\nformatted\n");
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn commit_reports_a_failing_hook() {
    let repo = TestRepo::new();
    repo.set_hook("echo boom >&2; exit 1");
    repo.write("a.md", "a\n");

    let error = Git::discover(repo.path())
        .unwrap()
        .commit(&["a.md".to_string()], "docs: a", None)
        .err()
        .unwrap();

    assert_eq!(error.to_string(), "git commit failed: boom");
}

#[test]
fn switch_new_creates_and_checks_out_a_branch() {
    let repo = TestRepo::new();

    Git::discover(repo.path())
        .unwrap()
        .switch_new("2026-10-11-x", "main")
        .unwrap();

    assert_eq!(repo.current_branch(), "2026-10-11-x");
}

#[test]
fn behind_counts_remote_commits() {
    let repo = TestRepo::new();
    repo.switch_new("2026-10-10-a");
    repo.push("2026-10-10-a");
    repo.write("x.md", "1\n");
    repo.commit("one");
    repo.write("x.md", "2\n");
    repo.commit("two");
    repo.push("2026-10-10-a");
    repo.git(&["reset", "--quiet", "--hard", "HEAD~2"]);

    let git = Git::discover(repo.path()).unwrap();
    let branch = git
        .branches()
        .unwrap()
        .into_iter()
        .find(|b| b.name == "2026-10-10-a")
        .unwrap();

    assert_eq!(git.behind(branch.local.unwrap(), branch.remote.unwrap()), 2);
    assert!(git.fetched_at().is_some());
}

#[test]
fn is_ancestor_of_a_merged_branch() {
    let repo = TestRepo::new();
    repo.switch_new("2026-10-10-a");
    repo.write("x.md", "1\n");
    repo.commit("one");
    repo.switch("main");

    let git = Git::discover(repo.path()).unwrap();
    let branch = git.tip("2026-10-10-a").unwrap();
    let main = git.tip("main").unwrap();

    assert!(git.is_ancestor(main, branch));
    assert!(!git.is_ancestor(branch, main));
}

#[test]
fn the_merge_base_of_a_branch_and_main() {
    let repo = TestRepo::new();
    let start = repo.git(&["rev-parse", "HEAD"]);
    repo.switch_new("2026-10-10-a");
    repo.write("x.md", "branch\n");
    repo.commit("on the branch");
    repo.switch("main");
    repo.write("y.md", "main\n");
    repo.commit("on main");

    let git = Git::discover(repo.path()).unwrap();
    let branch = git.tip("2026-10-10-a").unwrap();
    let main = git.tip("main").unwrap();

    let base = git.merge_base(main, branch).unwrap().unwrap();
    assert_eq!(base.to_string(), start.trim());
}

#[test]
fn two_histories_without_a_common_commit_have_no_merge_base() {
    let repo = TestRepo::new();
    repo.git(&["switch", "--quiet", "--orphan", "2026-10-10-a"]);
    repo.write("x.md", "alone\n");
    repo.commit("alone");

    let git = Git::discover(repo.path()).unwrap();
    let branch = git.tip("2026-10-10-a").unwrap();
    let main = git.tip("main").unwrap();

    assert_eq!(git.merge_base(main, branch).unwrap(), None);
}
