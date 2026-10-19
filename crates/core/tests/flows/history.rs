//! A feature's history: each stage starts at the first commit of its kind, and a merged feature is
//! timed to its merge, with the clock set by the commits' own dates.

use uraeda_core::api;
use uraeda_core::history::HistoryView;

use crate::common::repo::TestRepo;
use crate::common::texts::{clarifications, plan, proposal, record, spec};

const FOLDER: &str = "2026-10-17-clarifications";

fn at(time: &str) -> String {
    format!("2026-10-17T{time}:00Z")
}

fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    repo
}

/// Writes files of the feature's folder, then commits them at `time`.
fn commit(repo: &TestRepo, message: &str, time: &str, files: &[(&str, String)]) {
    for (name, text) in files {
        repo.write(&format!("specs/{FOLDER}/{name}"), text);
    }
    repo.commit_at(message, &at(time));
}

fn started<'h>(history: &'h HistoryView, stage: &str) -> Option<&'h str> {
    history
        .stages
        .iter()
        .find(|s| s.name == stage)
        .and_then(|s| s.started.as_deref())
}

/// The feature on its branch, through discovery, the spec, the plan, and a first code commit.
fn building(repo: &TestRepo) {
    let waiting = clarifications("awaiting-human", "1 question.", &[""]);
    let answered = clarifications("answered", "Answered.", &["A"]);
    repo.switch_new(FOLDER);
    commit(
        repo,
        "chore(clarifications): start",
        "10:52",
        &[("proposal.md", proposal())],
    );
    commit(
        repo,
        "discovery(clarifications): questions",
        "11:18",
        &[("clarifications-01.md", waiting)],
    );
    commit(
        repo,
        "discovery(clarifications): answer round 01",
        "12:01",
        &[("clarifications-01.md", answered)],
    );
    commit(
        repo,
        "spec(clarifications): spec",
        "12:11",
        &[("spec.md", spec("awaiting-human", 1, 1))],
    );
    commit(
        repo,
        "spec(clarifications): request changes",
        "14:14",
        &[("spec.md", spec("changes-requested", 1, 1))],
    );
    commit(
        repo,
        "spec(clarifications): approve",
        "15:01",
        &[("spec.md", spec("approved", 1, 1))],
    );
    let tasks = [("Build", 0, 2)];
    commit(
        repo,
        "plan(clarifications): plan",
        "15:08",
        &[("plan.md", plan("auto-approved", 1, &tasks))],
    );
    repo.write("src/lib.rs", "// code\n");
    let tasks = [("Build", 1, 2)];
    commit(
        repo,
        "feat(clarifications): build",
        "15:09",
        &[("plan.md", plan("auto-approved", 1, &tasks))],
    );
}

fn finish(repo: &TestRepo, message: &str, time: &str) {
    repo.git(&["rm", "-r", "--quiet", &format!("specs/{FOLDER}")]);
    repo.write(
        &format!("specs/done/{FOLDER}.md"),
        &record("feature", "Clarifications").replace("2026-10-11", "2026-10-17"),
    );
    repo.commit_at(message, &at(time));
}

#[test]
fn each_stage_starts_at_the_first_commit_of_its_kind() {
    let repo = repo();
    building(&repo);

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(started(&history, "proposal"), Some("2026-10-17T10:52:00Z"));
    assert_eq!(started(&history, "questions"), Some("2026-10-17T11:18:00Z"));
    assert_eq!(started(&history, "spec"), Some("2026-10-17T12:11:00Z"));
    assert_eq!(started(&history, "plan"), Some("2026-10-17T15:08:00Z"));
    assert_eq!(started(&history, "build"), Some("2026-10-17T15:09:00Z"));
    assert_eq!(started(&history, "merged"), None);
    assert_eq!(history.rounds, Some(1));
    let order: Vec<_> = history
        .stages
        .iter()
        .filter_map(|s| s.started.as_deref())
        .collect();
    assert!(
        order.windows(2).all(|pair| pair[0] <= pair[1]),
        "stages never go back in time: {order:?}"
    );
}

#[test]
fn a_merged_feature_is_timed_to_its_merge() {
    let repo = repo();
    building(&repo);
    finish(&repo, "finish(clarifications): done", "22:03");
    repo.switch("main");
    repo.write("other.md", "other\n");
    repo.commit_at("chore: other work", &at("22:10"));
    let merge = at("22:30");
    repo.git_at(
        &["merge", "--quiet", "--no-ff", "--no-edit", FOLDER],
        &merge,
        &merge,
    );
    repo.write("later.md", "later\n");
    repo.commit_at("fix: a later fix on main", "2026-10-18T09:00:00Z");

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert!(history.found);
    assert_eq!(
        started(&history, "pull-request"),
        Some("2026-10-17T22:03:00Z")
    );
    assert_eq!(
        started(&history, "merged"),
        Some("2026-10-17T22:30:00Z"),
        "a later fix does not move the merge"
    );
    assert!(history.total_seconds.is_some());
    assert_eq!(history.questions, Some(2), "the questions its record asked");
}

#[test]
fn a_squash_merged_feature_shows_its_merge_only() {
    let repo = repo();
    // The feature's branch is gone: only a record and a squashed commit are left on `main`.
    repo.write(
        &format!("specs/done/{FOLDER}.md"),
        &record("feature", "Clarifications").replace("2026-10-11", "2026-10-17"),
    );
    repo.write("src/lib.rs", "// code\n");
    repo.commit_at("Feature (#3)", &at("22:09"));

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert!(
        !history.found,
        "its own commits are not on the default branch"
    );
    assert_eq!(history.finished.as_deref(), Some("2026-10-17"));
    assert!(history.stages.iter().all(|stage| stage.started.is_none()));
}
