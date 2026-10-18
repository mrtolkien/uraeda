//! A feature's or a change's history: its stages, each started by its first commit typed by its
//! step, and its merge.

mod common;

use common::repo::TestRepo;
use common::texts::{clarifications, plan, proposal, record, spec};
use uraeda_core::api;
use uraeda_core::history::HistoryView;

const FOLDER: &str = "2026-10-17-clarifications";
const SLUG: &str = "clarifications";
const CHANGE: &str = "2026-10-17-tasks-reappear";

/// A repository on `main`, with `specs/`.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", "# Priorities\n\n## Now\n");
    repo.commit("chore: specs");
    repo
}

/// `2026-10-17T<time>:00Z`, or the time as given when it holds a date.
fn time(at: &str) -> String {
    if at.contains('T') {
        at.to_string()
    } else {
        format!("2026-10-17T{at}:00Z")
    }
}

/// Writes files of the feature's folder, then commits them at `at`.
fn commit(repo: &TestRepo, message: &str, at: &str, files: &[(&str, String)]) {
    for (name, text) in files {
        repo.write(&format!("specs/{FOLDER}/{name}"), text);
    }
    repo.commit_at(&message.replace("<slug>", SLUG), &time(at));
}

fn answered() -> String {
    clarifications("answered", "Answered on 2026-10-17.", &["A"])
}

fn waiting() -> String {
    clarifications("awaiting-human", "1 question, about 3 minutes.", &[""])
}

/// The feature's commits up to its approved spec, on its branch, checked out.
fn through_the_spec(repo: &TestRepo) {
    repo.switch_new(FOLDER);
    commit(
        repo,
        "chore(<slug>): start Clarifications",
        "10:52",
        &[("proposal.md", proposal())],
    );
    commit(
        repo,
        "discovery(<slug>): clarifications",
        "11:18",
        &[
            ("discovery-01.md", "# Discovery\n".into()),
            ("clarifications-01.md", waiting()),
        ],
    );
    commit(
        repo,
        "discovery(<slug>): answer round 01",
        "12:01",
        &[("clarifications-01.md", answered())],
    );
    commit(
        repo,
        "spec(<slug>): clarifications",
        "12:11",
        &[("spec.md", spec("awaiting-human", 1, 1))],
    );
    commit(
        repo,
        "spec(<slug>): request changes",
        "14:14",
        &[("spec.md", spec("changes-requested", 1, 1))],
    );
    commit(
        repo,
        "spec(<slug>): revise",
        "14:20",
        &[("spec.md", spec("awaiting-human", 2, 1))],
    );
    commit(
        repo,
        "spec(<slug>): approve",
        "15:01",
        &[("spec.md", spec("approved", 2, 1))],
    );
    repo.write("docs/topic.md", "# Topic\n");
    commit(repo, "decision(<slug>): apply topic", "15:01", &[]);
}

/// The plan, at `at`, its one task not started.
fn the_plan(repo: &TestRepo, at: &str) {
    let text = plan("auto-approved", 2, &[("Build", 0, 2)]);
    commit(
        repo,
        "plan(<slug>): clarifications",
        at,
        &[("plan.md", text)],
    );
}

/// A code commit at `at`, the plan's task half done: past its last step, the step would depend on
/// the pull request's state, which `gh` gives or not on the machine running the tests.
fn the_code(repo: &TestRepo, message: &str, at: &str) {
    repo.write("src/lib.rs", &format!("// {at}\n"));
    let text = plan("auto-approved", 2, &[("Build", 1, 2)]);
    commit(repo, message, at, &[("plan.md", text)]);
}

/// The record replacing the folder, finished on `finished`.
fn the_record(repo: &TestRepo, kind: &str, folder: &str, finished: &str) {
    let dir = match kind {
        "change" => format!("specs/changes/{folder}"),
        _ => format!("specs/{folder}"),
    };
    repo.git(&["rm", "-r", "--quiet", &dir]);
    let text = record(kind, "Clarifications").replace("2026-10-11", finished);
    repo.write(&format!("specs/done/{folder}.md"), &text);
}

