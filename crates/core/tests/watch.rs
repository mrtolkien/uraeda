mod common;

use std::path::PathBuf;
use std::sync::mpsc;
use std::time::{Duration, Instant};

use common::repo::{TestRepo, run_git, without_user_git};
use common::texts::{clarifications, proposal};
use uraeda_core::actions::place;
use uraeda_core::git::Git;
use uraeda_core::watch::{Changes, LONGEST, Watcher, watch};

const FOLDER: &str = "2026-10-11-web-ui";

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

#[test]
fn an_answer_written_in_a_worktree_is_reported() {
    let repo = repo();
    let place = place::reach(&Git::discover(repo.path()).unwrap(), FOLDER).unwrap();
    let (_watcher, receiver) = watching(&repo);

    let round = place
        .root
        .join("specs/2026-10-11-web-ui/clarifications-01.md");
    let text = std::fs::read_to_string(&round).unwrap();
    std::fs::write(&round, text.replace("**Answer:**\n", "**Answer:** A\n")).unwrap();

    let changes = next(&receiver);
    assert_eq!(changes.files, ["2026-10-11-web-ui/clarifications-01.md"]);
    assert_eq!(changes.features, [FOLDER]);
    assert!(!changes.priorities);
}

/// US6.5, the core's half: a commit on another branch.
#[test]
fn a_commit_on_another_branch_is_reported() {
    let repo = repo();
    let (_watcher, receiver) = watching(&repo);

    let tree = repo
        .git(&["rev-parse", &format!("{FOLDER}^{{tree}}")])
        .trim()
        .to_string();
    let parent = repo.git(&["rev-parse", FOLDER]).trim().to_string();
    // A commit adding `spec.md` on the feature branch, written without touching the checkout.
    let blob = {
        let path = repo.parent().join("spec.md");
        std::fs::write(
            &path,
            "---\nstatus: awaiting-human\n---\n\n# Spec: Web UI\n",
        )
        .unwrap();
        repo.git(&["hash-object", "-w", path.to_str().unwrap()])
            .trim()
            .to_string()
    };
    let index = repo.parent().join("index");
    let env_git = |args: &[&str]| {
        let output = without_user_git(std::process::Command::new("git").args(args))
            .current_dir(repo.path())
            .env("GIT_INDEX_FILE", &index)
            .output()
            .unwrap();
        assert!(output.status.success(), "{:?}", output);
        String::from_utf8(output.stdout).unwrap()
    };
    env_git(&["read-tree", &tree]);
    env_git(&[
        "update-index",
        "--add",
        "--cacheinfo",
        &format!("100644,{blob},specs/2026-10-11-web-ui/spec.md"),
    ]);
    let new_tree = env_git(&["write-tree"]).trim().to_string();
    let commit = repo
        .git(&[
            "commit-tree",
            &new_tree,
            "-p",
            &parent,
            "-m",
            "spec(web-ui): web UI",
        ])
        .trim()
        .to_string();
    repo.git(&["update-ref", &format!("refs/heads/{FOLDER}"), &commit]);

    let changes = next(&receiver);
    assert!(
        changes.features.contains(&FOLDER.to_string()),
        "{changes:?}"
    );
    assert!(
        changes
            .files
            .contains(&"2026-10-11-web-ui/spec.md".to_string()),
        "{changes:?}"
    );
}

/// The spec's watcher update: a code commit moves the branch's tip without touching `specs/`.
#[test]
fn a_code_commit_on_a_feature_branch_is_reported() {
    let repo = repo();
    let place = place::reach(&Git::discover(repo.path()).unwrap(), FOLDER).unwrap();
    let (_watcher, receiver) = watching(&repo);

    std::fs::create_dir_all(place.root.join("src")).unwrap();
    std::fs::write(place.root.join("src/main.rs"), "fn main() {}\n").unwrap();
    run_git(&place.root, &["add", "src/main.rs"]);
    run_git(
        &place.root,
        &[
            "commit",
            "--quiet",
            "--no-verify",
            "--message",
            "feat(web-ui): main",
        ],
    );

    let changes = next(&receiver);
    assert!(
        changes.features.contains(&FOLDER.to_string()),
        "{changes:?}"
    );
}

