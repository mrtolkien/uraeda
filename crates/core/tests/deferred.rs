mod common;

use std::sync::{Mutex, mpsc};
use std::time::Duration;

use common::repo::TestRepo;
use common::texts::{clarifications, proposal, spec};
use uraeda_core::api;
use uraeda_core::view::CommitView;

const FOLDER: &str = "2026-10-11-web-ui";
const ROUND: &str = "specs/2026-10-11-web-ui/clarifications-01.md";
const SPEC: &str = "specs/2026-10-11-web-ui/spec.md";
/// Where the actions write the feature's files: its branch's worktree.
const WORKTREE: &str = ".worktrees/2026-10-11-web-ui";

/// A repository on `main` whose feature branch, checked out nowhere, holds a spec to review and a
/// round of two questions to answer, with deferral on.
fn deferring() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.write(SPEC, &spec("awaiting-human", 1, 1));
    repo.write(
        ROUND,
        &clarifications("awaiting-human", "Two questions.", &["", ""]),
    );
    repo.commit("discovery(web-ui): round");
    repo.switch("main");
    api::defer_commits(repo.path(), true);
    repo
}

fn in_worktree(path: &str) -> String {
    format!("{WORKTREE}/{path}")
}

/// Saves both answers, uncommitted, and returns the round as they leave it.
fn save_answers(repo: &TestRepo) -> String {
    for (question, letter) in [("Q1", "A"), ("Q2", "B")] {
        api::save_answer(repo.path(), FOLDER, question, &[letter.to_string()], "", "").unwrap();
    }
    repo.read(&in_worktree(ROUND))
}

/// Lands the one commit deferred since the last take, and returns its result with the lines
/// streamed meanwhile.
fn land_one(repo: &TestRepo) -> (Result<CommitView, api::ApiError>, Vec<String>) {
    let deferred = api::take_deferred(repo.path());
    assert_eq!(deferred.len(), 1, "{deferred:?}");
    let lines = Mutex::new(Vec::new());
    let landed = api::land(repo.path(), &deferred[0].id, |line| {
        lines.lock().unwrap().push(line.to_string());
    });
    (landed, lines.into_inner().unwrap())
}

/// Review focus 2: undo puts back what the write left, never the committed version, and never over
/// a later write.
#[test]
fn a_refused_deferred_commit_puts_back_what_its_write_left_with_the_hooks_output() {
    let repo = deferring();
    let saved = save_answers(&repo);
    assert!(saved.contains("status: awaiting-human"), "{saved}");

    api::submit_answers(repo.path(), FOLDER, None, false).unwrap();

    assert!(repo.read(&in_worktree(ROUND)).contains("status: answered"));
    assert_eq!(repo.subjects(FOLDER)[0], "discovery(web-ui): round");
    let deferred = api::take_deferred(repo.path());
    assert_eq!(
        (deferred[0].subject.as_str(), deferred[0].paths.as_slice()),
        (
            "discovery(web-ui): answer round 01",
            [ROUND.to_string()].as_slice()
        )
    );
    assert!(api::take_deferred(repo.path()).is_empty());
    // Git gives a hook's stdout to stderr: its lines come in the order the hook printed them.
    repo.set_hook("echo 'a sentence of 31 words'\necho 'too long' >&2\nexit 1");
    let lines = Mutex::new(Vec::new());
    let refused = api::land(repo.path(), &deferred[0].id, |line| {
        lines.lock().unwrap().push(line.to_string());
    })
    .unwrap_err();
    assert_eq!(
        (
            refused.code,
            refused.message.as_str(),
            refused.output.as_deref()
        ),
        (
            "hook",
            "git commit failed: a sentence of 31 words",
            Some("a sentence of 31 words\ntoo long")
        )
    );
    assert_eq!(
        lines.into_inner().unwrap(),
        ["a sentence of 31 words", "too long"]
    );
    assert_eq!(repo.read(&in_worktree(ROUND)), saved);
    assert_eq!(repo.subjects(FOLDER)[0], "discovery(web-ui): round");

    // A later write to the file: the refusal leaves it, and says so.
    api::submit_answers(repo.path(), FOLDER, None, false).unwrap();
    let later = repo
        .read(&in_worktree(ROUND))
        .replace("**Notes:**", "**Notes:** Written later.");
    repo.write(&in_worktree(ROUND), &later);
    let (landed, _) = land_one(&repo);
    let refused = landed.unwrap_err();
    assert_eq!(
        refused.output.as_deref(),
        Some(
            format!("a sentence of 31 words\ntoo long\n\nChanged since, left as it is: {ROUND}")
                .as_str()
        )
    );
    assert_eq!(repo.read(&in_worktree(ROUND)), later);
}

