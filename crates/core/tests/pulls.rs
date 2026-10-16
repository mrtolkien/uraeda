use std::collections::BTreeMap;

use uraeda_core::pulls::{self, PullRequestState, PullRequestView, PullRequests};

/// A row of `gh pr list --json headRefName,number,url,isDraft,reviewDecision`.
fn row(branch: &str, number: u32, draft: bool, decision: &str) -> String {
    format!(
        r#"{{"headRefName":"{branch}","number":{number},"url":"https://github.com/o/r/pull/{number}","isDraft":{draft},"reviewDecision":"{decision}"}}"#
    )
}

fn view(number: u32, state: PullRequestState) -> PullRequestView {
    PullRequestView {
        number,
        url: format!("https://github.com/o/r/pull/{number}"),
        state,
    }
}

/// US1.2 to US1.4, review focus 2: changes requested win over a draft, and each row is kept by its
/// own branch name.
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
    let known = PullRequests::Known([("b".to_string(), view(31, PullRequestState::Open))].into());

    assert!(pulls::settle(&root, known.clone(), start));
    assert!(!pulls::settle(&root, PullRequests::Unavailable, minutes(9)));
    assert_eq!(pulls::latest(&root), known);
    assert!(pulls::settle(&root, PullRequests::Unavailable, minutes(11)));
    assert_eq!(pulls::latest(&root), PullRequests::Unavailable);
}
