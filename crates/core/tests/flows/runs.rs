//! What a runner and the UI ask the core about a feature: where to work, what comes next, what its
//! branch changed, and what its pull request is.

use std::collections::BTreeMap;
use std::path::Path;

use uraeda_core::api;
use uraeda_core::changes::branch_changes;
use uraeda_core::pulls::{self, PullRequestState, PullRequestView, PullRequests};

use crate::common::repo::TestRepo;
use crate::common::texts::{clarifications, proposal, record};

const FOLDER: &str = "2026-10-11-web-ui";
const DIR: &str = "specs/2026-10-11-web-ui";

/// `main` with a feature branch whose round is answered, checked out nowhere.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", "# Priorities\n\n## Now\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write(&format!("{DIR}/proposal.md"), &proposal());
    repo.write(
        &format!("{DIR}/clarifications-01.md"),
        &clarifications("answered", "Answered.", &["A"]),
    );
    repo.commit("discovery(web-ui): answer round 01");
    repo.switch("main");
    repo
}

#[test]
fn the_next_step_names_who_waits_and_what_an_agent_reads() {
    let repo = repo();

    let agent = api::next_step(repo.path(), FOLDER).unwrap();
    repo.switch(FOLDER);
    repo.write(
        &format!("{DIR}/clarifications-02.md"),
        &clarifications("awaiting-human", "1 question.", &[""]),
    );
    repo.commit("discovery(web-ui): round 02");
    repo.switch("main");
    let human = api::next_step(repo.path(), FOLDER).unwrap();

    assert_eq!(agent.step.waits_on, "agent");
    assert!(
        agent.step.reference.is_some(),
        "an agent's step names the reference to read"
    );
    assert_eq!(human.step.waits_on, "human");
    assert_eq!(human.step.file.as_deref(), Some("clarifications-02.md"));
    assert!(api::next_step(repo.path(), "2026-10-12-nothing").is_err());
}

#[test]
fn work_happens_in_the_checkout_that_has_the_branch_or_in_a_worktree_made_for_it() {
    let repo = repo();

    let made = api::work_dir(repo.path(), FOLDER).unwrap();
    assert_eq!(
        Path::new(&made),
        repo.path().join(".worktrees").join(FOLDER)
    );
    assert!(Path::new(&made).join(DIR).join("proposal.md").exists());
    assert_eq!(repo.current_branch(), "main");
    assert_eq!(
        Path::new(&api::main_root(Path::new(&made)).unwrap()),
        repo.path().canonicalize().unwrap(),
        "a worktree's main checkout is the repository's"
    );

    let other = self::repo();
    other.switch(FOLDER);
    assert_eq!(
        Path::new(&api::work_dir(other.path(), FOLDER).unwrap()),
        other.path()
    );
    assert!(!other.exists(".worktrees"));
}

#[test]
fn a_merged_feature_has_no_branch_to_work_on() {
    let repo = repo();
    repo.switch(FOLDER);
    repo.git(&["rm", "-r", "--quiet", DIR]);
    repo.write(
        &format!("specs/done/{FOLDER}.md"),
        &record("feature", "Web UI"),
    );
    repo.commit("finish: web UI");
    repo.switch("main");
    repo.git(&["merge", "--quiet", "--no-ff", "--no-edit", FOLDER]);
    repo.delete_branch(FOLDER);

    assert!(api::work_dir(repo.path(), FOLDER).is_err());
    assert!(!repo.exists(".worktrees"));
}

#[test]
fn a_branch_lists_the_files_it_changed_outside_its_folder_from_the_merge_base() {
    let repo = repo();
    repo.switch(FOLDER);
    repo.write("src/a.rs", "fn a() {}\nfn b() {}\n");
    repo.write("docs/shot.png", "\u{89}PNG\r\n\u{1a}\n\0\0\0");
    repo.write(&format!("{DIR}/plan.md"), "# Plan\n");
    repo.commit("work");
    repo.switch("main");
    repo.write("src/main.rs", "fn main() {}\n");
    repo.commit("main moves on");

    let changes = branch_changes(repo.path(), FOLDER).unwrap().unwrap();

    let files: Vec<&str> = changes
        .files
        .iter()
        .map(|file| file.path.as_str())
        .collect();
    assert_eq!(
        files,
        ["docs/shot.png", "src/a.rs"],
        "not the folder's files, not main's own"
    );
    assert_eq!(changes.count, 2);
    assert_eq!(
        changes.files[0].added, None,
        "a binary file has no line counts"
    );
    assert_eq!((changes.added, changes.removed), (2, 0));
    assert!(branch_changes(repo.path(), "2026-10-12-nothing").is_err());
}

#[test]
fn a_renamed_file_and_an_unusual_path_are_listed_by_their_new_path() {
    let repo = repo();
    repo.write("a.txt", "same\nsame\nsame\nsame\n");
    repo.commit("a");
    repo.switch(FOLDER);
    repo.git(&["merge", "--quiet", "main"]);
    repo.git(&["mv", "a.txt", "b.txt"]);
    repo.write("docs/a file, with \"quotes\" é.md", "text\n");
    repo.commit("rename and add");
    repo.switch("main");

    let changes = branch_changes(repo.path(), FOLDER).unwrap().unwrap();

    let files: Vec<&str> = changes
        .files
        .iter()
        .map(|file| file.path.as_str())
        .collect();
    assert_eq!(files, ["b.txt", "docs/a file, with \"quotes\" é.md"]);
}

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

#[test]
fn a_pull_request_is_read_by_its_branch_and_changes_requested_wins_over_a_draft() {
    let rows = [
        (
            "a draft",
            format!("[{}]", row("b", 31, true, "")),
            Some(PullRequestState::Draft),
        ),
        (
            "an open one",
            format!("[{}]", row("b", 31, false, "REVIEW_REQUIRED")),
            Some(PullRequestState::Open),
        ),
        (
            "changes requested on a draft",
            format!("[{}]", row("b", 31, true, "CHANGES_REQUESTED")),
            Some(PullRequestState::ChangesRequested),
        ),
    ];
    for (name, json, state) in rows {
        let parsed = pulls::parse(json.as_bytes()).unwrap();

        assert_eq!(parsed.get("b").map(|v| v.state), state, "{name}");
    }
    let two = format!(
        "[{},{}]",
        row("other", 7, false, ""),
        row("b", 31, true, "")
    );
    assert_eq!(pulls::parse(two.as_bytes()).unwrap().len(), 2);
    assert_eq!(pulls::parse(b"not json"), None);
    assert_eq!(pulls::parse(b"[]"), Some(BTreeMap::new()));
}

#[test]
fn a_failed_fetch_keeps_the_last_known_pull_requests_for_ten_minutes() {
    let root = std::path::PathBuf::from("/tmp/uraeda-flows-pulls");
    let start = std::time::SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(1_000_000);
    let minutes = |n: u64| start + std::time::Duration::from_secs(60 * n);
    let known = PullRequests::Known([("b".to_string(), view(31, PullRequestState::Open))].into());

    assert!(pulls::settle(&root, known.clone(), start));
    assert!(!pulls::settle(&root, PullRequests::Unavailable, minutes(9)));
    assert_eq!(pulls::latest(&root), known);
    assert!(pulls::settle(&root, PullRequests::Unavailable, minutes(11)));
    assert_eq!(pulls::latest(&root), PullRequests::Unavailable);
}
