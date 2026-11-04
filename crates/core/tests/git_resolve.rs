//! Resolving a stopped pull or merge, continuing or aborting it, and merging a branch into `main`.

mod common;

use common::repo::TestRepo;
use uraeda_core::git::{Git, GitError, Resolution, StoppedKind};

const PRIORITIES: &str = "specs/PRIORITIES.md";

fn refusal<T: std::fmt::Debug>(result: Result<T, GitError>) -> String {
    match result {
        Err(GitError::Refused(text)) => text,
        other => panic!("not refused: {other:?}"),
    }
}

/// US4 3, more 1, more 2; edge "Abort after files were resolved": `Theirs` keeps `main`'s side
/// and `Ours` `origin/main`'s, as the sides are named during a rebase. Break: `git add` of every
/// conflicted file before checking for markers, which stages the markers.
#[test]
fn a_stopped_pull_continues_once_resolved_or_aborts() {
    let repo = TestRepo::with_origin();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    repo.stopped_pull();
    let git = Git::discover(repo.path()).unwrap();

    let refused = git.continue_stopped(None);
    assert_eq!(refusal(refused), "1 file still conflicts.");
    assert_eq!(repo.unmerged(), [PRIORITIES]);

    git.resolve_conflict(PRIORITIES, Resolution::Theirs)
        .unwrap();
    assert_eq!(repo.read(PRIORITIES), "# Priorities\n\n## Now\n\n- Local\n");
    git.continue_stopped(None).unwrap();

    assert_eq!(git.stopped(), None);
    assert_eq!(repo.current_branch(), "main");
    assert_eq!(repo.ahead(), 1);
    assert_eq!(repo.subjects("main")[0], "chore: local priorities");

    let repo = TestRepo::with_origin();
    repo.stopped_pull_autostashed("README.md", "# Test\n\nEdited\n");
    let start = repo.git(&["rev-parse", "refs/heads/main"]);
    let git = Git::discover(repo.path()).unwrap();
    git.resolve_conflict(PRIORITIES, Resolution::Ours).unwrap();
    assert_eq!(
        repo.read(PRIORITIES),
        "# Priorities\n\n## Now\n\n- Upstream\n"
    );

    git.abort_stopped(None).unwrap();

    assert_eq!(git.stopped(), None);
    assert_eq!(repo.git(&["rev-parse", "HEAD"]), start);
    assert_eq!(repo.read("README.md"), "# Test\n\nEdited\n");
}

/// US5 1, 2; edge "A ref name starting with `-`". Break: dropping `--end-of-options`, which reads
/// `-x` as an option.
#[test]
fn merge_brings_a_branch_into_main() {
    let repo = TestRepo::with_origin();
    repo.branch("2026-11-04-vim-mode");
    repo.add_on_branch("2026-11-04-vim-mode", "specs/vim.md", "# Vim\n");
    let git = Git::discover(repo.path()).unwrap();

    git.merge_branch("2026-11-04-vim-mode", None).unwrap();
    assert_eq!(repo.ahead(), 1);

    repo.branch("dash");
    repo.add_on_branch("dash", "dash.md", "# Dash\n");
    repo.git(&["update-ref", "refs/heads/-x", "dash"]);
    git.merge_branch("-x", None).unwrap();
    assert_eq!(repo.ahead(), 2);
    assert!(repo.exists("dash.md"));

    repo.switch_new("topic");
    repo.write("README.md", "# Topic\n");
    repo.write("specs/vim.md", "# Topic's vim\n");
    repo.commit("chore: topic");
    repo.switch("main");
    repo.write("README.md", "# Main\n");
    repo.write("specs/vim.md", "# Main's vim\n");
    repo.commit("chore: main");

    git.merge_branch("topic", None).unwrap();

    let stopped = git.stopped().unwrap();
    assert_eq!(stopped.kind, StoppedKind::Merge);
    assert_eq!(repo.unmerged(), ["README.md", "specs/vim.md"]);
}
