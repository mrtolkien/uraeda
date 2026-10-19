//! The watcher reports what changed in the repository, whichever checkout or branch it happened
//! on, so the web UI follows git. Each flow waits for the report that holds the change.

use std::sync::mpsc;
use std::time::Duration;

use uraeda_core::actions::place;
use uraeda_core::git::Git;
use uraeda_core::watch::{Changes, Watcher, watch};

use crate::common::repo::TestRepo;
use crate::common::texts::{clarifications, proposal};

const FOLDER: &str = "2026-10-11-web-ui";
const ROUND: &str = "specs/2026-10-11-web-ui/clarifications-01.md";

fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", "# Priorities\n\n## Now\n\n## Next\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.write(
        ROUND,
        &clarifications("awaiting-human", "1 question.", &[""]),
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

/// The first report that holds what the test waits for: a report without it is an earlier read.
fn until(receiver: &mpsc::Receiver<Changes>, held: impl Fn(&Changes) -> bool) -> Changes {
    loop {
        let changes = receiver
            .recv_timeout(Duration::from_secs(10))
            .expect("the change was reported");
        if held(&changes) {
            return changes;
        }
    }
}

#[test]
fn an_answer_written_in_a_worktree_is_reported_for_its_feature_and_file() {
    let repo = repo();
    let place = place::reach(&Git::discover(repo.path()).unwrap(), FOLDER).unwrap();
    let (_watcher, receiver) = watching(&repo);

    let round = place.root.join(ROUND);
    let text = std::fs::read_to_string(&round).unwrap();
    std::fs::write(&round, text.replace("**Answer:**\n", "**Answer:** A\n")).unwrap();

    let changes = until(&receiver, |c| !c.files.is_empty());
    assert_eq!(changes.files, ["2026-10-11-web-ui/clarifications-01.md"]);
    assert_eq!(changes.features, [FOLDER]);
    assert!(!changes.priorities && !changes.inbox);
}

#[test]
fn a_commit_moving_a_branch_or_the_default_branch_reports_the_feature() {
    let repo = repo();
    let (_watcher, receiver) = watching(&repo);

    // A commit on the feature's branch, written without touching any checkout.
    let tree = repo
        .git(&["rev-parse", &format!("{FOLDER}^{{tree}}")])
        .trim()
        .to_string();
    let parent = repo.git(&["rev-parse", FOLDER]).trim().to_string();
    let commit = repo.git(&[
        "commit-tree",
        &tree,
        "-p",
        &parent,
        "-m",
        "feat(web-ui): elsewhere",
    ]);
    repo.git(&["update-ref", &format!("refs/heads/{FOLDER}"), commit.trim()]);
    until(&receiver, |c| c.features.contains(&FOLDER.to_string()));

    // A commit on the default branch, which may move the feature's merge base.
    repo.write("README.md", "# Read me\n");
    repo.commit("docs: read me");
    until(&receiver, |c| c.features.contains(&FOLDER.to_string()));
}

#[test]
fn the_lists_the_ledger_and_the_workspace_are_reported_each_on_its_own() {
    let repo = repo();
    let (_watcher, receiver) = watching(&repo);

    repo.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Now\n\n- An idea\n\n## Next\n",
    );
    let priorities = until(&receiver, |c| c.priorities);
    assert!(!priorities.inbox && !priorities.decisions && priorities.features.is_empty());

    repo.write("specs/INBOX.md", "# Inbox\n\n- A note\n");
    let inbox = until(&receiver, |c| c.inbox);
    assert!(!inbox.priorities && !inbox.decisions);

    repo.write("specs/decisions/git.md", "# Git\n\nA choice.\n");
    let decisions = until(&receiver, |c| c.decisions);
    assert!(!decisions.priorities && !decisions.inbox);

    repo.write(
        "specs/decisions-check/q1-a/git.md",
        "---\nstatus: proposed\n---\n\n# Git\n\nA choice.\n",
    );
    let candidate = until(&receiver, |c| c.inbox);
    assert!(
        !candidate.decisions,
        "a candidate belongs to the check, not the ledger"
    );
}

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
    until(&receiver, |c| c.features.contains(&FOLDER.to_string()));

    // Every later report, up to the one that holds a new write, leaves the feature out.
    repo.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Now\n\n- After the merge\n",
    );
    let mut reports = vec![receiver.recv_timeout(Duration::from_secs(10)).unwrap()];
    while !reports.last().unwrap().priorities {
        reports.push(receiver.recv_timeout(Duration::from_secs(10)).unwrap());
    }
    assert!(
        reports
            .iter()
            .all(|c| !c.features.contains(&FOLDER.to_string())),
        "{reports:?}"
    );
}

#[test]
fn a_new_worktree_is_reported_and_then_watched() {
    let repo = repo();
    let (_watcher, receiver) = watching(&repo);

    let place = place::reach(&Git::discover(repo.path()).unwrap(), FOLDER).unwrap();
    until(&receiver, |c| c.workspace);

    std::fs::write(
        place.root.join(ROUND),
        clarifications("awaiting-human", "1 question.", &["A"]),
    )
    .unwrap();
    let changes = until(&receiver, |c| !c.files.is_empty());
    assert_eq!(changes.features, [FOLDER]);
}
