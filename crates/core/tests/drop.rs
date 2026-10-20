mod common;

use common::repo::TestRepo;
use common::texts::record;
use uraeda_core::actions::drop;
use uraeda_core::actions::start;
use uraeda_core::api;
use uraeda_core::git::Git;
use uraeda_core::today::Date;
use uraeda_core::workspace::{Kind, Workspace};

const CHANGE: &str = "2026-10-20-login-redirect";
const CHANGE_BRANCH: &str = "change/2026-10-20-login-redirect";
const WORKTREE: &str = ".worktrees/2026-10-20-login-redirect";
/// Another item of the same name, an earlier feature of the same slug: its entry stays.
const SAME_NAME: &str = "- [Login redirects twice](/specs/2026-10-01-login-redirect/proposal.md)";

fn day() -> Date {
    Date::parse("2026-10-20").unwrap()
}

/// A repository with a draft of the login redirect in **Next**, and an entry of the same name in
/// **Later**.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/PRIORITIES.md",
        &format!(
            "# Priorities\n\n## Now\n\n## Next\n\n- [Login redirects twice](drafts/login-redirect.md)\n\n## Later\n\n{SAME_NAME}\n\n## Blocked\n"
        ),
    );
    repo.write(
        "specs/drafts/login-redirect.md",
        "# Login redirects twice\n\n## What\n\nThe login page redirects twice.\n",
    );
    repo.commit("chore: draft Login redirects twice");
    repo
}

fn opened(repo: &TestRepo) -> (Git, Workspace) {
    let git = Git::discover(repo.path()).unwrap();
    let workspace = Workspace::read(&git).unwrap();
    (git, workspace)
}

/// The repository with its draft started as `kind`, in its own worktree.
fn started(kind: Kind) -> TestRepo {
    let repo = repo();
    let (git, workspace) = opened(&repo);
    start::run(
        &git,
        &workspace,
        "specs/drafts/login-redirect.md",
        Some("login-redirect"),
        kind,
        day(),
        false,
    )
    .unwrap();
    repo
}

fn has_branch(repo: &TestRepo, branch: &str) -> bool {
    !repo.git(&["branch", "--list", branch]).trim().is_empty()
}

fn priorities(repo: &TestRepo) -> String {
    repo.git(&["show", "main:specs/PRIORITIES.md"])
}

/// US2.4
#[test]
fn dropping_a_change_removes_its_entry_and_its_worktree_and_keeps_its_branch() {
    let repo = started(Kind::Change);
    let commits = repo.subjects(CHANGE_BRANCH);
    let (git, workspace) = opened(&repo);

    let dropped = drop::run(&git, &workspace, CHANGE).unwrap();

    assert_eq!(dropped.branch, CHANGE_BRANCH);
    assert_eq!(dropped.worktree, None);
    assert_eq!(
        repo.subjects("main")[0],
        "chore(login-redirect): drop Login redirects twice"
    );
    assert_eq!(
        priorities(&repo),
        format!("# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n{SAME_NAME}\n\n## Blocked\n")
    );
    assert!(!repo.exists(WORKTREE));
    assert!(has_branch(&repo, CHANGE_BRANCH));
    assert_eq!(repo.subjects(CHANGE_BRANCH), commits);
    assert_eq!(repo.porcelain(), "");
}

/// Edge case: a dropped change's worktree with uncommitted changes. Review focus 7.
#[test]
fn a_worktree_with_changes_stays() {
    let repo = started(Kind::Change);
    repo.write(&format!("{WORKTREE}/notes.md"), "Work in progress\n");

    let dropped = api::drop_item(repo.path(), CHANGE).unwrap();

    assert_eq!(dropped.branch, CHANGE_BRANCH);
    assert_eq!(
        dropped.worktree_left.as_deref(),
        Some(
            "Its worktree has uncommitted changes: it stays at .worktrees/2026-10-20-login-redirect"
        )
    );
    assert_eq!(
        repo.read(&format!("{WORKTREE}/notes.md")),
        "Work in progress\n"
    );
    assert!(!priorities(&repo).contains("/specs/changes/2026-10-20-login-redirect/"));
    assert!(priorities(&repo).contains(SAME_NAME));
    assert!(has_branch(&repo, CHANGE_BRANCH));
}

#[test]
fn a_feature_is_dropped_the_same_way() {
    let repo = started(Kind::Feature);

    let dropped = api::drop_item(repo.path(), CHANGE).unwrap();

    assert_eq!(dropped.branch, CHANGE);
    assert_eq!(dropped.worktree_left, None);
    assert_eq!(
        repo.subjects("main")[0],
        "chore(login-redirect): drop Login redirects twice"
    );
    assert!(!priorities(&repo).contains("/specs/2026-10-20-login-redirect/"));
    assert!(priorities(&repo).contains(SAME_NAME));
    assert!(!repo.exists(WORKTREE));
    assert!(has_branch(&repo, CHANGE));
}

#[test]
fn a_done_feature_is_not_dropped() {
    let repo = repo();
    repo.write(
        "specs/done/2026-10-11-web-ui.md",
        &record("feature", "Web UI"),
    );
    repo.commit("finish: web UI");
    let before = repo.subjects("main");

    let refused = api::drop_item(repo.path(), "2026-10-11-web-ui").unwrap_err();

    assert_eq!(
        refused.message,
        "2026-10-11-web-ui is done: ura clean removes it"
    );
    assert_eq!(repo.subjects("main"), before);
}