#[test]
fn a_deferred_commit_lands_with_its_hooks_output_streamed() {
    let repo = deferring();
    save_answers(&repo);
    api::submit_answers(repo.path(), FOLDER, None, false).unwrap();
    repo.set_hook("echo checked\necho formatted >&2");

    let deferred = api::take_deferred(repo.path());
    let lines = Mutex::new(Vec::new());
    let landed = api::land(repo.path(), &deferred[0].id, |line| {
        lines.lock().unwrap().push(line.to_string());
    });

    assert_eq!(
        landed.unwrap().subject,
        "discovery(web-ui): answer round 01"
    );
    assert_eq!(lines.into_inner().unwrap(), ["checked", "formatted"]);
    // Landed once: a second land of it is refused.
    let again = api::land(repo.path(), &deferred[0].id, |_| {}).unwrap_err();
    assert_eq!(again.code, "refused");
    assert_eq!(
        repo.subjects(FOLDER)[0],
        "discovery(web-ui): answer round 01"
    );
    assert!(repo.read(&in_worktree(ROUND)).contains("status: answered"));
}

#[test]
fn a_deferred_commit_never_landed_leaves_its_files_written_uncommitted() {
    let repo = deferring();

    api::approve(repo.path(), FOLDER, "spec.md", None, None, None).unwrap();
    api::defer_commits(repo.path(), false);

    assert!(repo.read(&in_worktree(SPEC)).contains("status: approved"));
    assert_eq!(repo.subjects(FOLDER)[0], "discovery(web-ui): round");
    let status = common::repo::run_git(
        &repo.path().join(WORKTREE),
        &["status", "--porcelain", "--", "specs"],
    );
    assert!(
        status.contains(" M specs/2026-10-11-web-ui/spec.md"),
        "{status}"
    );
    api::defer_commits(repo.path(), true);
    assert!(api::take_deferred(repo.path()).is_empty());
}

/// A deferred commit whose files someone committed meanwhile lands as HEAD, its hooks not run,
/// and puts nothing back.
#[test]
fn a_deferred_commit_whose_files_were_committed_meanwhile_lands_without_undoing_them() {
    let repo = deferring();
    save_answers(&repo);
    api::submit_answers(repo.path(), FOLDER, None, false).unwrap();
    let submitted = repo.read(&in_worktree(ROUND));
    let worktree = repo.path().join(WORKTREE);
    common::repo::run_git(&worktree, &["add", "--", ROUND]);
    common::repo::run_git(&worktree, &["commit", "--quiet", "-m", "answers by hand"]);
    repo.set_hook("echo refused\nexit 1");

    let (landed, lines) = land_one(&repo);

    let head = common::repo::run_git(&worktree, &["rev-parse", "--short=7", "HEAD"]);
    assert_eq!(landed.unwrap().commit, head.trim());
    assert!(lines.is_empty(), "{lines:?}");
    assert_eq!(repo.read(&in_worktree(ROUND)), submitted);
    assert_eq!(repo.subjects(FOLDER)[0], "answers by hand");
}

/// Review: a landing holds the repository's write lock only to stage and to put back, never while
/// its hooks run: a save meanwhile returns before the hook ends.
#[test]
fn a_save_returns_while_a_deferred_commit_waits_on_its_hook() {
    let repo = deferring();
    save_answers(&repo);
    api::submit_answers(repo.path(), FOLDER, None, false).unwrap();
    let release = repo.path().join("release");
    let started = repo.path().join("started");
    repo.set_hook(&format!(
        "touch '{}'\nwhile [ ! -f '{}' ]; do sleep 0.05; done",
        started.display(),
        release.display()
    ));
    let deferred = api::take_deferred(repo.path());
    let path = repo.path().to_path_buf();
    let id = deferred[0].id.clone();
    let landing = std::thread::spawn(move || api::land(&path, &id, |_| {}));
    while !started.exists() {
        std::thread::sleep(Duration::from_millis(20));
    }

    let (saved, saving) = mpsc::channel();
    let path = repo.path().to_path_buf();
    std::thread::spawn(move || {
        let added = api::add_note_at(&path, None, None, "Saved during the hook");
        let _ = saved.send(added.is_ok());
    });
    let returned = saving.recv_timeout(Duration::from_secs(10));
    std::fs::write(&release, "").unwrap();

    assert_eq!(returned, Ok(true), "the save waited for the hook");
    assert_eq!(
        landing.join().unwrap().unwrap().subject,
        "discovery(web-ui): answer round 01"
    );
    assert!(repo.read("specs/INBOX.md").contains("Saved during the hook"));
}
