mod common;

use std::collections::BTreeMap;

use common::repo::TestRepo;
use common::texts::record;
use uraeda_core::git::Git;
use uraeda_core::pulls::{self, PullRequestState, PullRequestView, PullRequests};
use uraeda_core::steps::StepName;
use uraeda_core::workspace::{Feature, Kind};

/// A row of `gh pr list --json headRefName,headRefOid,number,url,isDraft,reviewDecision`, its head
/// the number's digit repeated.
fn row(branch: &str, number: u32, draft: bool, decision: &str) -> String {
    let head = head(number);
    format!(
        r#"{{"headRefName":"{branch}","headRefOid":"{head}","number":{number},"url":"https://github.com/o/r/pull/{number}","isDraft":{draft},"reviewDecision":"{decision}"}}"#
    )
}

/// The head of pull request `number`, in the rows: its last digit, 40 times.
fn head(number: u32) -> String {
    (number % 10).to_string().repeat(40)
}

fn view(number: u32, state: PullRequestState) -> PullRequestView {
    PullRequestView {
        number,
        url: format!("https://github.com/o/r/pull/{number}"),
        state,
        head: head(number),
    }
}

/// US1.2 to US1.4, review focus 2: changes requested win over a proposal file, and each row is kept
/// by its own branch name.
#[test]
fn parse_rows() {
    let rows = [
        (
            "a draft",
            format!("[{}]", row("2026-10-20-x", 31, true, "")),
            Some(vec![("2026-10-20-x", view(31, PullRequestState::Draft))]),
        ),
        (
            "an open one",
            format!("[{}]", row("2026-10-20-x", 31, false, "REVIEW_REQUIRED")),
            Some(vec![("2026-10-20-x", view(31, PullRequestState::Open))]),
        ),
        (
            "changes requested on a draft",
            format!("[{}]", row("2026-10-20-x", 31, true, "CHANGES_REQUESTED")),
            Some(vec![(
                "2026-10-20-x",
                view(31, PullRequestState::ChangesRequested),
            )]),
        ),
        ("an empty list", "[]".to_string(), Some(vec![])),
        ("invalid JSON", "not json".to_string(), None),
        (
            "another branch's row",
            format!(
                "[{},{}]",
                row("2026-10-20-other", 7, false, ""),
                row("2026-10-20-x", 31, true, "")
            ),
            Some(vec![
                ("2026-10-20-other", view(7, PullRequestState::Open)),
                ("2026-10-20-x", view(31, PullRequestState::Draft)),
            ]),
        ),
    ];
    for (name, json, expected) in rows {
        let expected: Option<BTreeMap<String, PullRequestView>> = expected.map(|rows| {
            rows.into_iter()
                .map(|(branch, view)| (branch.to_string(), view))
                .collect()
        });

        assert_eq!(pulls::parse(json.as_bytes()), expected, "{name}");
    }
}

/// A failed `gh` keeps the last known pull requests for up to 10 minutes, then gives them up.
#[test]
fn a_failed_fetch_keeps_the_last_snapshot_for_ten_minutes() {
    let root = std::path::PathBuf::from("/tmp/uraeda-pulls-settle-test");
    let start = std::time::SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(1_000_000);
    let minutes = |n: u64| start + std::time::Duration::from_secs(60 * n);
    let known = PullRequests::open([("b".to_string(), view(31, PullRequestState::Open))]);

    assert!(pulls::settle(&root, known.clone(), start));
    assert!(!pulls::settle(&root, PullRequests::Unavailable, minutes(9)));
    assert_eq!(pulls::latest(&root), known);
    assert!(pulls::settle(&root, PullRequests::Unavailable, minutes(11)));
    assert_eq!(pulls::latest(&root), PullRequests::Unavailable);
}

/// The head of the merged pull request #75 of the test feature's branch.
fn merged(head: &str) -> PullRequests {
    let json = format!(
        r#"[{{"headRefName":"2026-10-10-x","headRefOid":"{head}","number":75,"url":"https://github.com/o/r/pull/75"}}]"#
    );
    PullRequests::Known {
        open: BTreeMap::new(),
        merged: pulls::parse_merged(json.as_bytes()).unwrap(),
    }
}

/// The test feature's branch, `parent` then `tip`: the two commits' hashes.
fn branch(repo: &TestRepo) -> (String, String) {
    let head = || repo.git(&["rev-parse", "HEAD"]).trim().to_string();
    repo.switch_new("2026-10-10-x");
    repo.write("a.md", "a\n");
    repo.commit("feat: the work");
    let parent = head();
    repo.write("b.md", "b\n");
    repo.commit("feat: more work");
    let tip = head();
    repo.switch("main");
    (parent, tip)
}

/// US5 more 1: a pull request merged on GitHub whose head is the branch's latest commit makes its
/// feature done, without a fetch; one whose head lacks it leaves the feature's step as it is. A head
/// never fetched counts as merged when the branch has nothing unpushed (R2).
#[test]
fn a_merged_pull_request_holding_the_tip_makes_the_feature_done() {
    let repo = TestRepo::new();
    let (parent, tip) = branch(&repo);
    let git = Git::discover(repo.path()).unwrap();
    let rows = [
        ("its head is the tip", tip.clone(), None, StepName::Done),
        (
            "commits after its head",
            parent.clone(),
            None,
            StepName::Finish,
        ),
        (
            "its head never fetched, never pushed",
            head(7),
            None,
            StepName::Finish,
        ),
        (
            "its head never fetched, all pushed",
            head(7),
            Some(&tip),
            StepName::Done,
        ),
        (
            "its head never fetched, commits unpushed",
            head(7),
            Some(&parent),
            StepName::Finish,
        ),
    ];
    for (name, head, pushed, expected) in rows {
        let remote = "refs/remotes/origin/2026-10-10-x";
        match pushed {
            Some(commit) => repo.git(&["update-ref", remote, commit]),
            None => repo.git(&["update-ref", "-d", remote]),
        };
        let mut feature =
            Feature::from_record(Kind::Feature, "2026-10-10-x", record("feature", "X"));

        merged(&head).apply(&mut feature, &git);

        assert_eq!(feature.step.name, expected, "{name}");
    }
}
