mod common;

use std::path::PathBuf;

use common::repo::{TestRepo, run_git};
use uraeda_core::actions::promote;
use uraeda_core::actions::start::{self, StartError};
use uraeda_core::git::Git;
use uraeda_core::pulls::{self, PullRequestState, PullRequestView, PullRequests};
use uraeda_core::today::Date;
use uraeda_core::workspace::{Kind, Workspace};

const FOLDER: &str = "2026-10-20-priorities-sections";
const CHANGE_BRANCH: &str = "change/2026-10-20-priorities-sections";
const DRAFT: &str = "specs/drafts/priorities-sections.md";
const DECISION: &str = "specs/decisions/inbox.md";

/// `main` with the draft "Priorities sections", linked from Next, and an active decision, started
/// as `kind` on 2026-10-20 in its worktree.
fn started(kind: Kind) -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Now\n\n## Next\n\n- [Priorities sections](drafts/priorities-sections.md)\n\n## Later\n\n## Blocked\n",
    );
    repo.write(DRAFT, "# Priorities sections\n\n## What\n\nSections.\n");
    repo.write(
        DECISION,
        "---\nstatus: active\napproved-by: mrtolkien\n---\n\n# Inbox\n\nA choice.\n",
    );
    repo.commit("chore: draft Priorities sections");
    let (git, workspace) = opened(&repo);
    let day = Date::parse("2026-10-20").unwrap();
    start::run(&git, &workspace, DRAFT, None, kind, day, false).unwrap();
    repo
}

fn opened(repo: &TestRepo) -> (Git, Workspace) {
    let git = Git::discover(repo.path()).unwrap();
    let workspace = Workspace::read(&git).unwrap();
    (git, workspace)
}

fn worktree(repo: &TestRepo) -> PathBuf {
    repo.path().join(".worktrees").join(FOLDER)
}

/// Commits every change of the change's worktree, without the hook.
fn commit_in_worktree(repo: &TestRepo, message: &str) {
    run_git(&worktree(repo), &["add", "--all"]);
    run_git(
        &worktree(repo),
        &["commit", "--quiet", "--no-verify", "--message", message],
    );
}

fn promote(repo: &TestRepo) -> Result<promote::Promoted, StartError> {
    let (git, workspace) = opened(repo);
    promote::run(&git, &workspace, FOLDER)
}

/// Nothing moved: the change's branch, folder, and Now entry are as the start left them.
fn assert_nothing_moved(repo: &TestRepo) {
    assert_eq!(
        repo.subjects("main")[0],
        "chore(priorities-sections): start Priorities sections"
    );
    assert_eq!(
        run_git(&worktree(repo), &["branch", "--show-current"]).trim(),
        CHANGE_BRANCH
    );
    assert!(
        worktree(repo)
            .join(format!("specs/changes/{FOLDER}/proposal.md"))
            .exists()
    );
}

/// US4.1: the branch and the folder become a feature's, and Now links it.
#[test]
fn a_change_becomes_a_feature_in_place() {
    let repo = started(Kind::Change);

    let promoted = promote(&repo).unwrap();

    assert_eq!(promoted.folder, FOLDER);
    assert_eq!(promoted.branch, FOLDER);
    assert_eq!(
        run_git(&worktree(&repo), &["branch", "--show-current"]).trim(),
        FOLDER
    );
    assert_eq!(repo.git(&["branch", "--list", "change/*"]), "");
    let tree = repo.git(&["ls-tree", "-r", "--name-only", FOLDER, "specs"]);
    assert!(
        tree.contains(&format!("specs/{FOLDER}/proposal.md")),
        "{tree}"
    );
    assert!(!tree.contains("specs/changes/"), "{tree}");
    assert!(!worktree(&repo).join("specs/changes").join(FOLDER).exists());
    assert_eq!(run_git(&worktree(&repo), &["status", "--porcelain"]), "");
    let priorities = repo.git(&["show", "main:specs/PRIORITIES.md"]);
    assert!(
        priorities.contains(&format!(
            "## Now\n\n- [Priorities sections](/specs/{FOLDER}/proposal.md)\n"
        )),
        "{priorities}"
    );
    assert_eq!(
        repo.subjects("main")[0],
        "chore(priorities-sections): start Priorities sections as a feature"
    );
    assert_eq!(
        repo.subjects(FOLDER)[0],
        "chore(priorities-sections): upgrade to a feature"
    );
    assert_eq!(repo.porcelain(), "");
}

