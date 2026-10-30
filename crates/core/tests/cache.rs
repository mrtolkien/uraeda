mod common;

use std::sync::{Mutex, mpsc};
use std::time::Duration;

use common::repo::{TestRepo, run_git};
use common::texts::{clarifications, proposal, record};
use uraeda_core::api;
use uraeda_core::cache::{before_storing, cache_stats};
use uraeda_core::git::Git;
use uraeda_core::pulls::{self, PullRequestState, PullRequestView, PullRequests};
use uraeda_core::watch::{Changes, Watcher, watch};

const FOLDER: &str = "2026-10-11-web-ui";
const ROUND: &str = "clarifications-01.md";
const IN_WORKTREE: &str =
    ".worktrees/2026-10-11-web-ui/specs/2026-10-11-web-ui/clarifications-01.md";
const ANSWERED: &str = "**Answer:** A\n";

/// A repository whose feature has a round waiting for its answer, checked out in a worktree.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", "# Priorities\n\n## Now\n\n## Next\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.write(
        "specs/2026-10-11-web-ui/clarifications-01.md",
        &clarifications("awaiting-human", "1 question, about 3 minutes.", &[""]),
    );
    repo.commit("discovery(web-ui): web UI");
    repo.switch("main");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        ".worktrees/2026-10-11-web-ui",
        FOLDER,
    ]);
    repo
}

fn watching(repo: &TestRepo) -> (Watcher, mpsc::Receiver<Changes>) {
    let (sender, receiver) = mpsc::channel();
    let watcher = watch(repo.path(), move |changes| {
        let _ = sender.send(changes);
    })
    .unwrap();
    (watcher, receiver)
}

fn next(receiver: &mpsc::Receiver<Changes>) -> Changes {
    receiver
        .recv_timeout(Duration::from_secs(5))
        .expect("a change within 5 seconds")
}

fn round_text(repo: &TestRepo) -> String {
    api::read_file(repo.path(), FOLDER, ROUND)
        .unwrap()
        .current
        .text
}

/// US1 more 2, SC-005: a change made outside Uraeda.
#[test]
fn a_change_made_outside_shows_on_the_next_read_once_the_watcher_saw_it() {
    let repo = repo();
    let (_watcher, receiver) = watching(&repo);
    round_text(&repo);
    round_text(&repo);
    assert_eq!(cache_stats(repo.path()).hits, 1);

    let text = repo.read(IN_WORKTREE);
    repo.write(IN_WORKTREE, &text.replace("**Answer:**\n", ANSWERED));
    next(&receiver);

    assert!(round_text(&repo).contains(ANSWERED));
}

/// Review focus 1: a read that runs while a write changes the files.
#[test]
fn a_read_racing_a_write_never_keeps_the_old_workspace() {
    let repo = repo();
    let (_watcher, receiver) = watching(&repo);
    let (held, is_held) = mpsc::channel();
    let (release, released) = mpsc::channel::<()>();
    let once = Mutex::new(Some((held, released)));
    before_storing(repo.path(), move || {
        let first = once.lock().unwrap().take();
        if let Some((held, released)) = first {
            held.send(()).unwrap();
            released.recv().unwrap();
        }
    });
    let root = repo.path().to_path_buf();
    let reader =
        std::thread::spawn(move || api::read_file(&root, FOLDER, ROUND).unwrap().current.text);
    is_held.recv().unwrap();

    api::save_answer(repo.path(), FOLDER, "Q1", &["A".to_string()], "", "").unwrap();
    // The watcher saw the write and read it again before the held read stores what it read.
    next(&receiver);
    release.send(()).unwrap();

    assert!(!reader.join().unwrap().contains(ANSWERED));
    assert!(round_text(&repo).contains(ANSWERED));
}

/// Review focus 6: without a watch, as in `ura`, nothing invalidates a cache.
#[test]
fn without_a_watch_every_read_reads_git() {
    let repo = repo();
    round_text(&repo);

    let text = repo.read(IN_WORKTREE);
    repo.write(IN_WORKTREE, &text.replace("**Answer:**\n", ANSWERED));

    assert!(round_text(&repo).contains(ANSWERED));
    assert_eq!(cache_stats(repo.path()).hits, 0);
}