/// US4.5: a feature's changes are counted from its merge base with the default branch, so a commit
/// on the default branch, which may move that base, reports the feature too.
#[test]
fn a_commit_on_the_default_branch_reports_the_features_with_a_branch() {
    let repo = repo();
    let (_watcher, receiver) = watching(&repo);

    repo.write("README.md", "# Read me\n");
    repo.commit("docs: read me");

    let changes = next(&receiver);
    assert!(
        changes.features.contains(&FOLDER.to_string()),
        "{changes:?}"
    );
}

/// Writes the priorities, and returns every report up to the one that saw the write: the
/// snapshot that saw it was read after everything done before the write.
fn until_priorities(
    repo: &TestRepo,
    receiver: &mpsc::Receiver<Changes>,
    idea: &str,
) -> Vec<Changes> {
    repo.write(
        "specs/PRIORITIES.md",
        &format!("# Priorities\n\n## Now\n\n- {idea}\n"),
    );
    let mut reports = vec![next(receiver)];
    while !reports.last().unwrap().priorities {
        reports.push(next(receiver));
    }
    reports
}

/// Review focus 3: a merged and deleted branch has no tip, and its feature is published once.
#[test]
fn a_deleted_feature_branch_is_reported_once() {
    let repo = repo();
    let (_watcher, receiver) = watching(&repo);

    repo.git(&[
        "merge",
        "--quiet",
        "--no-ff",
        "--no-verify",
        "--message",
        "merge",
        FOLDER,
    ]);
    repo.git(&["branch", "--delete", FOLDER]);

    let reports = until_priorities(&repo, &receiver, "After the merge");
    assert!(
        reports
            .iter()
            .any(|changes| changes.features.contains(&FOLDER.to_string())),
        "{reports:?}"
    );
    let reports = until_priorities(&repo, &receiver, "Later");
    assert!(
        reports.iter().all(|changes| changes.features.is_empty()),
        "{reports:?}"
    );
}

#[test]
fn an_edit_of_the_priorities_is_reported() {
    let repo = repo();
    let (_watcher, receiver) = watching(&repo);

    repo.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Now\n\n- An idea\n\n## Next\n",
    );

    let changes = next(&receiver);
    assert!(changes.priorities);
    assert!(changes.features.is_empty());
}

#[test]
fn an_edit_of_the_inbox_is_reported() {
    let repo = repo();
    let (_watcher, receiver) = watching(&repo);

    repo.write("specs/INBOX.md", "# Inbox\n\n- A note\n");

    let changes = next(&receiver);
    assert!(changes.inbox);
    assert!(!changes.priorities);
    assert!(changes.features.is_empty());
}

#[test]
fn an_edit_of_the_inbox_triage_is_reported() {
    let repo = repo();
    let (_watcher, receiver) = watching(&repo);

    repo.write(
        "specs/INBOX-TRIAGE.md",
        "---\nstatus: awaiting-human\n---\n\n# Inbox triage\n",
    );

    assert!(next(&receiver).inbox);
}

/// The check's view follows its candidates, which are files of their own.
#[test]
fn an_edit_of_a_decisions_check_candidate_is_reported() {
    let repo = repo();
    let (_watcher, receiver) = watching(&repo);

    repo.write(
        "specs/decisions-check/q1-a/git.md",
        "---\nstatus: proposed\n---\n\n# Git\n\nA choice.\n",
    );

    let changes = next(&receiver);
    assert!(changes.inbox);
    assert!(!changes.decisions);
}

