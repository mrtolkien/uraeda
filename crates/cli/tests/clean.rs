mod common;

use common::*;

const WEB_UI: &str = "2026-10-11-web-ui";
const WORKTREE: &str = ".worktrees/2026-10-11-web-ui";
const PRIORITIES: &str = "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n";

/// A repository where the given features were finished on their branches and merged into `main`,
/// their branches kept.
fn repo_with_merged(folders: &[&str]) -> TestRepo {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    for folder in folders {
        feature(&repo, folder, &[("proposal.md", proposal())]);
        finish_and_merge(&repo, folder);
    }
    repo
}

fn with_worktree(repo: &TestRepo, branch: &str) {
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        &format!(".worktrees/{branch}"),
        branch,
    ]);
}

/// US3.1
#[test]
fn cleans_one_merged_feature() {
    let repo = repo_with_merged(&[WEB_UI]);
    with_worktree(&repo, WEB_UI);

    let output = ura(&repo, &["clean"]);

    assert_eq!(
        output.stdout,
        "2026-10-11-web-ui\n  removed the worktree .worktrees/2026-10-11-web-ui\n  deleted the branch 2026-10-11-web-ui\n"
    );
    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(!repo.exists(WORKTREE));
}

/// US3.2
#[test]
fn reports_a_worktree_with_untracked_files() {
    let repo = repo_with_merged(&[WEB_UI]);
    with_worktree(&repo, WEB_UI);
    repo.write(&format!("{WORKTREE}/notes.txt"), "notes");

    let output = ura(&repo, &["clean", "web-ui"]);

    assert_eq!(
        output.stdout,
        "2026-10-11-web-ui\n  left the worktree .worktrees/2026-10-11-web-ui: it has uncommitted or untracked files. Commit or\n  remove them, then run ura clean again\n  left the branch 2026-10-11-web-ui: its worktree is still there\n"
    );
    assert_eq!(output.code, 1);
}

/// US3.3
#[test]
fn reports_commits_the_default_branch_lacks() {
    let repo = repo_with_merged(&[WEB_UI]);
    repo.switch(WEB_UI);
    for n in 1..=2 {
        repo.write(&format!("more-{n}.txt"), "more");
        repo.commit("more");
    }
    repo.switch("main");

    let output = ura(&repo, &["clean", "web-ui"]);

    assert_eq!(
        output.stdout,
        "2026-10-11-web-ui\n  left the branch 2026-10-11-web-ui: 2 commits are not on main. Delete it with git branch -D\n  2026-10-11-web-ui if they are not needed\n"
    );
    assert_eq!(output.code, 1);

    repo.push("main");

    let output = ura(&repo, &["clean", "web-ui"]);

    assert_eq!(
        output.stdout,
        "2026-10-11-web-ui\n  left the branch 2026-10-11-web-ui: 2 commits are on neither main nor origin/main. Delete it with\n  git branch -D 2026-10-11-web-ui if they are not needed\n"
    );
}

/// US3.5
#[test]
fn reports_the_checkout_on_the_branch() {
    let repo = repo_with_merged(&[WEB_UI]);
    repo.switch(WEB_UI);

    let output = ura(&repo, &["clean", "web-ui"]);

    assert_eq!(
        output.stdout,
        "2026-10-11-web-ui\n  left the branch 2026-10-11-web-ui: your checkout is on it. Switch it to main, then run ura clean\n  again\n"
    );
    assert_eq!(output.code, 1);
}

/// US3.6
#[test]
fn several_candidates_need_a_target_or_all() {
    let repo = repo_with_merged(&["2026-10-10-cli-core", WEB_UI]);

    let output = ura(&repo, &["clean"]);

    assert_eq!(
        output.stderr,
        "ura: 2 merged features have a worktree or a branch left: name one, or pass --all\n  2026-10-10-cli-core\n  2026-10-11-web-ui\n"
    );
    assert_eq!(output.code, 1);
    assert!(repo.git(&["branch", "--list", WEB_UI]).contains(WEB_UI));
}

/// US3.6
#[test]
fn a_dry_run_with_all_prints_what_it_would_do() {
    let repo = repo_with_merged(&["2026-10-10-cli-core", WEB_UI]);
    with_worktree(&repo, WEB_UI);

    let output = ura(&repo, &["clean", "--all", "--dry-run"]);

    assert_eq!(
        output.stdout,
        "2026-10-10-cli-core\n  would delete the branch 2026-10-10-cli-core\n2026-10-11-web-ui\n  would remove the worktree .worktrees/2026-10-11-web-ui\n  would delete the branch 2026-10-11-web-ui\n"
    );
    assert_eq!(output.code, 0);
    assert!(repo.exists(WORKTREE));
}

/// US3.7
#[test]
fn refuses_a_feature_not_merged() {
    let repo = repo_with_merged(&[]);
    feature(
        &repo,
        "2026-10-12-finish-feature",
        &[("proposal.md", proposal())],
    );

    let output = ura(&repo, &["clean", "finish-feature"]);

    assert_eq!(
        output.stderr,
        "ura: 2026-10-12-finish-feature is not merged: only merged features are cleaned\n"
    );
    assert_eq!(output.code, 1);
}

#[test]
fn nothing_to_clean() {
    let repo = repo_with_merged(&[WEB_UI]);
    repo.delete_branch(WEB_UI);

    let output = ura(&repo, &["clean"]);

    assert_eq!(
        output.stdout,
        "Nothing to clean: no merged feature has a worktree or a branch left.\n"
    );
    assert_eq!(output.code, 0);
}
