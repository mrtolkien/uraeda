//! A feature's or a change's history: its stages, each started by its first commit typed by its
//! step, and its merge.

mod common;

use std::time::{Duration, Instant};

use common::repo::TestRepo;
use common::texts::{clarifications, decision, plan, proposal, record, spec};
use uraeda_core::api;
use uraeda_core::decisions::DecisionChange;
use uraeda_core::history::{HistoryView, LinesView};

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

#[test]
fn a_live_feature_starts_no_stage_after_its_current_one() {
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
        "spec(<slug>): clarifications",
        "12:11",
        &[("spec.md", spec("awaiting-human", 1, 0))],
    );
    repo.write("src/fix.rs", "// fix\n");
    commit(&repo, "fix(<slug>): a typo", "13:00", &[]);

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(history.current, 2);
    assert_eq!(start(&history, "spec"), Some("2026-10-17T12:11:00Z"));
    assert_eq!(start(&history, "build"), None);
}

/// A commit on `main` as a rebase leaves it: authored at `at`, committed at 22:09.
fn rebased(repo: &TestRepo, message: &str, at: &str, files: &[(&str, String)]) {
    for (name, text) in files {
        repo.write(&format!("specs/{FOLDER}/{name}"), text);
    }
    repo.commit_at_merged(&message.replace("<slug>", SLUG), &time(at), &time("22:09"));
}

/// The feature merged by a rebase: its start on `main` at 10:52, then its commits, each committed
/// at 22:09, the finish authored at 22:03. Its code: `src/lib.rs`, one line.
fn merged_by_rebase(repo: &TestRepo) {
    commit(
        repo,
        "chore(<slug>): start Clarifications",
        "10:52",
        &[("proposal.md", proposal())],
    );
    rebased(
        repo,
        "discovery(<slug>): clarifications",
        "11:18",
        &[("clarifications-01.md", waiting())],
    );
    rebased(
        repo,
        "discovery(<slug>): answer round 01",
        "12:01",
        &[("clarifications-01.md", answered())],
    );
    rebased(
        repo,
        "spec(<slug>): clarifications",
        "12:11",
        &[("spec.md", spec("approved", 1, 1))],
    );
    rebased(
        repo,
        "plan(<slug>): clarifications",
        "15:08",
        &[("plan.md", plan("auto-approved", 1, &[("Build", 2, 2)]))],
    );
    repo.write("src/lib.rs", "// code\n");
    rebased(repo, "feat(<slug>): build", "15:09", &[]);
    the_record(repo, "feature", FOLDER, "2026-10-17");
    rebased(repo, "finish(<slug>): Clarifications", "22:03", &[]);
}

