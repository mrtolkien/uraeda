//! SC-001 of the CLI core: `ura status` and `ura next` complete in under 1 second on a repository
//! with 20 feature branches. The tests run the debug build, on machines of any speed, so the bound
//! is five times that; the release build on Linux x64 is the one the criterion names.

mod common;

use std::time::{Duration, Instant};

use common::*;

const BOUND: Duration = Duration::from_secs(5);

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

/// Runs `ura` with `args`, asserting it succeeds within the bound.
fn timed(repo: &TestRepo, args: &[&str]) -> Output {
    let start = Instant::now();
    let output = ura(repo, args);
    let elapsed = start.elapsed();
    assert_eq!(output.code, 0, "{args:?}: {}", output.stderr);
    assert!(elapsed < BOUND, "ura {args:?} took {elapsed:?}");
    output
}

#[test]
fn status_and_next_stay_fast_with_twenty_feature_branches() {
    let repo = twenty_features();

    let status = timed(&repo, &["status"]);
    timed(&repo, &["next"]);

    let listed = status
        .stdout
        .lines()
        .filter(|line| line.contains("-feature-"));
    assert_eq!(listed.count(), 20, "{}", status.stdout);
}
