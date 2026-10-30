mod common;

use std::sync::{Mutex, mpsc};
use std::time::Duration;

use common::repo::TestRepo;
use common::texts::{clarifications, proposal};
use uraeda_core::api;
use uraeda_core::cache::{before_storing, cache_stats};
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