/// A refresh of the pull requests that changes a finished feature's pull request changes its step
/// on the next read, from memory before it.
#[test]
fn a_changed_pull_request_shows_its_step_on_the_next_read() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", "# Priorities\n\n## Now\n\n## Next\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write(
        &format!("specs/done/{FOLDER}.md"),
        &record("feature", "Web UI"),
    );
    repo.commit("finish: web ui");
    repo.switch("main");
    let root = Git::discover(repo.path()).unwrap().main_root();
    let head = repo.git(&["rev-parse", FOLDER]).trim().to_string();
    let draft = |state| {
        let view = PullRequestView {
            number: 31,
            url: "https://github.com/o/r/pull/31".to_string(),
            state,
            head: head.clone(),
        };
        PullRequests::open([(FOLDER.to_string(), view)])
    };
    pulls::remember(&root, draft(PullRequestState::Draft));
    let (_watcher, _receiver) = watching(&repo);
    let step = || api::read_feature(repo.path(), FOLDER).unwrap().step.name;
    assert_eq!(step(), "finish");
    assert_eq!(step(), "finish");
    assert_eq!(cache_stats(repo.path()).hits, 1);

    assert!(pulls::remember(&root, draft(PullRequestState::Open)));

    assert_eq!(step(), "pull-request");
}

/// Review focus 6: once its last watch stops, a repository's reads read git again, and nothing
/// kept before answers.
#[test]
fn a_watch_stopped_keeps_nothing() {
    let repo = repo();
    let (watcher, receiver) = watching(&repo);
    round_text(&repo);
    round_text(&repo);
    assert_eq!(cache_stats(repo.path()).hits, 1);
    drop(watcher);
    drop(receiver);

    let text = repo.read(IN_WORKTREE);
    repo.write(IN_WORKTREE, &text.replace("**Answer:**\n", ANSWERED));

    assert!(round_text(&repo).contains(ANSWERED));
    round_text(&repo);
    assert_eq!(cache_stats(repo.path()).hits, 0);
}

const DECISION: &str = "specs/decisions/git.md";

fn decision_text(title: &str) -> String {
    format!("---\nstatus: active\n---\n\n# {title}\n\nGit is the store.\n")
}

/// The ledger's decision `git`: its title and the date of its last change.
fn git_decision(repo: &TestRepo) -> (String, Option<String>) {
    let ledger = api::read_ledger(repo.path()).unwrap();
    let decision = ledger
        .decisions
        .into_iter()
        .find(|decision| decision.name == "git")
        .unwrap();
    (decision.title, decision.changed)
}

/// A repository with the decision `git`, committed on 2026-10-12.
fn ledger_repo() -> TestRepo {
    let repo = repo();
    repo.write(DECISION, &decision_text("Git"));
    repo.commit_at("decision: git", "2026-10-12T12:00:00+00:00");
    repo
}

/// The ledger is kept, and a decision edited outside Uraeda shows on the next read.
#[test]
fn an_edited_decision_shows_on_the_next_ledger_read_once_the_watcher_saw_it() {
    let repo = ledger_repo();
    let (_watcher, receiver) = watching(&repo);
    git_decision(&repo);
    let before = cache_stats(repo.path()).hits;
    git_decision(&repo);
    assert_eq!(cache_stats(repo.path()).hits, before + 1);

    repo.write(DECISION, &decision_text("Git, edited"));
    next(&receiver);

    assert_eq!(git_decision(&repo).0, "Git, edited");
}

/// A commit on the default branch moves a decision's date, read from the commits since the last
/// read; a reset to an older commit moves it back.
#[test]
fn a_decisions_commit_shows_its_date_on_the_next_ledger_read() {
    let repo = ledger_repo();
    let (_watcher, receiver) = watching(&repo);
    assert_eq!(git_decision(&repo).1.as_deref(), Some("2026-10-12"));

    repo.write(DECISION, &decision_text("Git, again"));
    repo.commit_at("decision: git again", "2026-10-14T12:00:00+00:00");
    next(&receiver);
    assert_eq!(git_decision(&repo).1.as_deref(), Some("2026-10-14"));

    repo.git(&["reset", "--quiet", "--hard", "HEAD~1"]);
    next(&receiver);
    assert_eq!(git_decision(&repo).1.as_deref(), Some("2026-10-12"));
}

