//! The operation a checkout stopped in, and the commits refused while it is stopped.

mod common;

use common::repo::TestRepo;
use uraeda_core::api;
use uraeda_core::git::{Git, StoppedKind};

const REFUSED_PULL: &str = "A pull is stopped: continue or abort it first.";
const REFUSED_MERGE: &str = "A merge is stopped: continue or abort it first.";

/// Edge case "A rebase stopped: an action commits on `main`": the stop is a pull, its sides
/// named by branch, and an action is refused before it writes anything, `HEAD` left where the
/// rebase put it, even when the inbox already has a change of its own. Break: reaching the
/// rebasing checkout without the stop's refusal, which writes the inbox before the commit refuses.
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

    // The stopped checkout still holds `main`: a tool's check of a file of `main` passes there,
    // and the write itself is refused with the stop's text.
    api::on_default_branch(repo.path(), "specs/INBOX.md", "# Inbox\n\nEdited here\n").unwrap();

    let porcelain = repo.porcelain();
    let read = api::read_inbox(repo.path()).unwrap();
    let refused = api::add_note_and_commit(repo.path(), None, None, "Icons are blurry", &read.hash)
        .unwrap_err();

    assert_eq!(refused.message, REFUSED_PULL);
    assert_eq!(repo.git(&["rev-parse", "HEAD"]), head);
    assert_eq!(repo.porcelain(), porcelain);

    repo.write("specs/INBOX.md", "# Inbox\n\n- Typed by hand\n");
    let porcelain = repo.porcelain();
    let read = api::read_inbox(repo.path()).unwrap();
    let refused = api::add_note_and_commit(repo.path(), None, None, "Icons are blurry", &read.hash)
        .unwrap_err();

    assert_eq!(refused.message, REFUSED_PULL);
    assert_eq!(repo.porcelain(), porcelain);
}

/// A merge stopped on a conflict refuses an action before it writes, with its own text, and
/// `HEAD` stays. A stash put back with conflicts is no operation to end: nothing refuses, and with
/// no stash kept it names none.
#[test]
fn a_stopped_merge_refuses_every_commit_and_a_stash_does_not() {
    let repo = TestRepo::with_origin();
    repo.stopped_merge();
    let head = repo.git(&["rev-parse", "HEAD"]);
    let git = Git::discover(repo.path()).unwrap();
    assert_eq!(git.stopped().unwrap().kind, StoppedKind::Merge);

    let porcelain = repo.porcelain();
    let read = api::read_inbox(repo.path()).unwrap();
    let refused = api::add_note_and_commit(repo.path(), None, None, "Icons are blurry", &read.hash)
        .unwrap_err();

    assert_eq!(refused.message, REFUSED_MERGE);
    assert_eq!(repo.git(&["rev-parse", "HEAD"]), head);
    assert_eq!(repo.porcelain(), porcelain);

    let repo = TestRepo::with_origin();
    repo.write("README.md", "# Stashed\n");
    repo.git(&["stash", "--quiet"]);
    repo.write("README.md", "# Committed\n");
    repo.commit("docs: title");
    assert!(!repo.try_git(&["stash", "apply"]));
    repo.git(&["stash", "drop", "--quiet"]);
    let git = Git::discover(repo.path()).unwrap();
    let stopped = git.stopped().unwrap();
    assert_eq!((stopped.kind, stopped.stash), (StoppedKind::Stash, None));
    assert!(git.ensure_not_stopped().is_ok());
}
