//! What the main checkout holds: its commits to pull and to push, its changed files, and its
//! conflicts, each side named by branch.

mod common;

use common::repo::TestRepo;
use uraeda_core::git::{
    CheckoutState, Conflict, ConflictKind, FileChange, FileState, Git, Staged, StoppedKind,
};

fn state(repo: &TestRepo) -> CheckoutState {
    Git::discover(repo.path())
        .unwrap()
        .checkout_state()
        .unwrap()
}

fn file<'a>(state: &'a CheckoutState, path: &str) -> &'a FileChange {
    let found = state.files.iter().find(|file| file.path == path);
    found.unwrap_or_else(|| panic!("{path} is not listed in {:?}", state.files))
}

fn conflict<'a>(state: &'a CheckoutState, path: &str) -> &'a Conflict {
    let found = state
        .conflicts
        .iter()
        .find(|conflict| conflict.path == path);
    found.unwrap_or_else(|| panic!("{path} is not a conflict in {:?}", state.conflicts))
}

/// US1 1 and more 4, and the review focus's `main` with no upstream set: the counts are against
/// `origin/main`. Breaks: counting against the upstream configuration, which is unset here, or
/// swapping the two walks.
#[test]
fn the_state_counts_commits_to_pull_and_to_push() {
    let repo = TestRepo::with_origin();
    repo.git(&["branch", "--unset-upstream", "main"]);
    for n in 1..=2 {
        repo.write(&format!("local-{n}.md"), "local\n");
        repo.commit(&format!("chore: local {n}"));
    }
    for n in 1..=3 {
        repo.upstream_commit(&format!("upstream-{n}.md"), "upstream\n", "chore: upstream");
    }

    let state = state(&repo);

    assert_eq!(state.branch.as_deref(), Some("main"));
    assert!(state.has_remote);
    assert_eq!((state.ahead, state.behind), (2, 3));
}

/// US3 more 5, and the review focus's odd paths: every changed file is listed, untracked ones
/// "new", each with how much of it is staged, a path as itself. Break: reading only the index,
/// which misses the untracked note.
#[test]
fn the_state_lists_each_file_with_its_stage() {
    let repo = TestRepo::new();
    for path in ["docs/staged.md", "docs/partly.md", "gone.md"] {
        repo.write(path, "one\ntwo\n");
    }
    repo.commit("chore: files");
    repo.write("docs/staged.md", "one\ntwo\nthree\n");
    repo.write("docs/partly.md", "one\n");
    repo.git(&["add", "docs/staged.md", "docs/partly.md"]);
    repo.write("docs/partly.md", "one\nfour\nfive\n");
    repo.write("notes/a b ü.md", "a note\n");
    repo.write("big.txt", &"a line\n".repeat(200_000));
    repo.remove("gone.md");

    let state = state(&repo);

    let rows = [
        ("docs/staged.md", FileState::Modified, Staged::Yes),
        ("docs/partly.md", FileState::Modified, Staged::Partly),
        ("notes/a b ü.md", FileState::New, Staged::No),
        ("gone.md", FileState::Deleted, Staged::No),
    ];
    for (path, kind, staged) in rows {
        let file = file(&state, path);
        assert_eq!((file.state, file.staged), (kind, staged), "{path}");
    }
    let partly = file(&state, "docs/partly.md");
    assert_eq!((partly.added, partly.removed), (Some(2), Some(1)));
    // A text file past the cap is listed without counts, as a binary one: never diffed on a read.
    let big = file(&state, "big.txt");
    assert_eq!(
        (big.state, big.added, big.removed),
        (FileState::New, None, None)
    );
}

/// US4 1 and more 3, and the edge case of a binary conflict: a stop names its sides by branch,
/// whatever git calls "ours", and each conflict says how it conflicts. Break: naming stage 2
/// "main" during a rebase, where it is `origin/main`.
#[test]
fn a_conflict_names_its_sides_by_branch() {
    let pull = TestRepo::with_origin();
    pull.stopped_pull();
    let stopped = state(&pull);
    let side = stopped.stopped.as_ref().unwrap();
    assert_eq!(
        (side.kind, side.ours.as_str(), side.theirs.as_str()),
        (StoppedKind::Pull, "origin/main", "main")
    );
    let priorities = conflict(&stopped, "specs/PRIORITIES.md");
    assert_eq!(priorities.kind, ConflictKind::BothChanged);
    assert!(!priorities.is_resolved && !priorities.is_binary);
    assert!(
        stopped
            .files
            .iter()
            .all(|file| file.path != "specs/PRIORITIES.md")
    );
    pull.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Now\n\n- Upstream\n",
    );
    assert!(conflict(&state(&pull), "specs/PRIORITIES.md").is_resolved);

    let merge = TestRepo::new();
    merge.write_bytes("logo.png", &[0x89, b'P', b'N', b'G', 0, 1]);
    merge.commit("chore: logo");
    merge.switch_new("topic");
    merge.write_bytes("logo.png", &[0x89, b'P', b'N', b'G', 0, 2]);
    merge.commit("chore: topic's logo");
    merge.switch("main");
    merge.write_bytes("logo.png", &[0x89, b'P', b'N', b'G', 0, 3]);
    merge.commit("chore: main's logo");
    assert!(!merge.try_git(&["merge", "--no-edit", "topic"]));
    let merged = state(&merge);
    let side = merged.stopped.as_ref().unwrap();
    assert_eq!(
        (side.kind, side.theirs.as_str()),
        (StoppedKind::Merge, "topic")
    );
    assert!(conflict(&merged, "logo.png").is_binary);

    let deleted = TestRepo::with_origin();
    deleted.write("docs/old.md", "old\n");
    deleted.commit("chore: old");
    deleted.git(&["push", "--quiet", "origin", "main"]);
    deleted.upstream_remove("docs/old.md", "chore: drop old");
    deleted.write("docs/old.md", "changed\n");
    deleted.commit("chore: change old");
    assert!(!deleted.try_git(&["pull", "--rebase", "origin", "main"]));
    let kind = conflict(&state(&deleted), "docs/old.md").kind;
    assert_eq!(kind, ConflictKind::DeletedOurs);
}

/// The edge case of an autostash that cannot be put back: its files are conflicts, and the stash
/// is kept. Break: reading conflicts only while git has an operation in progress, which a
/// stash put back does not leave.
#[test]
fn a_stash_that_conflicts_lists_its_files_and_keeps_the_stash() {
    let repo = TestRepo::with_origin();
    repo.git(&["config", "rebase.autoStash", "true"]);
    repo.upstream_commit("README.md", "# Upstream\n", "docs: upstream title");
    repo.write("README.md", "# Local\n");

    repo.try_git(&["pull", "--rebase", "origin", "main"]);
    let state = state(&repo);

    let stopped = state.stopped.as_ref().unwrap();
    assert_eq!(
        (stopped.kind, stopped.stash.as_deref()),
        (StoppedKind::Stash, Some("stash@{0}"))
    );
    assert_eq!(
        conflict(&state, "README.md").kind,
        ConflictKind::BothChanged
    );
    assert!(!repo.git(&["stash", "list"]).is_empty());
}
