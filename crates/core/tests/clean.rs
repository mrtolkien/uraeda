mod common;

use std::fs;

use common::repo::TestRepo;
use common::texts::{proposal, record};
use uraeda_core::actions::clean::{Cleaned, Did, Left, Leftover, WhyLeft, clean};
use uraeda_core::actions::place;
use uraeda_core::git::Git;
use uraeda_core::workspace::{Feature, Workspace};

const FOLDER: &str = "2026-10-11-web-ui";
const WORKTREE: &str = ".worktrees/2026-10-11-web-ui";
const BUG: &str = "2026-10-14-completed-tasks-reappear";
const BUG_BRANCH: &str = "fix/2026-10-14-completed-tasks-reappear";

/// A branch with its folder, finished with its record, then rebased onto `main` and merged
/// fast-forward, like GitHub's rebase merge: `main`'s commits have new hashes. The branch stays,
/// checked out in its worktree.
fn merged_branch(branch: &str, dir: &str, folder: &str, kind: &str, first: &str) -> TestRepo {
    let repo = TestRepo::new();
    repo.write(".gitignore", "node_modules\n");
    repo.commit("chore: ignore");
    repo.switch_new(branch);
    repo.write(&format!("{dir}/{first}"), &proposal());
    repo.commit("chore: proposal");
    repo.git(&["rm", "-r", "--quiet", dir]);
    repo.write(&format!("specs/done/{folder}.md"), &record(kind, "Web UI"));
    repo.commit("finish: web UI");
    repo.switch("main");
    repo.write("README.md", "# Test, moved on\n");
    repo.commit("chore: main moves on");
    repo.git(&["cherry-pick", "--quiet", &format!("main..{branch}")]);
    place::reach(&git(&repo), branch).unwrap();
    repo
}

fn merged() -> TestRepo {
    merged_branch(
        FOLDER,
        "specs/2026-10-11-web-ui",
        FOLDER,
        "feature",
        "proposal.md",
    )
}

fn git(repo: &TestRepo) -> Git {
    Git::discover(repo.path()).unwrap()
}

fn run(repo: &TestRepo, folder: &str, dry_run: bool) -> Result<Cleaned, String> {
    let git = git(repo);
    let workspace = Workspace::read(&git).unwrap();
    let feature: Feature = workspace.feature(folder).cloned().unwrap();
    clean(&git, &workspace, &feature, dry_run).map_err(|e| e.to_string())
}

fn has_branch(repo: &TestRepo, branch: &str) -> bool {
    !repo.git(&["branch", "--list", branch]).trim().is_empty()
}

fn left(what: Leftover, why: WhyLeft) -> Left {
    Left { what, why }
}

/// US3.1
#[test]
fn removes_a_clean_worktree_and_its_merged_branch() {
    let repo = merged();
    fs::create_dir_all(repo.path().join(WORKTREE).join("node_modules")).unwrap();
    fs::write(repo.path().join(WORKTREE).join("node_modules/x.js"), "").unwrap();

    let cleaned = run(&repo, FOLDER, false).unwrap();

    assert_eq!(
        cleaned.did,
        [
            Did::RemovedWorktree(WORKTREE.into()),
            Did::DeletedBranch(FOLDER.into())
        ]
    );
    assert_eq!(cleaned.left, []);
    assert!(!repo.exists(WORKTREE));
    assert!(!has_branch(&repo, FOLDER));
}

/// US3.2, SC-003
#[test]
fn leaves_a_worktree_with_an_untracked_file() {
    let repo = merged();
    fs::write(repo.path().join(WORKTREE).join("notes.txt"), "notes").unwrap();

    let cleaned = run(&repo, FOLDER, false).unwrap();

    assert_eq!(cleaned.did, []);
    assert_eq!(
        cleaned.left,
        [
            left(Leftover::Worktree(WORKTREE.into()), WhyLeft::Changes),
            left(Leftover::Branch(FOLDER.into()), WhyLeft::WorktreeLeft)
        ]
    );
    assert!(repo.exists(&format!("{WORKTREE}/notes.txt")));
    assert!(has_branch(&repo, FOLDER));
}