/// The decisions page follows an edit of a decision or of the constitution, and only that.
#[test]
fn an_edit_of_a_decision_or_the_constitution_is_reported() {
    let repo = repo();
    let (_watcher, receiver) = watching(&repo);

    repo.write("specs/decisions/git.md", "# Git\n\nA choice.\n");
    let changes = next(&receiver);
    assert!(changes.decisions);
    assert!(!changes.priorities && !changes.inbox);

    repo.write("specs/CONSTITUTION.md", "# Constitution\n");
    assert!(next(&receiver).decisions);

    repo.write("specs/INBOX.md", "# Inbox\n\n- A note\n");
    assert!(!next(&receiver).decisions);
}

/// The feature's checkout, with a spec and a decision committed on its branch.
fn with_decision(repo: &TestRepo) -> place::Place {
    let place = place::reach(&Git::discover(repo.path()).unwrap(), FOLDER).unwrap();
    std::fs::write(
        place.root.join("specs/2026-10-11-web-ui/spec.md"),
        "---\nstatus: awaiting-human\n---\n\n# Spec: Web UI\n",
    )
    .unwrap();
    std::fs::create_dir_all(place.root.join("specs/decisions")).unwrap();
    std::fs::write(
        place.root.join("specs/decisions/git.md"),
        "# Git\n\n## Rules\n\n- Commits MUST be small.\n",
    )
    .unwrap();
    run_git(&place.root, &["add", "specs"]);
    run_git(
        &place.root,
        &[
            "commit",
            "--quiet",
            "--no-verify",
            "--message",
            "spec(web-ui): web UI",
        ],
    );
    place
}

/// The spec's decision cards and a decision's page follow a decision the branch changes.
#[test]
fn a_decision_committed_on_a_feature_branch_is_reported_for_its_spec_and_its_page() {
    let repo = repo();
    let place = with_decision(&repo);
    let (_watcher, receiver) = watching(&repo);

    std::fs::write(
        place.root.join("specs/decisions/git.md"),
        "# Git\n\n## Rules\n\n- Commits MUST be tiny.\n",
    )
    .unwrap();
    run_git(&place.root, &["add", "specs"]);
    run_git(
        &place.root,
        &[
            "commit",
            "--quiet",
            "--no-verify",
            "--message",
            "decision(web-ui): git",
        ],
    );

    let changes = next(&receiver);
    assert_eq!(changes.branch_decisions, [format!("{FOLDER}/git")]);
    assert!(
        changes.files.contains(&format!("{FOLDER}/spec.md")),
        "{changes:?}"
    );
}

#[test]
fn an_uncommitted_edit_of_a_branch_decision_is_reported_for_its_spec_and_its_page() {
    let repo = repo();
    let place = with_decision(&repo);
    let (_watcher, receiver) = watching(&repo);

    std::fs::write(
        place.root.join("specs/decisions/git.md"),
        "# Git\n\n## Rules\n\n- Commits MUST be tiny.\n",
    )
    .unwrap();

    let changes = next(&receiver);
    assert_eq!(changes.branch_decisions, [format!("{FOLDER}/git")]);
    assert!(
        changes.files.contains(&format!("{FOLDER}/spec.md")),
        "{changes:?}"
    );
}

#[test]
fn a_code_commit_reports_no_branch_decision() {
    let repo = repo();
    let place = with_decision(&repo);
    let (_watcher, receiver) = watching(&repo);

    std::fs::create_dir_all(place.root.join("src")).unwrap();
    std::fs::write(place.root.join("src/main.rs"), "fn main() {}\n").unwrap();
    run_git(&place.root, &["add", "src/main.rs"]);
    run_git(
        &place.root,
        &[
            "commit",
            "--quiet",
            "--no-verify",
            "--message",
            "feat(web-ui): main",
        ],
    );

    let changes = next(&receiver);
    assert!(changes.branch_decisions.is_empty(), "{changes:?}");
}

