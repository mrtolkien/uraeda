//! Starts as the server runs them, in a repository it defers commits for. A start refused by a
//! hook puts back what it wrote only where it still holds what the start left, never over what
//! someone changed meanwhile; its plan and its refusals.

mod common;

use common::repo::TestRepo;
use uraeda_core::api::{self, ApiError};
use uraeda_core::workspace::Kind;

const PROPOSAL_FILE: &str = "specs/proposals/login-banner.md";
const PRIORITIES: &str = "# Priorities\n\n## Now\n\n## Next\n\n- [Login banner](proposals/login-banner.md)\n\n## Later\n\n## Blocked\n";
const PROPOSAL: &str = "# Login banner\n\n## What\n\nA banner.\n";

/// A repository with a proposal file, its line in the priorities, deferral on, and a hook that runs
/// `meanwhile` then refuses the commit.
fn refusing(meanwhile: &str) -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", PRIORITIES);
    repo.write(PROPOSAL_FILE, PROPOSAL);
    repo.commit("chore: expand Login banner");
    api::defer_commits(repo.path(), true);
    repo.set_hook(&format!("{meanwhile}\necho 'lint: refused'\nexit 1"));
    repo
}

fn start(repo: &TestRepo) -> ApiError {
    api::start_feature(
        repo.path(),
        PROPOSAL_FILE,
        Some("login-banner"),
        Kind::Feature,
        &|_| {},
    )
    .unwrap_err()
}

/// The dated folder the start makes.
fn destination() -> String {
    format!("specs/{}-login-banner", uraeda_core::today::today())
}

/// A refusal that names `path` as left as it is.
fn assert_left(refused: &ApiError, path: &str) {
    assert_eq!(refused.code, "refused", "{}", refused.message);
    assert!(
        refused.message.contains(&format!("check {path}")),
        "{}",
        refused.message
    );
}

/// Review: PRIORITIES.md changed by someone during the hook is kept, and named; the rest is put
/// back.
#[test]
fn priorities_changed_during_the_hook_are_kept() {
    let repo = refusing("echo '- Written during the hook' >> specs/PRIORITIES.md");

    let refused = start(&repo);

    assert_left(&refused, "specs/PRIORITIES.md");
    assert!(
        repo.read("specs/PRIORITIES.md")
            .contains("- Written during the hook")
    );
    assert_eq!(repo.read(PROPOSAL_FILE), PROPOSAL);
    assert!(!repo.exists(&destination()));
}

/// Review: a file written at the proposal file's path during the hook is kept, and the proposal
/// stays in the dated folder, named.
#[test]
fn a_file_reappeared_at_the_proposal_files_path_is_kept() {
    let repo = refusing(&format!("printf 'Someone else' > {PROPOSAL_FILE}"));

    let refused = start(&repo);

    let moved = format!("{}/proposal.md", destination());
    assert_left(&refused, &moved);
    assert_eq!(repo.read(PROPOSAL_FILE), "Someone else");
    assert_eq!(repo.read(&moved), PROPOSAL);
    assert_eq!(repo.read("specs/PRIORITIES.md"), PRIORITIES);
}

/// Review: a file added to the dated folder during the hook is kept, with its folder, named; the
/// proposal file is back.
#[test]
fn a_file_added_to_the_dated_folder_is_kept() {
    let added = format!("{}/notes.md", destination());
    let repo = refusing(&format!("printf 'Notes' > {added}"));

    let refused = start(&repo);

    assert_left(&refused, &destination());
    assert_eq!(repo.read(&added), "Notes");
    assert!(!repo.exists(&format!("{}/proposal.md", destination())));
    assert_eq!(repo.read(PROPOSAL_FILE), PROPOSAL);
    assert_eq!(repo.read("specs/PRIORITIES.md"), PRIORITIES);
}

/// Review: a failed commit that moved `HEAD` is no refusal that committed nothing: the start's
/// files stay written, for it to be finished by hand.
#[test]
fn a_failed_commit_that_moved_head_puts_nothing_back() {
    let repo = refusing(
        "git update-ref HEAD \"$(git commit-tree 'HEAD^{tree}' -p HEAD -m 'chore: meanwhile')\"",
    );

    let refused = start(&repo);

    assert_eq!(refused.code, "refused", "{}", refused.message);
    assert!(refused.message.contains("Left: commit"), "{}", refused.message);
    assert_eq!(
        repo.read(&format!("{}/proposal.md", destination())),
        PROPOSAL
    );
    assert!(!repo.exists(PROPOSAL_FILE));
}

/// Review: a start's plan does not refuse what a queued write left uncommitted or staged: the
/// start checks it in its turn.
#[test]
fn a_start_is_planned_over_uncommitted_and_staged_files() {
    let repo = refusing("");
    repo.write("specs/README.md", "# Specs, edited\n");
    repo.write("specs/INBOX.md", "# Inbox\n");
    repo.git(&["add", "--", "specs/INBOX.md"]);

    let planned = api::plan_start(repo.path(), PROPOSAL_FILE, None, Kind::Feature).unwrap();

    assert_eq!(planned.slug, "login-banner");
}

/// Review: a `PRIORITIES.md` the start cannot read refuses it, rather than counting as none and
/// being written over.
#[test]
fn an_unreadable_priorities_file_refuses_the_start() {
    let repo = refusing("");
    let bytes = b"# Priorities\n\n## Now\n\n- \xff\n";
    std::fs::write(repo.path().join("specs/PRIORITIES.md"), bytes).unwrap();
    repo.commit("chore: an unreadable line");

    let refused = start(&repo);

    assert_eq!(refused.code, "refused", "{}", refused.message);
    assert_eq!(
        std::fs::read(repo.path().join("specs/PRIORITIES.md")).unwrap(),
        bytes
    );
    assert_eq!(repo.read(PROPOSAL_FILE), PROPOSAL);
}

/// Review: a folder where the feature's worktree goes refuses it as a taken slug, at the plan and
/// at the start.
#[test]
fn a_folder_where_the_worktree_goes_is_a_taken_slug() {
    let repo = refusing("");
    let folder = format!("{}-login-banner", uraeda_core::today::today());
    repo.write(&format!(".worktrees/{folder}/left-over.txt"), "x\n");

    let planned = api::plan_start(repo.path(), PROPOSAL_FILE, None, Kind::Feature);
    let refused = start(&repo);

    let taken = "A feature named login-banner exists already";
    assert_eq!(planned.err().map(|error| error.message).as_deref(), Some(taken));
    assert_eq!(refused.message, taken);
}
