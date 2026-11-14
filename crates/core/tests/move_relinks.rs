//! A link to a file that moved: the check says where it went, and the fix relinks it.

mod common;

use common::repo::TestRepo;
use uraeda_core::check::{self, Fixed};

/// Numbered lines `<word> 1` to `<word> <count>`, for texts git compares line by line.
fn lines(word: &str, count: usize) -> String {
    (1..=count).map(|n| format!("{word} {n}\n")).collect()
}

/// The record linking every incident: the finished folder's proposal at line 88, then the
/// proposal edited during its start, a finished folder's question, a dropped feature, and a path
/// that never existed.
fn record() -> String {
    let mut text = String::from("# Record: Inbox again\n\n> [!NOTE]\n>\n> A record.\n\n");
    while text.lines().count() < 87 {
        text.push_str("A line.\n");
    }
    text.push_str("See [the start](/specs/2026-10-30-proposal-start/proposal.md).\n\n");
    text.push_str("From [the flow](../proposals/proposal-start-flow.md).\n\n");
    text.push_str(
        "As [Q6](../2026-10-10-cli-core/clarifications-01.md#q6-how-does-ura-run-git) says.\n\n",
    );
    text.push_str("Not [Dark mode](/specs/2026-11-05-dark-mode/proposal.md).\n\n");
    text.push_str("Nor [this](/specs/proposals/gone.md).\n");
    text
}

/// The `links.file` messages of a check of `specs/`, as `<file>:<line>: <message>`.
fn broken(repo: &TestRepo) -> Vec<String> {
    check::check(repo.path(), &repo.path().join("specs"))
        .unwrap()
        .into_iter()
        .filter(|problem| problem.rule == "links.file")
        .map(|problem| {
            format!(
                "{}:{}: {}",
                problem.file,
                problem.line.unwrap_or_default(),
                problem.message
            )
        })
        .collect()
}

/// SC-001: the six incidents, replayed with plain `git`, are each named by the check and relinked
/// by the fix, without a commit, the same bytes on every run.
#[test]
fn the_six_incidents_are_fixed() {
    let repo = TestRepo::new();
    let record_path = "specs/done/2026-10-30-inbox-again.md";
    repo.write("specs/proposals/proposal-start-flow.md", &lines("idea", 30));
    repo.write(
        "specs/2026-10-10-cli-core/clarifications-01.md",
        "# Clarifications\n\n### Q6: How does ura run git?\n\nThrough git.\n",
    );
    repo.write("specs/2026-11-05-dark-mode/proposal.md", &lines("dark", 10));
    repo.write(record_path, &record());
    repo.commit("chore: proposals and a record");

    // The start keeps about a third of the proposal: below git's rename threshold.
    repo.remove("specs/proposals/proposal-start-flow.md");
    repo.write(
        "specs/2026-10-30-proposal-start/proposal.md",
        &format!("{}{}", lines("idea", 10), lines("plan", 20)),
    );
    repo.commit("chore(proposal-start): start Proposal start");
    repo.remove("specs/2026-10-30-proposal-start/proposal.md");
    repo.write(
        "specs/done/2026-10-30-proposal-start.md",
        &lines("record", 10),
    );
    repo.commit("finish(proposal-start): Proposal start");
    repo.remove("specs/2026-10-10-cli-core/clarifications-01.md");
    repo.write("specs/done/2026-10-10-cli-core.md", &lines("core", 10));
    repo.commit("finish(cli-core): CLI core");
    repo.remove("specs/2026-11-05-dark-mode/proposal.md");
    repo.commit("chore(dark-mode): drop Dark mode");
    let dropped = repo.git(&["rev-parse", "--short=7", "HEAD"]);

    let found = broken(&repo);
    assert!(
        found.contains(&format!(
            "{record_path}:88: no file /specs/2026-10-30-proposal-start/proposal.md: it became the record /specs/done/2026-10-30-proposal-start.md"
        )),
        "{found:#?}"
    );
    assert!(
        found.iter().any(|line| line.ends_with(&format!(
            "no file /specs/2026-11-05-dark-mode/proposal.md: deleted in {} (chore(dark-mode): drop Dark mode)",
            dropped.trim()
        ))),
        "{found:#?}"
    );

    let fixed = check::fix(repo.path(), &repo.path().join("specs")).unwrap();

    assert_eq!(
        fixed,
        vec![Fixed {
            file: record_path.into(),
            links: 4
        }]
    );
    let text = repo.read(record_path);
    for written in [
        "[the start](/specs/done/2026-10-30-proposal-start.md)",
        "[the flow](2026-10-30-proposal-start.md)",
        "[Q6](2026-10-10-cli-core.md#q6-how-does-ura-run-git)",
        "Not Dark mode.",
        "[this](/specs/proposals/gone.md)",
    ] {
        assert!(text.contains(written), "{written}: {text}");
    }
    // A record's link to a file removed since is history, not a problem.
    assert_eq!(broken(&repo), Vec::<String>::new());
    assert_eq!(repo.porcelain(), format!(" M {record_path}\n"));

    repo.git(&["checkout", "--", "."]);
    check::fix(repo.path(), &repo.path().join("specs")).unwrap();
    assert_eq!(repo.read(record_path), text);
}

/// A note made a proposal by hand, its main file renamed: a file linking both the note file and
/// its folder has each relinked by its own move, the more specific one first.
#[test]
fn a_main_file_link_beside_its_folder_link_follows_its_own_move() {
    let repo = TestRepo::new();
    let record_path = "specs/done/2026-10-30-notes.md";
    repo.write("specs/notes/x/note.md", &lines("x", 10));
    repo.write("specs/notes/x/images/i.png", &lines("png", 10));
    repo.write(
        record_path,
        "# Record: Notes\n\nSee [the note](/specs/notes/x/note.md) in [its folder](/specs/notes/x/).\n",
    );
    repo.commit("chore: a note and a record");
    std::fs::remove_dir_all(repo.path().join("specs/notes/x")).unwrap();
    repo.write("specs/proposals/x/proposal.md", &lines("proposal", 10));
    repo.write("specs/proposals/x/images/i.png", &lines("png", 10));
    repo.commit("chore: make the note x a proposal");

    let fixed = check::fix(repo.path(), &repo.path().join("specs")).unwrap();

    assert_eq!(
        fixed,
        vec![Fixed {
            file: record_path.into(),
            links: 2
        }]
    );
    let text = repo.read(record_path);
    assert!(
        text.contains(
            "[the note](/specs/proposals/x/proposal.md) in [its folder](/specs/proposals/x/)"
        ),
        "{text}"
    );
    assert_eq!(broken(&repo), Vec::<String>::new());
}

/// A fix given the top level relinks the links of the `specs/` folders under it.
#[test]
fn a_fix_of_the_top_level_relinks_its_specs_folders() {
    let repo = TestRepo::new();
    let record_path = "specs/done/2026-10-30-flow.md";
    repo.write("specs/proposals/flow.md", &lines("idea", 10));
    repo.write(
        record_path,
        "# Record: Flow\n\nFrom [the flow](/specs/proposals/flow.md).\n",
    );
    repo.commit("chore: a proposal and a record");
    repo.git(&["mv", "specs/proposals/flow.md", "specs/proposals/flows.md"]);
    repo.commit("chore: rename the flow");

    let fixed = check::fix(repo.path(), repo.path()).unwrap();

    assert_eq!(
        fixed,
        vec![Fixed {
            file: record_path.into(),
            links: 1
        }]
    );
    assert!(
        repo.read(record_path)
            .contains("[the flow](/specs/proposals/flows.md)")
    );
}