/// The inbox is the default branch's: a feature checkout's copy is not it.
#[test]
fn an_edit_of_a_feature_checkouts_inbox_is_not_reported_as_the_inbox() {
    let repo = repo();
    let place = place::reach(&Git::discover(repo.path()).unwrap(), FOLDER).unwrap();
    let (_watcher, receiver) = watching(&repo);

    std::fs::write(place.root.join("specs/INBOX.md"), "# Inbox\n\n- A note\n").unwrap();

    let reports = until_priorities(&repo, &receiver, "After the note");
    assert!(reports.iter().all(|changes| !changes.inbox), "{reports:?}");
}

#[test]
fn a_new_worktree_is_reported_then_watched() {
    let repo = repo();
    let (_watcher, receiver) = watching(&repo);

    let place = place::reach(&Git::discover(repo.path()).unwrap(), FOLDER).unwrap();

    let changes = next(&receiver);
    assert!(changes.workspace, "{changes:?}");
    while receiver.recv_timeout(Duration::from_millis(500)).is_ok() {}
    std::fs::write(
        place.root.join("specs/2026-10-11-web-ui/proposal.md"),
        "# Changed\n",
    )
    .unwrap();
    // The new worktree's own watch can report once, with no files, after the quiet window above on
    // a loaded machine (one did): that one late empty report is skipped, so a second, or a write
    // report that lists no file, still fails.
    let mut changes = next(&receiver);
    if changes.files.is_empty() {
        changes = next(&receiver);
    }
    assert_eq!(changes.files, ["2026-10-11-web-ui/proposal.md"]);
}

#[test]
fn a_dropped_watcher_stops() {
    let repo = repo();
    let (watcher, receiver) = watching(&repo);
    drop(watcher);

    repo.write("specs/PRIORITIES.md", "# Priorities\n\n## Now\n\n- Gone\n");

    assert!(receiver.recv_timeout(Duration::from_millis(800)).is_err());
}

/// Whether a report flags the priorities within 5 seconds, every report before it taken.
fn flags_priorities(receiver: &mpsc::Receiver<Changes>) -> bool {
    while let Ok(changes) = receiver.recv_timeout(Duration::from_secs(5)) {
        if changes.priorities {
            return true;
        }
    }
    false
}

/// Review focus 4: the priorities record shows each proposal's nested lines and its feature's step.
#[test]
fn a_child_line_or_a_step_change_flags_the_priorities() {
    let repo = repo();
    let entry = "# Priorities\n\n## Now\n\n- [Web UI](/specs/2026-10-11-web-ui/proposal.md)\n";
    repo.write("specs/PRIORITIES.md", &format!("{entry}  - a child\n"));
    repo.commit("chore: priorities");
    let place = place::reach(&Git::discover(repo.path()).unwrap(), FOLDER).unwrap();
    let (_watcher, receiver) = watching(&repo);

    repo.write(
        "specs/PRIORITIES.md",
        &format!("{entry}  - another child\n"),
    );
    assert!(flags_priorities(&receiver), "a child line");

    let round = place
        .root
        .join("specs/2026-10-11-web-ui/clarifications-01.md");
    std::fs::write(
        &round,
        clarifications("answered", "1 question, about 3 minutes.", &["A"]),
    )
    .unwrap();
    run_git(&place.root, &["add", "specs"]);
    run_git(
        &place.root,
        &[
            "commit",
            "--quiet",
            "--no-verify",
            "--message",
            "answer(web-ui): A",
        ],
    );
    assert!(flags_priorities(&receiver), "a step change");
}

/// The check's candidates are read from the default branch, wherever the main checkout is: a switch
/// of it to another branch is no change of the inbox.
#[test]
fn a_switch_of_the_main_checkout_to_another_branch_reports_no_inbox_change() {
    let repo = repo();
    repo.write(
        "specs/decisions-check/q1-a/git.md",
        "---\nstatus: proposed\n---\n\n# Git\n\nA choice.\n",
    );
    repo.commit("chore: propose a check");
    let (_watcher, receiver) = watching(&repo);

    repo.switch(FOLDER);

    let changes = next(&receiver);
    assert!(!changes.inbox);
}

