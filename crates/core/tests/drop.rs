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
/// Another item of the same name, an earlier feature of the same slug: its proposal stays.
const SAME_NAME: &str = "- [Login redirects twice](/specs/2026-10-01-login-redirect/proposal.md)";

fn day() -> Date {
    Date::parse("2026-10-20").unwrap()
}

/// A repository with a proposal file of the login redirect in **Next**, and a proposal of the same
/// name in **Later**.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/PRIORITIES.md",
        &format!(
            "# Priorities\n\n## Now\n\n## Next\n\n- [Login redirects twice](proposals/login-redirect.md)\n\n## Later\n\n{SAME_NAME}\n\n## Blocked\n"
        ),
    );
    repo.write(
        "specs/proposals/login-redirect.md",
        "# Login redirects twice\n\n## What\n\nThe login page redirects twice.\n",
    );
    repo.commit("chore: expand Login redirects twice");
    repo
}

fn opened(repo: &TestRepo) -> (Git, Workspace) {
    let git = Git::discover(repo.path()).unwrap();
    let workspace = Workspace::read(&git).unwrap();
    (git, workspace)
}

/// The repository with its proposal file started as `kind`, in its own worktree.
fn started(kind: Kind) -> TestRepo {
    let repo = repo();
    let (git, workspace) = opened(&repo);
    start::run(
        &git,
        &workspace,
        "specs/proposals/login-redirect.md",
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
fn dropping_a_change_removes_its_proposal_and_its_worktree_and_keeps_its_branch() {
    let repo = started(Kind::Change);
    let commits = repo.subjects(CHANGE_BRANCH);
    let (git, workspace) = opened(&repo);

    let dropped = drop::run(&git, &workspace, CHANGE).unwrap();

    assert_eq!(dropped.branch, CHANGE_BRANCH);
    assert_eq!(dropped.worktree, None);
    assert!(dropped.committed);
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

    assert!(dropped.committed);
    assert_eq!(dropped.branch, CHANGE);
    assert_eq!(dropped.worktree_left, None);
    assert_eq!(
        repo.subjects("main")[0],
        "chore(login-redirect): drop Login redirects twice"
    );
    assert!(!priorities(&repo).contains("/specs/2026-10-20-login-redirect/"));
    assert!(priorities(&repo).contains(SAME_NAME));
    assert_eq!(
        repo.changed_in("main"),
        [
            "specs/2026-10-20-login-redirect/proposal.md",
            "specs/PRIORITIES.md"
        ]
    );
    assert!(!repo.exists(WORKTREE));
    assert!(has_branch(&repo, CHANGE));
}

/// The start put the change's folder on main: the drop's commit removes it with the proposal, so
/// main keeps no folder of a dropped change, which would read as merged once its branch is gone.
#[test]
fn dropping_a_change_removes_its_folder_on_main() {
    let repo = started(Kind::Change);
    let before = repo.subjects("main").len();

    let (git, workspace) = opened(&repo);
    drop::run(&git, &workspace, CHANGE).unwrap();

    assert_eq!(repo.subjects("main").len(), before + 1);
    assert_eq!(
        repo.changed_in("main"),
        [
            "specs/PRIORITIES.md",
            "specs/changes/2026-10-20-login-redirect/proposal.md"
        ]
    );
    assert!(!repo.exists("specs/changes/2026-10-20-login-redirect"));
    assert_eq!(repo.porcelain(), "");
}

/// Uncommitted edits to the item's folder on main would be lost with it: refused, before anything
/// is written.
#[test]
fn uncommitted_changes_to_the_folder_on_main_are_refused() {
    let repo = started(Kind::Change);
    let proposal = "specs/changes/2026-10-20-login-redirect/proposal.md";
    repo.write(proposal, "# Edited\n");
    let before = repo.subjects("main");

    let refused = api::drop_item(repo.path(), CHANGE).unwrap_err();

    assert_eq!(
        refused.message,
        format!("cannot drop: main has uncommitted changes in {proposal}")
    );
    assert_eq!(repo.subjects("main"), before);
    assert_eq!(repo.read(proposal), "# Edited\n");
    assert!(repo.exists(WORKTREE));
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

/// Review: a git error after the proposal left the priorities says the proposal was removed.
#[test]
fn a_failed_worktree_removal_says_the_proposal_was_removed() {
    use std::os::unix::fs::PermissionsExt;
    let repo = started(Kind::Change);
    let worktrees = repo.path().join(".worktrees");
    std::fs::set_permissions(&worktrees, std::fs::Permissions::from_mode(0o555)).unwrap();
    let (git, workspace) = opened(&repo);

    let failed = drop::run(&git, &workspace, CHANGE);

    std::fs::set_permissions(&worktrees, std::fs::Permissions::from_mode(0o755)).unwrap();
    let message = failed.unwrap_err().to_string();
    assert!(
        message.starts_with(
            "the proposal was removed from specs/PRIORITIES.md, but its worktree was not: "
        ),
        "{message}"
    );
    assert!(!priorities(&repo).contains("/specs/changes/2026-10-20-login-redirect/"));
}

/// Rulings R2: the priorities' other changes keep the removal uncommitted, and the drop says so.
#[test]
fn a_removal_beside_other_changes_is_not_committed() {
    let repo = started(Kind::Feature);
    let edited = repo
        .read("specs/PRIORITIES.md")
        .replace("## Blocked\n", "## Blocked\n\n- A note\n");
    repo.write("specs/PRIORITIES.md", &edited);
    let before = repo.subjects("main");

    let dropped = api::drop_item(repo.path(), CHANGE).unwrap();

    assert!(!dropped.committed);
    assert_eq!(repo.subjects("main"), before);
    let text = repo.read("specs/PRIORITIES.md");
    assert!(text.contains("- A note\n"), "{text}");
    assert!(
        !text.contains("/specs/2026-10-20-login-redirect/"),
        "{text}"
    );
    assert!(!repo.exists("specs/2026-10-20-login-redirect"));
}

/// Review: a deferred drop refused by a hook brings the folder it deleted back, its images
/// included, which only `HEAD` holds.
#[test]
fn a_refused_drop_brings_back_the_folders_images() {
    let repo = started(Kind::Change);
    let folder = "specs/changes/2026-10-20-login-redirect";
    let image = format!("{folder}/images/shot.png");
    let bytes = [0x89, b'P', b'N', b'G', 0, 1, 2, 3];
    std::fs::create_dir_all(repo.path().join(folder).join("images")).unwrap();
    std::fs::write(repo.path().join(&image), bytes).unwrap();
    repo.commit("chore: a screenshot");
    let proposal = repo.read(&format!("{folder}/proposal.md"));
    api::defer_commits(repo.path(), true);

    let dropped = api::drop_item(repo.path(), CHANGE).unwrap();
    assert!(dropped.committed);
    assert!(!repo.exists(folder));
    repo.set_hook("echo refused\nexit 1");
    let deferred = api::take_deferred(repo.path());
    let refused = api::land(repo.path(), &deferred[0].id, |_| {}).unwrap_err();

    assert_eq!(
        (refused.code, refused.output.as_deref()),
        ("hook", Some("refused"))
    );
    assert_eq!(repo.read(&format!("{folder}/proposal.md")), proposal);
    assert_eq!(std::fs::read(repo.path().join(&image)).unwrap(), bytes);
    assert_eq!(repo.porcelain(), "");
}