fn starts(history: &HistoryView) -> Vec<(&str, Option<&str>)> {
    history
        .stages
        .iter()
        .map(|stage| (stage.name.as_str(), stage.started.as_deref()))
        .collect()
}

fn start<'h>(history: &'h HistoryView, name: &str) -> Option<&'h str> {
    history
        .stages
        .iter()
        .find(|stage| stage.name == name)
        .and_then(|stage| stage.started.as_deref())
}

fn names(history: &HistoryView) -> Vec<&str> {
    history
        .stages
        .iter()
        .map(|stage| stage.name.as_str())
        .collect()
}

#[test]
fn each_stage_starts_at_its_first_commit_of_its_type() {
    let repo = repo();
    through_the_spec(&repo);
    the_plan(&repo, "15:08");
    the_code(&repo, "feat(<slug>): build", "15:09");

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(
        starts(&history),
        [
            ("proposal", Some("2026-10-17T10:52:00Z")),
            ("questions", Some("2026-10-17T11:18:00Z")),
            ("spec", Some("2026-10-17T12:11:00Z")),
            ("plan", Some("2026-10-17T15:01:00Z")),
            ("build", Some("2026-10-17T15:09:00Z")),
            ("pull-request", None),
            ("merged", None),
        ]
    );
    assert_eq!(history.current, 4);
    assert_eq!(history.rounds, Some(1));
    assert_eq!(history.folder, FOLDER);
}

#[test]
fn a_build_started_the_next_day() {
    let repo = repo();
    through_the_spec(&repo);
    the_plan(&repo, "15:08");
    repo.write("src/lib.rs", "// code\n");
    let text = plan("auto-approved", 2, &[("Build", 2, 2)]);
    repo.write(&format!("specs/{FOLDER}/plan.md"), &text);
    // Committed later than authored, as an amended commit is: the start is the author's time.
    repo.commit_at_merged(
        "feat(clarifications): build",
        "2026-10-18T09:10:00Z",
        "2026-10-18T11:00:00Z",
    );

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(start(&history, "plan"), Some("2026-10-17T15:01:00Z"));
    assert_eq!(start(&history, "build"), Some("2026-10-18T09:10:00Z"));
}

#[test]
fn two_rounds_start_questions_at_the_first() {
    let repo = repo();
    repo.switch_new(FOLDER);
    commit(
        &repo,
        "chore(<slug>): start Clarifications",
        "10:52",
        &[("proposal.md", proposal())],
    );
    commit(
        &repo,
        "discovery(<slug>): clarifications",
        "11:18",
        &[
            ("discovery-01.md", "# Discovery\n".into()),
            ("clarifications-01.md", waiting()),
        ],
    );
    commit(
        &repo,
        "discovery(<slug>): answer round 01",
        "12:01",
        &[("clarifications-01.md", answered())],
    );
    commit(
        &repo,
        "discovery(<slug>): round 02",
        "12:30",
        &[
            ("discovery-02.md", "# Discovery\n".into()),
            ("clarifications-02.md", waiting()),
        ],
    );

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(history.rounds, Some(2));
    assert_eq!(start(&history, "questions"), Some("2026-10-17T11:18:00Z"));
    assert_eq!(start(&history, "spec"), None);
    assert_eq!(history.current, 1);
}

#[test]
fn another_slug_never_counts() {
    let repo = repo();
    repo.switch_new(FOLDER);
    repo.write("other/a.md", "a\n");
    repo.commit_at("chore(clarifications-two): start Two", &time("10:00"));
    commit(
        &repo,
        "chore(<slug>): start Clarifications",
        "10:52",
        &[("proposal.md", proposal())],
    );
    repo.write("other/b.md", "b\n");
    repo.commit_at("discovery(clarification): other", &time("11:00"));
    repo.write("other/c.md", "c\n");
    repo.commit_at("spec(clarifications-two): other", &time("11:10"));
    commit(
        &repo,
        "discovery(<slug>): clarifications",
        "11:18",
        &[
            ("discovery-01.md", "# Discovery\n".into()),
            ("clarifications-01.md", waiting()),
        ],
    );

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(start(&history, "proposal"), Some("2026-10-17T10:52:00Z"));
    assert_eq!(start(&history, "questions"), Some("2026-10-17T11:18:00Z"));
    assert_eq!(start(&history, "spec"), None);
}