/// US3.3, SC-003
#[test]
fn leaves_a_branch_with_commits_main_lacks() {
    let repo = merged();
    let worktree = repo.path().join(WORKTREE);
    for n in 1..=2 {
        fs::write(worktree.join(format!("more-{n}.txt")), "more").unwrap();
        run_in(&worktree, &["add", "--all"]);
        run_in(
            &worktree,
            &["commit", "--quiet", "--no-verify", "-m", "more"],
        );
    }

    let cleaned = run(&repo, FOLDER, false).unwrap();

    assert_eq!(cleaned.did, [Did::RemovedWorktree(WORKTREE.into())]);
    assert_eq!(
        cleaned.left,
        [left(
            Leftover::Branch(FOLDER.into()),
            WhyLeft::Unmerged {
                count: 2,
                bases: vec!["main".into()]
            }
        )]
    );
}

fn run_in(dir: &std::path::Path, args: &[&str]) {
    let status = std::process::Command::new("git")
        .args(args)
        .current_dir(dir)
        .status()
        .unwrap();
    assert!(status.success(), "git {args:?}");
}

/// US3.4
#[test]
fn a_merge_only_on_origin_counts() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.commit("chore: proposal");
    repo.git(&["rm", "-r", "--quiet", "specs/2026-10-11-web-ui"]);
    repo.write(
        "specs/done/2026-10-11-web-ui.md",
        &record("feature", "Web UI"),
    );
    repo.commit("finish: web UI");
    repo.switch("main");
    repo.push("main");
    repo.push(FOLDER);
    let clone = repo.parent().join("clone");
    run_in(
        repo.parent(),
        &["clone", "--quiet", "origin.git", clone.to_str().unwrap()],
    );
    run_in(
        &clone,
        &[
            "-c",
            "user.name=T",
            "-c",
            "user.email=t@example.com",
            "merge",
            "--quiet",
            "--no-ff",
            "--no-edit",
            "origin/2026-10-11-web-ui",
        ],
    );
    run_in(&clone, &["push", "--quiet", "origin", "main"]);
    repo.git(&["fetch", "--quiet", "origin"]);

    let cleaned = run(&repo, FOLDER, false).unwrap();

    assert_eq!(cleaned.did, [Did::DeletedBranch(FOLDER.into())]);
}

/// US3.5
#[test]
fn leaves_the_branch_the_checkout_is_on() {
    let repo = merged();
    repo.git(&["worktree", "remove", WORKTREE]);
    repo.switch(FOLDER);

    let cleaned = run(&repo, FOLDER, false).unwrap();

    assert_eq!(
        cleaned.left,
        [left(
            Leftover::Branch(FOLDER.into()),
            WhyLeft::CheckedOutHere
        )]
    );
}

/// US3.7
#[test]
fn refuses_a_feature_not_merged() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    repo.switch_new("2026-10-12-finish-feature");
    repo.write("specs/2026-10-12-finish-feature/proposal.md", &proposal());
    repo.commit("chore: proposal");
    repo.switch("main");

    let error = run(&repo, "2026-10-12-finish-feature", false).unwrap_err();

    assert_eq!(
        error,
        "2026-10-12-finish-feature is not merged: only merged features are cleaned"
    );
}

/// US3.8, review focus 3
#[test]
fn cleans_a_merged_bug() {
    let repo = merged_branch(
        BUG_BRANCH,
        "specs/bugs/2026-10-14-completed-tasks-reappear",
        BUG,
        "bug",
        "report.md",
    );

    let cleaned = run(&repo, BUG, false).unwrap();

    assert_eq!(cleaned.name, BUG_BRANCH);
    assert_eq!(
        cleaned.did,
        [
            Did::RemovedWorktree(".worktrees/fix/2026-10-14-completed-tasks-reappear".into()),
            Did::DeletedBranch(BUG_BRANCH.into())
        ]
    );
}

