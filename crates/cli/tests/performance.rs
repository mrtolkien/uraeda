//! SC-001 of the CLI core: `ura status` and `ura next` complete in under 1 second on a repository
//! with 20 feature branches. The test checks what they print; the benchmark, run by `vp run bench`,
//! their time. It runs the debug build, on machines of any speed, so the bound is five times the
//! criterion's; the release build on Linux x64 is the one the criterion names.
//!
//! SC-002 of the inbox: `ura note` writes and commits a note in under 200 ms, bounded the same way.

mod common;

use std::time::{Duration, Instant};

use common::*;

const BOUND: Duration = Duration::from_secs(5);
const NOTE_BOUND: Duration = Duration::from_secs(1);

/// A repository with 20 feature branches, half waiting on the human, half on an agent.
fn twenty_features() -> TestRepo {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    );
    for index in 1..=20 {
        let round = if index % 2 == 0 {
            clarifications("awaiting-human", "One question, about 2 minutes.", &[""])
        } else {
            clarifications("answered", "Answered on 2026-10-08.", &["A"])
        };
        feature(
            &repo,
            &format!("2026-10-10-feature-{index:02}"),
            &[("proposal.md", proposal()), ("clarifications-01.md", round)],
        );
    }
    repo
}

/// Runs `ura` with `args`, asserting it succeeds.
fn run(repo: &TestRepo, args: &[&str]) -> Output {
    let output = ura(repo, args);
    assert_eq!(output.code, 0, "{args:?}: {}", output.stderr);
    output
}

/// Asserts that `ura status` lists every one of the 20 features.
fn assert_twenty_listed(status: &Output) {
    let listed = status
        .stdout
        .lines()
        .filter(|line| line.contains("-feature-"));
    assert_eq!(listed.count(), 20, "{}", status.stdout);
}

#[test]
fn status_and_next_list_twenty_feature_branches() {
    let repo = twenty_features();

    let status = run(&repo, &["status"]);
    run(&repo, &["next"]);

    assert_twenty_listed(&status);
}

/// Runs `ura` with `args`, asserting it succeeds within the bound.
fn timed(repo: &TestRepo, args: &[&str]) -> Output {
    let start = Instant::now();
    let output = run(repo, args);
    let elapsed = start.elapsed();
    assert!(elapsed < BOUND, "ura {args:?} took {elapsed:?}");
    output
}

#[test]
#[ignore = "benchmark"]
fn bench_status_and_next_stay_fast_with_twenty_feature_branches() {
    let repo = twenty_features();

    let status = timed(&repo, &["status"]);
    timed(&repo, &["next"]);

    assert_twenty_listed(&status);
}

#[test]
#[ignore = "benchmark"]
fn bench_note_writes_and_commits_within_its_bound() {
    let repo = twenty_features();
    repo.write(
        "specs/INBOX.md",
        &std::fs::read_to_string(fixture("repo/main/specs/INBOX.md")).unwrap(),
    );
    repo.commit("chore: the inbox");

    let start = Instant::now();
    run(
        &repo,
        &[
            "note",
            "Status hangs on a broken worktree",
            "--category",
            "CLI",
        ],
    );
    let elapsed = start.elapsed();

    assert!(elapsed < NOTE_BOUND, "ura note took {elapsed:?}");
    assert_eq!(
        repo.subjects("main")[0],
        "chore: add \"Status hangs on a broken worktree\" to the inbox"
    );
}