#[test]
fn stages_never_go_back_in_time() {
    let repo = repo();
    repo.switch_new(FOLDER);
    commit(
        &repo,
        "chore(<slug>): start Clarifications",
        "10:52",
        &[("proposal.md", proposal())],
    );
    commit(
        &repo,
        "discovery(<slug>): clarifications",
        "11:18",
        &[("clarifications-01.md", waiting())],
    );
    commit(
        &repo,
        "discovery(<slug>): answer round 01",
        "12:01",
        &[("clarifications-01.md", answered())],
    );
    commit(
        &repo,
        "spec(<slug>): clarifications",
        "12:11",
        &[("spec.md", spec("awaiting-human", 1, 1))],
    );
    repo.write("src/fix.rs", "// fix\n");
    commit(&repo, "fix(<slug>): a typo", "13:00", &[]);
    commit(
        &repo,
        "spec(<slug>): approve",
        "15:01",
        &[("spec.md", spec("approved", 1, 1))],
    );
    let text = plan("auto-approved", 1, &[("Build", 0, 2)]);
    commit(
        &repo,
        "plan(<slug>): clarifications",
        "15:08",
        &[("plan.md", text)],
    );
    repo.write("notes.md", "notes\n");
    commit(&repo, "chore(<slug>): notes", "15:30", &[]);
    repo.write("src/lib.rs", "// code\n");
    let text = plan("auto-approved", 1, &[("Build", 2, 2)]);
    commit(&repo, "feat(<slug>): build", "16:00", &[("plan.md", text)]);

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(start(&history, "plan"), Some("2026-10-17T15:08:00Z"));
    assert_eq!(start(&history, "build"), Some("2026-10-17T16:00:00Z"));
}

/// The feature merged by a rebase: its commits on `main`, each committed at 22:09, the finish
/// authored at 22:03.
#[test]
fn a_merged_feature_is_timed_to_its_merge() {
    let repo = repo();
    commit(
        &repo,
        "chore(<slug>): start Clarifications",
        "10:52",
        &[("proposal.md", proposal())],
    );
    let merged = |message: &str, at: &str, files: &[(&str, String)]| {
        for (name, text) in files {
            repo.write(&format!("specs/{FOLDER}/{name}"), text);
        }
        repo.commit_at_merged(&message.replace("<slug>", SLUG), &time(at), &time("22:09"));
    };
    merged(
        "discovery(<slug>): clarifications",
        "11:18",
        &[("clarifications-01.md", waiting())],
    );
    merged(
        "discovery(<slug>): answer round 01",
        "12:01",
        &[("clarifications-01.md", answered())],
    );
    merged(
        "spec(<slug>): clarifications",
        "12:11",
        &[("spec.md", spec("approved", 1, 1))],
    );
    merged(
        "plan(<slug>): clarifications",
        "15:08",
        &[("plan.md", plan("auto-approved", 1, &[("Build", 2, 2)]))],
    );
    repo.write("src/lib.rs", "// code\n");
    merged("feat(<slug>): build", "15:09", &[]);
    the_record(&repo, "feature", FOLDER, "2026-10-17");
    merged("finish(<slug>): Clarifications", "22:03", &[]);

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(start(&history, "proposal"), Some("2026-10-17T10:52:00Z"));
    assert_eq!(start(&history, "build"), Some("2026-10-17T15:09:00Z"));
    assert_eq!(
        start(&history, "pull-request"),
        Some("2026-10-17T22:03:00Z")
    );
    assert_eq!(start(&history, "merged"), Some("2026-10-17T22:09:00Z"));
    assert_eq!(history.current, 7);
    assert!(history.found);
    assert_eq!(history.rounds, Some(1));
}