/// Review focus 4
#[test]
fn without_origin_the_local_main_alone_counts() {
    let repo = merged();

    let cleaned = run(&repo, FOLDER, true).unwrap();

    assert_eq!(cleaned.left, []);
    assert!(cleaned.did.contains(&Did::DeletedBranch(FOLDER.into())));
}

#[test]
fn a_squash_merge_leaves_the_branch() {
    let repo = TestRepo::new();
    repo.switch_new(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.commit("chore: proposal");
    repo.git(&["rm", "-r", "--quiet", "specs/2026-10-11-web-ui"]);
    repo.write(
        "specs/done/2026-10-11-web-ui.md",
        &record("feature", "Web UI"),
    );
    repo.commit("finish: web UI");
    repo.switch("main");
    repo.git(&["merge", "--quiet", "--squash", FOLDER]);
    repo.commit("feat: web UI (#3)");

    let cleaned = run(&repo, FOLDER, false).unwrap();

    assert_eq!(
        cleaned.left,
        [left(
            Leftover::Branch(FOLDER.into()),
            WhyLeft::Unmerged {
                count: 2,
                bases: vec!["main".into()]
            }
        )]
    );
}

#[test]
fn leaves_a_locked_worktree() {
    let repo = merged();
    repo.git(&["worktree", "lock", WORKTREE]);

    let cleaned = run(&repo, FOLDER, false).unwrap();

    assert_eq!(
        cleaned.left[0],
        left(Leftover::Worktree(WORKTREE.into()), WhyLeft::Locked)
    );
    assert!(repo.exists(WORKTREE));
}

#[test]
fn leaves_a_worktree_outside_worktrees() {
    let repo = merged();
    repo.git(&["worktree", "remove", WORKTREE]);
    let elsewhere = repo.parent().join("elsewhere");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        elsewhere.to_str().unwrap(),
        FOLDER,
    ]);

    let cleaned = run(&repo, FOLDER, false).unwrap();

    assert!(matches!(
        &cleaned.left[0],
        Left {
            what: Leftover::Worktree(_),
            why: WhyLeft::Outside(_)
        }
    ));
    assert!(elsewhere.exists());
}

#[test]
fn prunes_a_worktree_deleted_by_hand() {
    let repo = merged();
    fs::remove_dir_all(repo.path().join(WORKTREE)).unwrap();

    let cleaned = run(&repo, FOLDER, false).unwrap();

    assert_eq!(
        cleaned.did,
        [
            Did::PrunedWorktree(WORKTREE.into()),
            Did::DeletedBranch(FOLDER.into())
        ]
    );
    assert!(!has_branch(&repo, FOLDER));
}

#[test]
fn a_dry_run_changes_nothing() {
    let repo = merged();

    let cleaned = run(&repo, FOLDER, true).unwrap();

    assert!(cleaned.dry_run);
    assert_eq!(
        cleaned.did,
        [
            Did::RemovedWorktree(WORKTREE.into()),
            Did::DeletedBranch(FOLDER.into())
        ]
    );
    assert!(repo.exists(WORKTREE));
    assert!(has_branch(&repo, FOLDER));
}

/// Final review: run from inside the worktree it would remove.
#[test]
fn leaves_the_worktree_it_runs_in() {
    let repo = merged();
    let inside = Git::open(&repo.path().join(WORKTREE)).unwrap();
    let workspace = Workspace::read(&inside).unwrap();
    let feature = workspace.feature(FOLDER).cloned().unwrap();

    let cleaned = clean(&inside, &workspace, &feature, false).unwrap();

    assert_eq!(
        cleaned.left,
        [
            left(Leftover::Worktree(WORKTREE.into()), WhyLeft::YouAreInIt),
            left(Leftover::Branch(FOLDER.into()), WhyLeft::WorktreeLeft)
        ]
    );
    assert!(repo.exists(WORKTREE));
    assert!(has_branch(&repo, FOLDER));
}
