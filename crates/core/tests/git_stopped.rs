//! The operation a checkout stopped in, and the commits refused while it is stopped.

mod common;

use common::repo::TestRepo;
use uraeda_core::api;
use uraeda_core::git::{Git, StoppedKind};

/// Edge case "A rebase stopped: an action commits on `main`": the stop is a pull, its sides
/// named by branch, and an action's commit is refused, `HEAD` left where the rebase put it.
#[test]
fn a_stopped_pull_refuses_every_commit() {
    let repo = TestRepo::with_origin();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    repo.stopped_pull();
    let head = repo.git(&["rev-parse", "HEAD"]);

    let stopped = Git::discover(repo.path()).unwrap().stopped().unwrap();
    assert_eq!(stopped.kind, StoppedKind::Pull);
    assert_eq!(
        (stopped.ours.as_str(), stopped.theirs.as_str()),
        ("origin/main", "main")
    );
    assert_eq!(stopped.stash, None);

    let read = api::read_inbox(repo.path()).unwrap();
    let refused = api::add_note_and_commit(repo.path(), None, None, "Icons are blurry", &read.hash)
        .unwrap_err();

    assert_eq!(
        refused.message,
        "A pull is stopped: continue or abort it first."
    );
    assert_eq!(repo.git(&["rev-parse", "HEAD"]), head);
}