#[test]
fn a_merge_commit_times_the_merge() {
    let repo = repo();
    commit(
        &repo,
        "chore(<slug>): start Clarifications",
        "10:52",
        &[("proposal.md", proposal())],
    );
    repo.switch_new(FOLDER);
    commit(
        &repo,
        "spec(<slug>): clarifications",
        "12:11",
        &[("spec.md", spec("approved", 1, 0))],
    );
    repo.write("src/lib.rs", "// code\n");
    commit(&repo, "feat(<slug>): build", "15:09", &[]);
    the_record(&repo, "feature", FOLDER, "2026-10-17");
    commit(&repo, "finish(<slug>): Clarifications", "22:03", &[]);
    repo.switch("main");
    repo.write("other.md", "other\n");
    repo.commit_at("chore: other work", &time("22:10"));
    let at = time("22:30");
    repo.git_at(
        &["merge", "--quiet", "--no-ff", "--no-edit", FOLDER],
        &at,
        &at,
    );

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(
        start(&history, "pull-request"),
        Some("2026-10-17T22:03:00Z")
    );
    assert_eq!(start(&history, "merged"), Some("2026-10-17T22:30:00Z"));
    assert!(history.found);
}

#[test]
fn a_squash_merged_feature_shows_its_merge_only() {
    let repo = repo();
    commit(
        &repo,
        "chore(<slug>): start Clarifications",
        "10:52",
        &[("proposal.md", proposal())],
    );
    the_record(&repo, "feature", FOLDER, "2026-10-17");
    repo.write("src/lib.rs", "// code\n");
    repo.commit_at("Feature (#3)", &time("22:09"));

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(names(&history), ["merged"]);
    assert_eq!(start(&history, "merged"), None);
    assert!(!history.found);
    assert_eq!(history.finished.as_deref(), Some("2026-10-17"));
    assert_eq!(history.current, 1);
}

#[test]
fn a_change_without_a_round_has_four_stages() {
    let repo = repo();
    let dir = format!("specs/changes/{CHANGE}");
    repo.write(&format!("{dir}/proposal.md"), &proposal());
    repo.commit_at(
        "chore(tasks-reappear): start Tasks reappear",
        &time("10:00"),
    );
    repo.write("src/tasks.rs", "// saved\n");
    repo.commit_at(
        "fix(tasks-reappear): save new tasks as they are",
        &time("11:00"),
    );
    the_record(&repo, "change", CHANGE, "2026-10-17");
    repo.commit_at("finish(tasks-reappear): Tasks reappear", &time("12:00"));

    let history = api::read_history(repo.path(), CHANGE).unwrap();

    assert_eq!(
        starts(&history),
        [
            ("proposal", Some("2026-10-17T10:00:00Z")),
            ("fix", Some("2026-10-17T11:00:00Z")),
            ("pull-request", Some("2026-10-17T12:00:00Z")),
            ("merged", Some("2026-10-17T12:00:00Z")),
        ]
    );
    assert_eq!(history.rounds, None);
}

#[test]
fn a_change_with_a_round_has_questions() {
    let repo = repo();
    repo.switch_new(&format!("change/{CHANGE}"));
    let dir = format!("specs/changes/{CHANGE}");
    repo.write(&format!("{dir}/proposal.md"), &proposal());
    repo.commit_at(
        "chore(tasks-reappear): start Tasks reappear",
        &time("10:00"),
    );
    repo.write(&format!("{dir}/discovery-01.md"), "# Discovery\n");
    repo.commit_at("discovery(tasks-reappear): tasks reappear", &time("10:30"));
    repo.write("src/tasks.rs", "// saved\n");
    repo.commit_at(
        "fix(tasks-reappear): save new tasks as they are",
        &time("11:00"),
    );

    let history = api::read_history(repo.path(), CHANGE).unwrap();

    assert_eq!(
        starts(&history),
        [
            ("proposal", Some("2026-10-17T10:00:00Z")),
            ("questions", Some("2026-10-17T10:30:00Z")),
            ("fix", Some("2026-10-17T11:00:00Z")),
            ("pull-request", None),
            ("merged", None),
        ]
    );
    assert_eq!(history.current, 2);
}