#[test]
fn a_merged_feature_is_timed_to_its_merge() {
    let repo = repo();
    merged_by_rebase(&repo);

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
fn a_later_fix_on_main_moves_neither_the_merge_nor_the_lines() {
    let repo = repo();
    merged_by_rebase(&repo);
    repo.write("other.md", "other\n");
    repo.commit_at("chore: other work", &time("23:00"));
    repo.write("src/later.rs", &lines(3, "later"));
    repo.commit_at("fix(clarifications): later", "2026-10-18T09:00:00Z");

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(start(&history, "merged"), Some("2026-10-17T22:09:00Z"));
    assert_eq!(history.lines, figures(1, 0, 1));
}

#[test]
fn a_feature_merged_on_origin_only_is_read_from_there() {
    let repo = repo();
    let before = repo.git(&["rev-parse", "HEAD"]);
    merged_by_rebase(&repo);
    repo.push("main");
    repo.git(&["reset", "--quiet", "--hard", before.trim()]);

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert!(history.found);
    assert_eq!(start(&history, "merged"), Some("2026-10-17T22:09:00Z"));
    assert_eq!(history.lines, figures(1, 0, 1));
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

/// `count` numbered lines.
fn lines(count: usize, word: &str) -> String {
    (1..=count).map(|n| format!("{word} {n}\n")).collect()
}

fn figures(added: u32, removed: u32, files: u32) -> Option<LinesView> {
    Some(LinesView {
        added,
        removed,
        files,
    })
}

/// A live feature on its branch: its proposal and spec, then code outside its folder, `src/a.rs`
/// +3 −1 over `main`'s 2 lines and `src/b.rs` +2, while `main` moves on.
fn live_with_code(repo: &TestRepo) {
    repo.write("src/a.rs", "one\ntwo\n");
    repo.commit("chore: a");
    repo.switch_new(FOLDER);
    commit(
        repo,
        "chore(<slug>): start Clarifications",
        "10:52",
        &[("proposal.md", proposal())],
    );
    commit(
        repo,
        "spec(<slug>): clarifications",
        "12:11",
        &[("spec.md", spec("approved", 1, 0))],
    );
    repo.write("src/a.rs", "one\nthree\nfour\nfive\n");
    repo.write("src/b.rs", "b 1\nb 2\n");
    commit(repo, "feat(<slug>): build", "15:09", &[]);
    repo.switch("main");
    repo.write("other.md", "other\n");
    repo.commit_at("chore: other work", &time("16:00"));
    repo.switch(FOLDER);
}

#[test]
fn total_time_runs_from_the_proposal_to_the_finish() {
    let repo = repo();
    merged_by_rebase(&repo);

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(history.total_seconds, Some(11 * 3600 + 11 * 60));
}

#[test]
fn a_live_feature_counts_its_branch_changes() {
    let repo = repo();
    live_with_code(&repo);

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(history.lines, figures(5, 1, 2));
    assert_eq!(history.total_seconds, None);
    assert_eq!(history.questions, None);
    assert!(history.decisions.is_empty());
}

#[test]
fn a_merge_of_main_into_the_branch_is_not_counted() {
    let repo = repo();
    live_with_code(&repo);
    repo.switch("main");
    repo.write("docs/ten.md", &lines(10, "line"));
    repo.commit_at("chore: ten lines", &time("16:30"));
    repo.switch(FOLDER);
    let at = time("17:00");
    repo.git_at(&["merge", "--quiet", "--no-edit", "main"], &at, &at);

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(history.lines, figures(5, 1, 2));
}

#[test]
fn a_rebased_feature_counts_its_run_of_commits() {
    let repo = repo();
    repo.write("src/a.rs", "one\ntwo\n");
    repo.commit("chore: a");
    commit(
        &repo,
        "chore(<slug>): start Clarifications",
        "10:52",
        &[("proposal.md", proposal())],
    );
    repo.write("src/other.rs", &lines(4, "other"));
    repo.commit_at("feat(other): other work", &time("12:00"));
    rebased(
        &repo,
        "spec(<slug>): clarifications",
        "12:11",
        &[("spec.md", spec("approved", 1, 0))],
    );
    repo.write("src/a.rs", "one\nthree\nfour\nfive\n");
    repo.write("src/b.rs", "b 1\nb 2\n");
    rebased(&repo, "feat(<slug>): build", "15:09", &[]);
    the_record(&repo, "feature", FOLDER, "2026-10-17");
    rebased(&repo, "finish(<slug>): Clarifications", "22:03", &[]);
    repo.write("src/later.rs", &lines(7, "later"));
    repo.commit_at("feat(later): after", &time("23:00"));

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(history.lines, figures(5, 1, 2));
}

/// A rebased feature whose branch also holds an unscoped commit, `chore: add … to the inbox`,
/// between its decision and its code: the commits on both sides are counted, the unscoped one is
/// not, and the decision before it is listed.
#[test]
fn an_unscoped_commit_inside_a_rebased_run_cuts_nothing() {
    let repo = repo();
    repo.write("specs/decisions/git.md", &decision("approved"));
    repo.commit("chore: decisions");
    commit(
        &repo,
        "chore(<slug>): start Clarifications",
        "10:52",
        &[("proposal.md", proposal())],
    );
    rebased(
        &repo,
        "spec(<slug>): clarifications",
        "12:11",
        &[("spec.md", spec("approved", 1, 0))],
    );
    let git = decision("approved").replace("A choice.", "A choice, changed.");
    repo.write("specs/decisions/git.md", &git);
    repo.write("src/a.rs", &lines(3, "a"));
    rebased(&repo, "feat(<slug>): a", "15:01", &[]);
    repo.write("specs/inbox.md", &lines(4, "idea"));
    repo.commit_at_merged(
        "chore: add an idea to the inbox",
        &time("15:05"),
        &time("22:09"),
    );
    repo.write("src/b.rs", &lines(2, "b"));
    rebased(&repo, "feat(<slug>): b", "15:09", &[]);
    the_record(&repo, "feature", FOLDER, "2026-10-17");
    rebased(&repo, "finish(<slug>): Clarifications", "22:03", &[]);

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    // `src/a.rs` +3, `specs/decisions/git.md` +1 −1, `src/b.rs` +2; the inbox left out.
    assert_eq!(history.lines, figures(6, 1, 3));
    assert_eq!(kinds(&history.decisions), [("git", "changed")]);
}

#[test]
fn a_feature_merged_with_a_merge_commit_counts_its_branch() {
    let repo = repo();
    repo.write("src/a.rs", "one\ntwo\n");
    repo.commit("chore: a");
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
    repo.write("src/a.rs", "one\nthree\nfour\nfive\n");
    repo.write("src/b.rs", "b 1\nb 2\n");
    commit(&repo, "feat(<slug>): build", "15:09", &[]);
    the_record(&repo, "feature", FOLDER, "2026-10-17");
    commit(&repo, "finish(<slug>): Clarifications", "22:03", &[]);
    repo.switch("main");
    repo.write("src/other.rs", &lines(4, "other"));
    repo.commit_at("feat(other): other work", &time("22:10"));
    let at = time("22:30");
    repo.git_at(
        &["merge", "--quiet", "--no-ff", "--no-edit", FOLDER],
        &at,
        &at,
    );

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(history.lines, figures(5, 1, 2));
}

#[test]
fn a_done_feature_counts_its_questions() {
    let repo = repo();
    merged_by_rebase(&repo);
    let path = format!("specs/done/{FOLDER}.md");
    let mut text = repo.read(&path);
    for n in 3..=10 {
        text.push_str(&format!("\n#### Q{n}: Question {n}?\n\n**Answer:** A.\n"));
    }
    repo.write(&path, &text);
    repo.commit_at("docs: the record's questions", &time("23:00"));

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(history.questions, Some(10));
    assert_eq!(history.rounds, Some(1));
}

fn kinds(decisions: &[DecisionChange]) -> Vec<(&str, &str)> {
    decisions
        .iter()
        .map(|decision| (decision.name.as_str(), decision.kind.as_str()))
        .collect()
}

#[test]
fn a_done_feature_lists_the_decisions_it_changed() {
    let repo = repo();
    repo.write("specs/decisions/git.md", &decision("approved"));
    repo.write("specs/decisions/ledger.md", &decision("approved"));
    repo.commit("chore: decisions");
    commit(
        &repo,
        "chore(<slug>): start Clarifications",
        "10:52",
        &[("proposal.md", proposal())],
    );
    repo.write("specs/decisions/ledger.md", "# Ledger\n\nAnother choice.\n");
    repo.commit_at("decision(other): ledger", &time("11:00"));
    rebased(
        &repo,
        "spec(<slug>): clarifications",
        "12:11",
        &[("spec.md", spec("approved", 1, 0))],
    );
    repo.write(
        "specs/decisions/diagrams.md",
        "# Diagrams\n\n- MUST draw.\n",
    );
    let git = decision("approved").replace("A choice.", "A choice, changed.");
    repo.write("specs/decisions/git.md", &git);
    rebased(&repo, "decision(<slug>): apply", "15:01", &[]);
    the_record(&repo, "feature", FOLDER, "2026-10-17");
    rebased(&repo, "finish(<slug>): Clarifications", "22:03", &[]);

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(
        kinds(&history.decisions),
        [("diagrams", "new"), ("git", "changed")]
    );
    assert!(history.decisions.iter().all(|decision| decision.listed));
}

/// The feature squash-merged: its start on `main`, then one commit with its record and its code.
fn squashed(repo: &TestRepo) {
    commit(
        repo,
        "chore(<slug>): start Clarifications",
        "10:52",
        &[("proposal.md", proposal())],
    );
    the_record(repo, "feature", FOLDER, "2026-10-17");
    repo.write("src/lib.rs", "// code\n");
    repo.write(
        "specs/decisions/diagrams.md",
        "# Diagrams\n\n- MUST draw.\n",
    );
    repo.commit_at("Feature (#3)", &time("22:09"));
}

#[test]
fn a_squash_merged_feature_has_no_figures() {
    let repo = repo();
    squashed(&repo);

    let history = api::read_history(repo.path(), FOLDER).unwrap();

    assert_eq!(history.lines, None);
    assert_eq!(history.total_seconds, None);
    assert!(history.decisions.is_empty());
}

/// SC-002, with `vp run bench`: a merged feature of 80 commits, among 400 others of 20 other
/// features, gets its history in under 100 ms, the median of 5 reads.
#[test]
#[ignore = "benchmark"]
fn bench_history_of_80_commits() {
    let repo = repo();
    let other = |n: usize, at: &str| {
        let feature = format!("other-{:02}", n % 20);
        repo.write(&format!("src/{feature}.rs"), &lines(n % 7 + 1, "line"));
        repo.write(
            &format!("specs/2026-10-16-{feature}/proposal.md"),
            &proposal(),
        );
        repo.commit_at(&format!("feat({feature}): step {n}"), at);
    };
    for n in 0..200 {
        other(
            n,
            &format!("2026-10-16T{:02}:{:02}:00Z", n / 60 + 8, n % 60),
        );
    }
    commit(
        &repo,
        "chore(<slug>): start Clarifications",
        "08:00",
        &[("proposal.md", proposal())],
    );
    for n in 0..78 {
        repo.write(&format!("src/feature/f{n:02}.rs"), &lines(n + 1, "line"));
        rebased(
            &repo,
            "feat(<slug>): build",
            &format!("{:02}:{:02}", n / 60 + 9, n % 60),
            &[],
        );
    }
    the_record(&repo, "feature", FOLDER, "2026-10-17");
    rebased(&repo, "finish(<slug>): Clarifications", "22:03", &[]);
    for n in 200..400 {
        other(
            n,
            &format!("2026-10-18T{:02}:{:02}:00Z", (n - 200) / 60 + 8, n % 60),
        );
    }

    let mut times: Vec<Duration> = (0..5)
        .map(|_| {
            let start = Instant::now();
            let history = api::read_history(repo.path(), FOLDER).unwrap();
            let elapsed = start.elapsed();
            assert!(history.found && history.lines.is_some(), "{history:?}");
            elapsed
        })
        .collect();
    times.sort();
    let median = times[2];
    println!("read_history: median {median:?} of {times:?}");
    assert!(median < Duration::from_millis(100), "median {median:?}");
}