/// US4.3: what the change committed stays on the branch.
#[test]
fn the_changes_commits_stay_on_the_branch() {
    let repo = started(Kind::Change);
    std::fs::create_dir_all(worktree(&repo).join("src/priorities")).unwrap();
    std::fs::write(
        worktree(&repo).join("src/priorities/sections.ts"),
        "export {};\n",
    )
    .unwrap();
    commit_in_worktree(&repo, "feat(priorities-sections): sections");

    promote(&repo).unwrap();

    assert!(
        repo.subjects(FOLDER)
            .contains(&"feat(priorities-sections): sections".to_string())
    );
    assert!(worktree(&repo).join("src/priorities/sections.ts").exists());
}

/// US4 more 1: a decision the change applied is proposed again, for the feature's spec.
#[test]
fn a_decision_the_change_applied_is_proposed_again() {
    let repo = started(Kind::Change);
    std::fs::write(
        worktree(&repo).join(DECISION),
        "---\nstatus: active\napproved-by: mrtolkien\n---\n\n# Inbox\n\nAnother choice.\n",
    )
    .unwrap();
    commit_in_worktree(&repo, "decision(priorities-sections): apply inbox");

    let promoted = promote(&repo).unwrap();

    assert_eq!(promoted.decisions, ["inbox"]);
    assert_eq!(
        std::fs::read_to_string(worktree(&repo).join(DECISION)).unwrap(),
        "---\nstatus: proposed\napproved-by:\n---\n\n# Inbox\n\nAnother choice.\n"
    );
    assert!(
        repo.changed_in(FOLDER).contains(&DECISION.to_string()),
        "{:?}",
        repo.changed_in(FOLDER)
    );
    assert_eq!(
        repo.read(DECISION),
        "---\nstatus: active\napproved-by: mrtolkien\n---\n\n# Inbox\n\nA choice.\n"
    );
}

/// US4 more 2: a change with a pull request keeps its branch's name.
#[test]
fn a_change_with_a_pull_request_is_refused() {
    let repo = started(Kind::Change);
    let root = Git::discover(repo.path()).unwrap().main_root();
    let pull = |number| PullRequestView {
        number,
        url: format!("https://github.com/o/r/pull/{number}"),
        state: PullRequestState::Open,
    };
    pulls::remember(
        &root,
        PullRequests::Known([(CHANGE_BRANCH.to_string(), pull(7))].into()),
    );

    let refused = promote(&repo);

    assert_eq!(
        refused.err().map(|error| error.to_string()).as_deref(),
        Some("This change has a pull request: close it first, since its branch would be renamed")
    );
    assert_nothing_moved(&repo);
}

/// A pull request of another branch does not refuse the move.
#[test]
fn another_branchs_pull_request_does_not_refuse() {
    let repo = started(Kind::Change);
    let root = Git::discover(repo.path()).unwrap().main_root();
    let pull = PullRequestView {
        number: 8,
        url: "https://github.com/o/r/pull/8".to_string(),
        state: PullRequestState::Open,
    };
    pulls::remember(
        &root,
        PullRequests::Known([("main".to_string(), pull)].into()),
    );

    assert!(promote(&repo).is_ok());
}

#[test]
fn a_taken_name_is_refused() {
    let repo = started(Kind::Change);
    repo.branch(FOLDER);

    let refused = promote(&repo);

    assert_eq!(
        refused.err().map(|error| error.to_string()).as_deref(),
        Some("2026-10-20-priorities-sections exists: choose another slug with --slug")
    );
    assert_nothing_moved(&repo);
}

#[test]
fn uncommitted_changes_in_the_changes_worktree_are_refused() {
    let repo = started(Kind::Change);
    std::fs::write(worktree(&repo).join("README.md"), "# Edited\n").unwrap();

    let refused = promote(&repo);

    assert_eq!(
        refused.err().map(|error| error.to_string()).as_deref(),
        Some(
            "cannot move: the change's worktree .worktrees/2026-10-20-priorities-sections has \
             uncommitted changes in README.md"
        )
    );
    assert_nothing_moved(&repo);
}