/// Writes the answer of the feature's round in `root`, and commits it unless `commit` is false.
fn answer(root: &std::path::Path, commit: bool) {
    let round = root.join("specs/2026-10-11-web-ui/clarifications-01.md");
    std::fs::write(
        &round,
        clarifications("answered", "1 question, about 3 minutes.", &["A"]),
    )
    .unwrap();
    if commit {
        run_git(root, &["add", "specs"]);
        run_git(
            root,
            &[
                "commit",
                "--quiet",
                "--no-verify",
                "--message",
                "answer(web-ui): A",
            ],
        );
    }
}

/// The first report naming the feature, if one comes before `deadline`.
fn reports_feature(receiver: &mpsc::Receiver<Changes>, deadline: Instant) -> Option<Changes> {
    while let Some(left) = deadline.checked_duration_since(Instant::now()) {
        match receiver.recv_timeout(left) {
            Ok(changes) if changes.features.contains(&FOLDER.to_string()) => return Some(changes),
            Ok(_) => {}
            Err(_) => return None,
        }
    }
    None
}

/// US3.3: a worktree deleted and re-created at its path is a new folder, watched again. An
/// uncommitted answer shows only through the worktree's own watch, a commit through git's too.
/// It times SC-003's second, the exception the testing decision makes for a spec's success
/// criteria.
#[test]
fn a_worktree_re_created_at_its_path_is_watched_again() {
    let repo = repo();
    let place = place::reach(&Git::discover(repo.path()).unwrap(), FOLDER).unwrap();
    let path = place.root.to_str().unwrap().to_string();
    let (_watcher, receiver) = watching(&repo);

    repo.git(&["worktree", "remove", &path]);
    repo.git(&["worktree", "add", "--quiet", &path, FOLDER]);
    // The same worktree at the same path reports nothing: what the watcher read again settles.
    std::thread::sleep(Duration::from_millis(800));
    while receiver.try_recv().is_ok() {}

    answer(&place.root, false);
    let changes = reports_feature(&receiver, Instant::now() + Duration::from_secs(1))
        .expect("the uncommitted answer within 1 second");
    assert!(
        changes
            .files
            .contains(&"2026-10-11-web-ui/clarifications-01.md".to_string()),
        "{changes:?}"
    );
    answer(&place.root, true);
    assert!(reports_feature(&receiver, Instant::now() + Duration::from_secs(1)).is_some());
}

/// US3, more scenario 2: git's commands writing the worktree's folder in `.git` every 100 ms keep
/// a burst of events going, and a commit made meanwhile still shows within a second: `LONGEST`
/// after the burst's first event, with a margin for the read. It times SC-003's second, the
/// exception the testing decision makes for a spec's success criteria.
#[test]
fn a_burst_under_steady_writes_reports_within_a_second() {
    let repo = repo();
    let place = place::reach(&Git::discover(repo.path()).unwrap(), FOLDER).unwrap();
    let admin = PathBuf::from(run_git(&place.root, &["rev-parse", "--absolute-git-dir"]).trim());
    let (_watcher, receiver) = watching(&repo);

    let start = Instant::now();
    let writes = std::thread::spawn(move || {
        while start.elapsed() < Duration::from_secs(3) {
            std::fs::write(admin.join("steady"), format!("{:?}", start.elapsed())).unwrap();
            std::thread::sleep(Duration::from_millis(100));
        }
    });
    // 300 ms into the burst: a watcher waiting for quiet would report after the writes end.
    std::thread::sleep(Duration::from_millis(300));
    answer(&place.root, true);
    let committed = Instant::now();

    let changes = reports_feature(&receiver, start + Duration::from_millis(2900));
    let waited = committed.elapsed();
    writes.join().unwrap();
    assert!(changes.is_some(), "no report while the writes went on");
    assert!(
        waited < LONGEST + Duration::from_millis(200),
        "reported {waited:?} after the commit"
    );
}
