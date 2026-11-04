//! Fetching, pulling, and pushing the checked-out branch, against a bare `origin` on disk.

mod common;

use common::repo::{TestRepo, unauthorized_remote, without_user_git_config};
use uraeda_core::git::{Git, GitError, StoppedKind};

fn git(repo: &TestRepo) -> Git {
    Git::discover(repo.path()).unwrap()
}

/// The text of a refused write, or a panic naming what came instead.
fn refusal(result: Result<(), GitError>) -> String {
    match result {
        Err(GitError::Refused(text)) => text,
        other => panic!("not refused: {other:?}"),
    }
}

/// US1 2 and alternative flows 1 to 3, with the edge cases "No `origin`", "Detached `HEAD`", and
/// review focus 3, `main` with no upstream set. Each row starts from 2 commits to push and 3 to
/// pull. Breaks: always passing `--rebase`, which ignores `pull.rebase false`; passing
/// `--autostash`, which ignores the configuration.
#[test]
fn a_pull_follows_the_configuration_and_rebases_by_default() {
    without_user_git_config();

    // No configuration: the 2 local commits are rebased onto the 3, with no merge commit.
    let repo = TestRepo::diverged();
    git(&repo).pull(None).unwrap();
    assert_eq!(repo.count("origin/main..main"), 2);
    assert_eq!(repo.count("main..origin/main"), 0);
    assert_eq!(
        repo.git(&["rev-list", "--count", "--merges", "origin/main..main"]),
        "0\n"
    );

    // `pull.rebase false` merges: a merge commit whose second parent is `origin/main`.
    let repo = TestRepo::diverged();
    repo.git(&["config", "pull.rebase", "false"]);
    git(&repo).pull(None).unwrap();
    assert_eq!(
        repo.git(&["rev-parse", "HEAD^2"]),
        repo.git(&["rev-parse", "origin/main"])
    );

    // An uncommitted edit with `rebase.autoStash true` is put back, still changed.
    let repo = TestRepo::diverged();
    repo.git(&["config", "rebase.autoStash", "true"]);
    repo.write("README.md", "# Test, edited\n");
    git(&repo).pull(None).unwrap();
    assert_eq!(repo.count("main..origin/main"), 0);
    assert_eq!(repo.read("README.md"), "# Test, edited\n");

    // The same edit without it: git refuses, and nothing moves.
    let repo = TestRepo::diverged();
    repo.write("README.md", "# Test, edited\n");
    let head = repo.git(&["rev-parse", "HEAD"]);
    let refused = git(&repo).pull(None).unwrap_err().to_string();
    assert!(refused.contains("You have unstaged changes"), "{refused}");
    assert_eq!(repo.git(&["rev-parse", "HEAD"]), head);
    assert_eq!(repo.read("README.md"), "# Test, edited\n");

    // A conflict stops the pull, which succeeds: the stop shows it.
    let repo = TestRepo::with_origin();
    repo.stopped_pull();
    repo.git(&["rebase", "--abort"]);
    git(&repo).pull(None).unwrap();
    assert_eq!(
        git(&repo).stopped().map(|stopped| stopped.kind),
        Some(StoppedKind::Pull)
    );

    // `main` with no upstream set still pulls `origin/main`.
    let repo = TestRepo::diverged();
    repo.git(&["branch", "--unset-upstream", "main"]);
    git(&repo).pull(None).unwrap();
    assert_eq!(repo.count("main..origin/main"), 0);
    assert_eq!(repo.count("origin/main..main"), 2);

    // No `origin`: nothing to fetch, and a pull and a push are refused.
    let repo = TestRepo::new();
    git(&repo).fetch(None).unwrap();
    assert_eq!(
        refusal(git(&repo).pull(None)),
        "There is no remote to pull from."
    );
    assert_eq!(
        refusal(git(&repo).push(None)),
        "There is no remote to push to."
    );

    // A detached `HEAD`: a pull and a push are refused, naming the default branch.
    let repo = TestRepo::diverged();
    repo.git(&["switch", "--quiet", "--detach"]);
    let detached = "main is not checked out: HEAD is detached.";
    assert_eq!(refusal(git(&repo).pull(None)), detached);
    assert_eq!(refusal(git(&repo).push(None)), detached);
}

/// US1 3, the edge case "Push rejected", and SC-003: a push `origin` rejects is refused, and
/// `origin` keeps its commits; once pulled, it lands. Break: retrying with
/// `--force-with-lease`, which overwrites `origin`'s commit.
#[test]
fn a_push_never_forces() {
    without_user_git_config();
    let repo = TestRepo::with_origin();
    repo.write("local.md", "local\n");
    repo.commit("chore: local");
    repo.upstream_commit("upstream.md", "upstream\n", "chore: upstream");
    let upstream = repo.origin_rev("main");

    let refused = refusal(git(&repo).push(None));

    assert_eq!(refused, "origin has commits main lacks: pull first.");
    assert_eq!(repo.origin_rev("main"), upstream);

    git(&repo).pull(None).unwrap();
    git(&repo).push(None).unwrap();
    assert_eq!(repo.count("origin/main..main"), 0);
    assert_eq!(repo.origin_rev("main"), repo.git(&["rev-parse", "main"]));
}

/// US1 alternative flow 5 and the edge case "Fetch fails for credentials": a remote asking for a
/// password fails at once with git's line and the hint. Break: running git without
/// `GIT_TERMINAL_PROMPT=0`, which prompts at a terminal, or fails with another line without one.
#[test]
fn a_credential_failure_says_how_to_give_one() {
    without_user_git_config();
    let repo = TestRepo::with_origin();
    let url = unauthorized_remote();
    repo.git(&["remote", "set-url", "origin", &url]);
    // No askpass program either, so the only way left to ask is the terminal.
    repo.git(&["config", "core.askPass", ""]);

    let failed = git(&repo).fetch(None).unwrap_err().to_string();

    assert_eq!(
        failed,
        format!(
            "git fetch failed: fatal: could not read Username for '{}': terminal prompts \
             disabled The server runs git without a terminal: give it a credential helper or an \
             ssh-agent.",
            url.trim_end_matches("/origin.git")
        )
    );
}