/// A ledger read that runs while a decision changes never keeps what it read before the change.
#[test]
fn a_ledger_read_racing_a_change_never_keeps_the_old_ledger() {
    let repo = ledger_repo();
    let (_watcher, receiver) = watching(&repo);
    let (held, is_held) = mpsc::channel();
    let (release, released) = mpsc::channel::<()>();
    let once = Mutex::new(Some((held, released)));
    before_storing(repo.path(), move || {
        let first = once.lock().unwrap().take();
        if let Some((held, released)) = first {
            held.send(()).unwrap();
            released.recv().unwrap();
        }
    });
    let root = repo.path().to_path_buf();
    let reader = std::thread::spawn(move || api::read_ledger(&root).unwrap());
    is_held.recv().unwrap();

    repo.write(DECISION, &decision_text("Git, edited"));
    next(&receiver);
    release.send(()).unwrap();

    reader.join().unwrap();
    assert_eq!(git_decision(&repo).0, "Git, edited");
}

/// The lines the feature's branch changed outside its folder, as its history counts them.
fn added_lines(repo: &TestRepo) -> Option<u32> {
    api::read_history(repo.path(), FOLDER)
        .unwrap()
        .lines
        .map(|lines| lines.added)
}

/// A feature's history is kept, and a commit on its branch shows on the next read.
#[test]
fn a_commit_on_a_branch_shows_in_its_history_once_the_watcher_saw_it() {
    let repo = repo();
    let (_watcher, receiver) = watching(&repo);
    assert_eq!(added_lines(&repo), Some(0));
    let before = cache_stats(repo.path()).hits;
    added_lines(&repo);
    assert_eq!(cache_stats(repo.path()).hits, before + 1);

    let worktree = repo.path().join(".worktrees/2026-10-11-web-ui");
    repo.write(
        ".worktrees/2026-10-11-web-ui/src/main.rs",
        "one\ntwo\nthree\n",
    );
    run_git(&worktree, &["add", "--all"]);
    run_git(
        &worktree,
        &[
            "commit",
            "--quiet",
            "--no-verify",
            "--message",
            "feat(web-ui): main",
        ],
    );
    next(&receiver);

    assert_eq!(added_lines(&repo), Some(3));
}

/// A commit on the default branch moves the base a live feature's lines are counted from.
#[test]
fn a_commit_on_the_default_branch_shows_in_a_live_history() {
    let repo = repo();
    let (_watcher, receiver) = watching(&repo);
    let worktree = repo.path().join(".worktrees/2026-10-11-web-ui");
    repo.write(
        ".worktrees/2026-10-11-web-ui/src/main.rs",
        "one\ntwo\nthree\n",
    );
    run_git(&worktree, &["add", "--all"]);
    run_git(
        &worktree,
        &[
            "commit",
            "--quiet",
            "--no-verify",
            "--message",
            "feat(web-ui): main",
        ],
    );
    next(&receiver);
    assert_eq!(added_lines(&repo), Some(3));

    // The same change merged into the default branch: the branch adds nothing it lacks.
    repo.git(&["merge", "--quiet", "--no-edit", FOLDER]);
    next(&receiver);

    assert_eq!(added_lines(&repo), Some(0));
}

/// US4 1: a draft joins its line with the workspace read before it writes, from memory when kept,
/// never from a read older than a change the watcher saw: a feature started outside stays above
/// the line, even while the watcher has not read the workspace again.
#[test]
fn a_draft_after_a_start_seen_by_the_watcher_goes_below_it() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Now\n\n- [Web UI](/specs/2026-10-11-web-ui/proposal.md)\n- An idea\n",
    );
    repo.commit("chore: specs");
    let (_watcher, receiver) = watching(&repo);
    api::read_priorities(repo.path()).unwrap();
    let (held, is_held) = mpsc::channel();
    let (release, released) = mpsc::channel::<()>();
    let once = Mutex::new(Some((held, released)));
    before_storing(repo.path(), move || {
        let first = once.lock().unwrap().take();
        if let Some((held, released)) = first {
            held.send(()).unwrap();
            released.recv().unwrap();
        }
    });

    repo.switch_new(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.commit("discovery(web-ui): web UI");
    repo.switch("main");
    // The watcher saw the start, and holds its read of it.
    is_held.recv().unwrap();
    let file = api::draft_proposal(repo.path(), "now", "Performance pass", "").unwrap();
    release.send(()).unwrap();
    assert_eq!(file.proposal.map(|p| p.id), Some("now-2".to_string()));

    // Read again once the watcher saw the draft, the workspace answers the next draft's first read.
    next(&receiver);
    next(&receiver);
    api::read_priorities(repo.path()).unwrap();
    let hits = cache_stats(repo.path()).hits;
    let file = api::draft_proposal(repo.path(), "now", "Dark mode", "").unwrap();
    assert_eq!(file.proposal.map(|p| p.id), Some("now-2".to_string()));
    assert_eq!(cache_stats(repo.path()).hits, hits + 1);
}