/// Review: the main checkout's uncommitted edits do not refuse the move, and stay uncommitted.
#[test]
fn uncommitted_changes_in_the_main_checkout_stay() {
    let repo = started(Kind::Change);
    repo.write("README.md", "# Edited\n");

    promote(&repo).unwrap();

    assert_eq!(repo.read("README.md"), "# Edited\n");
    assert_eq!(repo.porcelain().trim(), "M README.md");
    assert_eq!(repo.changed_in("main"), ["specs/PRIORITIES.md".to_string()]);
}

#[test]
fn a_feature_is_not_promoted() {
    let repo = started(Kind::Feature);

    let refused = promote(&repo);

    assert_eq!(
        refused.err().map(|error| error.to_string()).as_deref(),
        Some("2026-10-20-priorities-sections is not a change")
    );
}

/// Review focus 2: a commit refused on the branch says what was done and what is left.
#[test]
fn a_failed_commit_reports_what_is_done_and_left() {
    let repo = started(Kind::Change);
    repo.set_hook("[ \"$(git branch --show-current)\" = main ] || exit 1");

    let failed = promote(&repo);

    let Err(StartError::Partial { done, left, .. }) = failed else {
        panic!("a partial move");
    };
    assert_eq!(
        done,
        [
            "the entry in Now, relinked on main".to_string(),
            format!("the branch renamed to {FOLDER}"),
            format!("the move of specs/changes/{FOLDER} to specs/{FOLDER}"),
        ]
    );
    assert_eq!(
        left,
        [format!(
            "commit specs/changes/{FOLDER} and specs/{FOLDER} as \"chore(priorities-sections): \
             upgrade to a feature\""
        )]
    );
}

/// Review focus 2: a refused relink on the default branch leaves the branch's name.
#[test]
fn a_refused_relink_renames_nothing() {
    let repo = started(Kind::Change);
    repo.set_hook("[ \"$(git branch --show-current)\" != main ] || exit 1");

    let failed = promote(&repo);

    let Err(StartError::Partial { done, left, .. }) = failed else {
        panic!("a partial move");
    };
    assert!(done.is_empty(), "{done:?}");
    assert_eq!(left.len(), 4, "{left:?}");
    assert_eq!(
        repo.git(&["branch", "--list", CHANGE_BRANCH]).trim(),
        "+ change/2026-10-20-priorities-sections"
    );
    assert_eq!(repo.git(&["branch", "--list", FOLDER]), "");
}

/// Edge case: a pushed change is renamed locally; its remote branch stays.
#[test]
fn a_pushed_change_is_renamed_locally_only() {
    let repo = started(Kind::Change);
    repo.push(CHANGE_BRANCH);

    promote(&repo).unwrap();

    let remote = repo.git(&["ls-remote", "--heads", "origin"]);
    assert!(
        remote.contains(&format!("refs/heads/{CHANGE_BRANCH}")),
        "{remote}"
    );
    assert!(
        !remote.contains(&format!("refs/heads/{FOLDER}\n")),
        "{remote}"
    );
}

/// Review: a move run again after its rename failed relinks nothing twice, and completes.
#[test]
fn a_move_run_again_after_a_failed_rename_completes_with_one_entry() {
    let repo = started(Kind::Change);
    let lock = repo.path().join(format!(".git/refs/heads/{FOLDER}.lock"));
    std::fs::write(&lock, "").unwrap();
    let failed = promote(&repo);
    assert!(
        matches!(failed, Err(StartError::Partial { ref done, .. }) if done.len() == 1),
        "{:?}",
        failed.err().map(|error| error.to_string())
    );
    std::fs::remove_file(&lock).unwrap();

    promote(&repo).unwrap();

    let priorities = repo.git(&["show", "main:specs/PRIORITIES.md"]);
    assert_eq!(priorities.matches("- [").count(), 1, "{priorities}");
    assert_eq!(
        repo.subjects("main")[0],
        "chore(priorities-sections): start Priorities sections as a feature"
    );
    assert_eq!(
        repo.subjects(FOLDER)[0],
        "chore(priorities-sections): upgrade to a feature"
    );
}
