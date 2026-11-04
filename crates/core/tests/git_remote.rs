//! Fetching, pulling, and pushing the checked-out branch, against a bare `origin` on disk.

mod common;

use common::repo::{TestRepo, unauthorized_remote, without_user_git_config};
use std::time::Duration;

use uraeda_core::git::{FETCH_DEADLINE, Git, GitError, SYNC_DEADLINE, StoppedKind};

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

/// Review focus 3: a pull passes `--rebase` only when no key says how to pull, and nothing syncs
/// while a pull is stopped. Breaks: dropping `branch.<branch>.rebase`, or `pull.ff`, from the keys
/// read; dropping the stopped check, which refuses a pull for a detached `HEAD` instead.
#[test]
fn a_pull_reads_every_key_that_says_how() {
    without_user_git_config();

    // `branch.main.rebase false` merges.
    let repo = TestRepo::diverged();
    repo.git(&["config", "branch.main.rebase", "false"]);
    git(&repo).pull(None).unwrap();
    assert_eq!(
        repo.git(&["rev-parse", "HEAD^2"]),
        repo.git(&["rev-parse", "origin/main"])
    );

    // `pull.ff only` refuses diverged branches, as git does, and nothing moves.
    let repo = TestRepo::diverged();
    repo.git(&["config", "pull.ff", "only"]);
    let head = repo.git(&["rev-parse", "HEAD"]);
    assert!(git(&repo).pull(None).is_err());
    assert_eq!(repo.git(&["rev-parse", "HEAD"]), head);

    // A stopped pull refuses another pull and a push.
    let repo = TestRepo::with_origin();
    repo.stopped_pull();
    let stopped = "A pull is stopped: continue or abort it first.";
    assert_eq!(refusal(git(&repo).pull(None)), stopped);
    assert_eq!(refusal(git(&repo).push(None)), stopped);
}

/// The edge case "Push rejected": a push a hook of `origin` refuses keeps git's message, the
/// hook's, and is not read as commits to pull. Break: matching any "rejected".
#[test]
fn a_push_a_hook_refuses_keeps_git_message() {
    without_user_git_config();
    let repo = TestRepo::with_origin();
    let hook = repo.parent().join("origin.git/hooks/pre-receive");
    std::fs::create_dir_all(hook.parent().unwrap()).unwrap();
    std::fs::write(&hook, "#!/bin/sh\necho 'main is protected'\nexit 1\n").unwrap();
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).unwrap();
    }
    repo.write("local.md", "local\n");
    repo.commit("chore: local");

    let failed = git(&repo).push(None).unwrap_err();

    assert!(!matches!(failed, GitError::Refused(_)), "{failed:?}");
    let failed = failed.to_string();
    assert!(failed.contains("main is protected"), "{failed}");
}

/// Review I1: a remote that never answers is stopped at the deadline, with whatever it started,
/// so no write waits behind it. `origin`'s upload-pack sleeps for an hour: the fetch returns only
/// once every process holding its output is gone. Breaks: no deadline, which hangs until nextest
/// stops the test; killing git alone, which leaves the sleep holding git's stderr.
#[test]
fn a_fetch_that_never_answers_is_stopped() {
    without_user_git_config();
    let repo = TestRepo::with_origin();
    repo.git(&["config", "remote.origin.uploadpack", "sleep 3600; :"]);

    let failed = git(&repo)
        .fetch_within(Duration::from_secs(1), None)
        .unwrap_err()
        .to_string();

    assert_eq!(
        failed,
        "git fetch failed: origin gave no answer in 1 second, so the fetch was stopped."
    );
    assert_eq!(FETCH_DEADLINE, Duration::from_secs(120));
}

/// Final review I1: a pull or a push on a remote that never answers is stopped at its deadline, as
/// a fetch is, so a hung ssh holds no save behind it. A pull stopped inside its rebase, its
/// `post-checkout` hook asleep, leaves the rebase in progress: the page shows the stop, and Abort
/// puts the branch back. Breaks: no deadline, which hangs until nextest stops the test.
#[test]
fn a_pull_or_a_push_that_never_answers_is_stopped() {
    without_user_git_config();
    let repo = TestRepo::diverged();
    repo.git(&["config", "remote.origin.uploadpack", "sleep 3600; :"]);
    let failed = git(&repo)
        .pull_within(Duration::from_secs(1), None)
        .unwrap_err()
        .to_string();
    assert_eq!(
        failed,
        "git pull failed: origin gave no answer in 1 second, so the pull was stopped."
    );
    assert_eq!(git(&repo).stopped(), None);

    let repo = TestRepo::with_origin();
    repo.write("local.md", "local\n");
    repo.commit("chore: local");
    repo.git(&["config", "remote.origin.receivepack", "sleep 3600; :"]);
    let failed = git(&repo)
        .push_within(Duration::from_secs(1), None)
        .unwrap_err()
        .to_string();
    assert_eq!(
        failed,
        "git push failed: origin gave no answer in 1 second, so the push was stopped."
    );
    assert_eq!(SYNC_DEADLINE, Duration::from_secs(600));

    // Stopped inside the rebase: the fetch ran, and the hook sleeps once `HEAD` is detached. The
    // deadline leaves the local fetch ample room, so only the hook can reach it.
    let repo = TestRepo::diverged();
    let head = repo.git(&["rev-parse", "main"]);
    repo.write(".git/hooks/post-checkout", "#!/bin/sh\nsleep 3600\n");
    std::fs::set_permissions(
        repo.path().join(".git/hooks/post-checkout"),
        std::os::unix::fs::PermissionsExt::from_mode(0o755),
    )
    .unwrap();
    let failed = git(&repo)
        .pull_within(Duration::from_secs(10), None)
        .unwrap_err()
        .to_string();
    assert!(failed.contains("so the pull was stopped"), "{failed}");
    assert_eq!(
        git(&repo).stopped().map(|stopped| stopped.kind),
        Some(StoppedKind::Pull)
    );
    repo.remove(".git/hooks/post-checkout");
    git(&repo).abort_stopped(None).unwrap();
    assert_eq!(repo.git(&["rev-parse", "main"]), head);
}
