//! The Git page's views: the history marked to pull and to push, the changes grouped by checkout,
//! and the worktrees with their state.

mod common;

use common::repo::TestRepo;
use common::texts::proposal;
use std::time::{Duration, Instant};
use uraeda_core::api::{self, ChangeGroupView, FileChangeView, WorktreeView};

const FOLDER: &str = "2026-10-11-web-ui";
const PROPOSAL: &str = "specs/2026-10-11-web-ui/proposal.md";

/// Break caught: the history walking `HEAD` alone, which never shows the commits to pull.
#[test]
fn the_history_marks_commits_to_pull_and_to_push() {
    let repo = TestRepo::with_origin();
    for n in 1..=2 {
        repo.write(&format!("local-{n}.md"), "local\n");
        repo.commit(&format!("chore: local {n}"));
    }
    for n in 1..=3 {
        repo.upstream_commit(
            &format!("upstream-{n}.md"),
            "upstream\n",
            &format!("chore: upstream {n}"),
        );
    }

    let page = api::git_page(repo.path()).unwrap();

    let rows: Vec<(&str, &str)> = page
        .history
        .iter()
        .map(|row| (row.subject.as_str(), row.mark.as_str()))
        .collect();
    assert_eq!(
        rows,
        [
            ("chore: upstream 3", "pull"),
            ("chore: upstream 2", "pull"),
            ("chore: upstream 1", "pull"),
            ("chore: local 2", "push"),
            ("chore: local 1", "push"),
            ("chore: start", ""),
        ]
    );
    assert!(!page.has_more_history);
    assert_eq!((page.ahead, page.behind), (2, 3));

    // The next page continues after the row it names.
    let next = api::git_history(repo.path(), &page.history[2].id).unwrap();
    let subjects: Vec<&str> = next
        .commits
        .iter()
        .map(|row| row.subject.as_str())
        .collect();
    assert_eq!(
        subjects,
        ["chore: local 2", "chore: local 1", "chore: start"]
    );
}

/// A repository on `main` with its priorities, and a feature on its own branch.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Now\n\n- Web UI\n",
    );
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write(PROPOSAL, &proposal());
    repo.commit("discovery(web-ui): web UI");
    repo.switch("main");
    repo
}

/// US3 more 7 and US6 3: a buffer's save in a feature's worktree is a group of its own, named by
/// the feature; a hand-made worktree is listed, not grouped. Break caught: listing every worktree
/// as a group.
#[test]
fn the_page_groups_changes_and_lists_worktrees() {
    let repo = repo();
    let read = api::read_buffer(repo.path(), PROPOSAL).unwrap();
    let saved = format!("{}\nA line more.\n", read.text);
    api::save_buffer(repo.path(), PROPOSAL, &saved, &read.hash).unwrap();
    repo.write("docs/notes.md", "# Notes\n");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        ".worktrees/coherence-before",
        "-b",
        "coherence-before",
    ]);
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        ".worktrees/gone",
        "-b",
        "gone",
    ]);
    std::fs::remove_dir_all(repo.path().join(".worktrees/gone")).unwrap();

    let page = api::git_page(repo.path()).unwrap();

    let file = |path: &str, state: &str, added: u32| FileChangeView {
        path: path.to_string(),
        state: state.to_string(),
        staged: "no".to_string(),
        added: Some(added),
        removed: Some(0),
    };
    assert_eq!(
        page.groups,
        [
            ChangeGroupView {
                folder: None,
                name: "main".to_string(),
                files: vec![file("docs/notes.md", "new", 1)],
                default_message: None,
            },
            ChangeGroupView {
                folder: Some(FOLDER.to_string()),
                name: "Feature".to_string(),
                files: vec![file(PROPOSAL, "modified", 2)],
                default_message: None,
            },
        ]
    );
    let worktree =
        |path: &str, name: &str, branch: &str, folder: Option<&str>, state: &str| WorktreeView {
            path: path.to_string(),
            name: name.to_string(),
            branch: Some(branch.to_string()),
            folder: folder.map(String::from),
            state: state.to_string(),
        };
    assert_eq!(
        page.worktrees,
        [
            worktree(
                ".worktrees/2026-10-11-web-ui",
                "Feature",
                FOLDER,
                Some(FOLDER),
                "changes"
            ),
            worktree(
                ".worktrees/coherence-before",
                "coherence-before",
                "coherence-before",
                None,
                "clean"
            ),
            worktree(".worktrees/gone", "gone", "gone", None, "missing"),
        ]
    );

    // A group's diff reads its own checkout, and nothing outside it.
    let feature = api::GitAt {
        folder: Some(FOLDER.to_string()),
        commit: None,
    };
    let diff = api::git_diff(repo.path(), &feature, PROPOSAL, false).unwrap();
    assert_eq!((diff.added, diff.removed), (2, 0));
    assert_eq!(diff.id, format!("{FOLDER}:{PROPOSAL}"));
    let whole = api::git_diff(repo.path(), &feature, PROPOSAL, true).unwrap();
    assert_eq!(whole.id, format!("{FOLDER}:{PROPOSAL}:whole"));
    let main = api::GitAt::default();
    std::fs::write(repo.parent().join("outside.md"), "outside\n").unwrap();
    let outside = api::git_diff(repo.path(), &main, "../outside.md", false);
    assert_eq!(refused(outside), "../outside.md is not in this checkout.");
    assert!(api::conflict_file(repo.path(), "docs/notes.md").is_err());
}

