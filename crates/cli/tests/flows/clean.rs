//! `ura clean`: the git decision's first rule. A merged feature's worktree and branch are removed
//! only when nothing is lost, and only when a human asks.

use crate::common::*;

const WEB_UI: &str = "2026-10-11-web-ui";
const WORKTREE: &str = ".worktrees/2026-10-11-web-ui";
const PRIORITIES: &str = "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n";

/// The given features finished on their branches and merged into `main`, their branches kept.
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

fn branch_exists(repo: &TestRepo, branch: &str) -> bool {
    !repo.git(&["branch", "--list", branch]).trim().is_empty()
}

#[test]
fn a_merged_features_worktree_and_branch_are_removed_when_nothing_is_lost() {
    let repo = repo_with_merged(&[WEB_UI]);
    with_worktree(&repo, WEB_UI);

    let output = ura(&repo, &["clean"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(!repo.exists(WORKTREE));
    assert!(!branch_exists(&repo, WEB_UI));
    assert_eq!(
        ura(&repo, &["clean"]).code,
        0,
        "nothing left to clean is not an error"
    );
}

#[test]
fn a_worktree_with_untracked_or_uncommitted_files_is_left_with_its_branch() {
    let repo = repo_with_merged(&[WEB_UI]);
    with_worktree(&repo, WEB_UI);
    repo.write(&format!("{WORKTREE}/notes.txt"), "notes");

    let output = ura(&repo, &["clean", "web-ui"]);

    assert_eq!(output.code, 1, "something was left: the exit code says so");
    assert!(
        repo.exists(&format!("{WORKTREE}/notes.txt")),
        "the human's file is still there"
    );
    assert!(branch_exists(&repo, WEB_UI));
}

#[test]
fn a_branch_with_commits_main_lacks_is_kept_until_they_are_somewhere_else() {
    let repo = repo_with_merged(&[WEB_UI]);
    repo.switch(WEB_UI);
    repo.write("more.txt", "more");
    repo.commit("more");
    repo.switch("main");

    let local = ura(&repo, &["clean", "web-ui"]);

    assert_eq!(local.code, 1);
    assert!(
        branch_exists(&repo, WEB_UI),
        "unmerged work is never deleted"
    );

    repo.push("main");
    let remote = ura(&repo, &["clean", "web-ui"]);
    assert_eq!(remote.code, 1);
    assert!(
        branch_exists(&repo, WEB_UI),
        "main on origin lacks them too"
    );

    repo.switch(WEB_UI);
    repo.git(&["merge", "--quiet", "--no-edit", "main"]);
    repo.switch("main");
    repo.git(&["merge", "--quiet", "--no-edit", WEB_UI]);
    assert_eq!(ura(&repo, &["clean", "web-ui"]).code, 0);
    assert!(!branch_exists(&repo, WEB_UI), "merged, it goes");
}

#[test]
fn the_branch_a_checkout_is_on_and_a_feature_not_merged_are_left_alone() {
    let repo = repo_with_merged(&[WEB_UI]);
    repo.switch(WEB_UI);

    let on_it = ura(&repo, &["clean", "web-ui"]);

    assert_eq!(on_it.code, 1);
    assert_eq!(
        repo.current_branch(),
        WEB_UI,
        "the human's checkout is not switched"
    );
    assert!(branch_exists(&repo, WEB_UI));

    feature(
        &repo,
        "2026-10-12-finish-feature",
        &[("proposal.md", proposal())],
    );
    let unmerged = ura(&repo, &["clean", "finish-feature"]);
    assert_eq!(unmerged.code, 1);
    assert!(branch_exists(&repo, "2026-10-12-finish-feature"));
}

#[test]
fn several_candidates_need_a_name_or_all_and_a_dry_run_changes_nothing() {
    let repo = repo_with_merged(&["2026-10-10-cli-core", WEB_UI]);
    with_worktree(&repo, WEB_UI);

    let ambiguous = ura(&repo, &["clean"]);
    let dry = ura(&repo, &["clean", "--all", "--dry-run"]);

    assert_eq!(
        ambiguous.code, 1,
        "removing anything is only done when a human names it"
    );
    assert!(branch_exists(&repo, WEB_UI) && branch_exists(&repo, "2026-10-10-cli-core"));
    assert_eq!(dry.code, 0, "{}", dry.stderr);
    assert!(
        repo.exists(WORKTREE) && branch_exists(&repo, WEB_UI),
        "a dry run removes nothing"
    );

    let all = ura(&repo, &["clean", "--all"]);
    assert_eq!(all.code, 0, "{}", all.stderr);
    assert!(
        !repo.exists(WORKTREE)
            && !branch_exists(&repo, WEB_UI)
            && !branch_exists(&repo, "2026-10-10-cli-core")
    );
}

#[test]
fn a_locked_worktree_and_one_outside_the_worktrees_folder_are_left() {
    let repo = repo_with_merged(&[WEB_UI]);
    with_worktree(&repo, WEB_UI);
    repo.git(&["worktree", "lock", WORKTREE]);

    let locked = ura(&repo, &["clean", "web-ui"]);

    assert_eq!(locked.code, 1);
    assert!(repo.exists(WORKTREE) && branch_exists(&repo, WEB_UI));
    repo.git(&["worktree", "unlock", WORKTREE]);
    repo.git(&["worktree", "remove", WORKTREE]);
    let elsewhere = repo.parent().join("elsewhere");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        elsewhere.to_str().unwrap(),
        WEB_UI,
    ]);

    let outside = ura(&repo, &["clean", "web-ui"]);

    assert_eq!(outside.code, 1);
    assert!(elsewhere.exists() && branch_exists(&repo, WEB_UI));
}