/// The sidebar's count is the main checkout's changes alone: a feature's worktree, with a buffer's
/// save, keeps its own changes on its branch, and they wait on the Git page without counting, read
/// from the main checkout or from the worktree. Breaks caught: adding each feature worktree's
/// changed files to the count; counting the checkout read from instead of the main one.
#[test]
fn the_count_is_the_main_checkouts_changes_alone() {
    let repo = repo();
    let read = api::read_buffer(repo.path(), PROPOSAL).unwrap();
    let saved = format!("{}\nA line more.\n", read.text);
    api::save_buffer(repo.path(), PROPOSAL, &saved, &read.hash).unwrap();
    assert_eq!(api::git_page(repo.path()).unwrap().groups.len(), 2);
    assert_eq!(api::git_summary(repo.path()).unwrap().changes, 0);

    repo.write("docs/notes.md", "# Notes\n");
    repo.write("docs/more.md", "# More\n");
    let summary = api::git_summary(repo.path()).unwrap();
    assert_eq!((summary.changes, summary.behind), (2, 0));
    let from_worktree = repo.path().join(".worktrees").join(FOLDER);
    assert_eq!(api::git_summary(&from_worktree).unwrap().changes, 2);
}

/// A worktree that cannot be read does not fail the page: its row reads `changes`, so nothing
/// offers to remove it, and it has no group. A commit the history does not hold, as on
/// another branch, is refused, so the web reloads the first page. Breaks: a worktree's read error
/// returned; the history's walk ending with no page.
#[test]
fn an_unreadable_worktree_or_an_unknown_commit_fails_no_read() {
    let repo = repo();
    let read = api::read_buffer(repo.path(), PROPOSAL).unwrap();
    let saved = format!("{}\nA line more.\n", read.text);
    api::save_buffer(repo.path(), PROPOSAL, &saved, &read.hash).unwrap();
    repo.write("docs/notes.md", "# Notes\n");

    let elsewhere = repo.git(&["rev-parse", FOLDER]);
    let history = api::git_history(repo.path(), elsewhere.trim());
    assert_eq!(
        refused(history),
        format!("{} is not in this history.", elsewhere.trim())
    );

    std::fs::write(
        repo.path()
            .join(".git/worktrees")
            .join(FOLDER)
            .join("index"),
        "not an index",
    )
    .unwrap();
    let page = api::git_page(repo.path()).unwrap();
    assert_eq!(page.groups.len(), 1);
    assert_eq!(page.worktrees[0].state, "changes");
}

fn refused<T: std::fmt::Debug>(result: Result<T, api::ApiError>) -> String {
    match result {
        Err(error) if error.code == "refused" => error.message,
        other => panic!("not refused: {other:?}"),
    }
}

/// SC-001, with `vp run bench`: the Git page of Uraeda's own repository, its history, changes, and
/// worktrees, read from what the server holds, a watch running as the server's does, the mean of
/// 10 reads after a first one. The performance decision's 100 ms is on a release build, where it
/// is checked; a debug build, as `vp run bench` makes, only prints its mean: unoptimized, gix's
/// status of one checkout of this repository takes about 100 ms alone (ruling R29).
#[test]
#[ignore = "benchmark"]
fn bench_git_page_on_uraedas_repository() {
    let repo = common::repository_path("");
    let _watch = uraeda_core::watch::watch(&repo, |_| {}).unwrap();
    api::git_page(&repo).unwrap();
    let times: Vec<Duration> = (0..10)
        .map(|_| {
            let start = Instant::now();
            let page = api::git_page(&repo).unwrap();
            let elapsed = start.elapsed();
            assert!(!page.history.is_empty(), "{page:?}");
            elapsed
        })
        .collect();
    let mean = times.iter().sum::<Duration>() / times.len() as u32;
    println!("git_page: mean {mean:?} of {times:?}");
    if !cfg!(debug_assertions) {
        assert!(mean < Duration::from_millis(100), "mean {mean:?}");
    }
}
