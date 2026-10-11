mod common;

use std::path::Path;

use common::repo::TestRepo;
use common::texts::{clarifications, proposal, spec};
use uraeda_core::api;
use uraeda_core::files::priorities;

const FOLDER: &str = "2026-10-11-web-ui";
const SPEC: &str = "specs/2026-10-11-web-ui/spec.md";

fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", "# Priorities\n\n## Now\n");
    repo.write(".env", "SECRET=1\n");
    repo.git(&["add", "specs"]);
    repo.git(&["commit", "--quiet", "--no-verify", "-m", "chore: specs"]);
    repo.switch_new(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.write(SPEC, &spec("awaiting-human", 1, 1));
    repo.write(
        "specs/2026-10-11-web-ui/clarifications-01.md",
        &clarifications("answered", "Answered.", &["A", "B"]),
    );
    repo.git(&["add", "specs"]);
    repo.git(&["commit", "--quiet", "--no-verify", "-m", "spec"]);
    repo.switch("main");
    repo
}

/// C2: a verdict never commits a version the reviewer did not see.
#[test]
fn a_verdict_is_refused_while_the_file_differs_from_its_tip() {
    let repo = repo();
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        ".worktrees/2026-10-11-web-ui",
        FOLDER,
    ]);
    let path = repo.path().join(".worktrees/2026-10-11-web-ui").join(SPEC);
    let text = std::fs::read_to_string(&path).unwrap();
    std::fs::write(&path, format!("{text}Unfinished edit.\n")).unwrap();

    let error = api::approve(repo.path(), FOLDER, "spec.md", None, None, None).unwrap_err();

    assert_eq!(
        error.message,
        "spec.md has changes not committed: the review is of the committed version"
    );
    assert_eq!(repo.subjects(FOLDER)[0], "spec");
    let error = api::request_changes(repo.path(), FOLDER, "spec.md", None).unwrap_err();
    assert_eq!(error.code, "refused");
}

/// I3: writes from two threads at once both land.
#[test]
fn writes_at_once_are_serialized() {
    let repo = repo();
    let text = clarifications("awaiting-human", "Two questions.", &["", ""]);
    repo.switch(FOLDER);
    repo.write("specs/2026-10-11-web-ui/clarifications-01.md", &text);
    repo.git(&["commit", "--quiet", "--no-verify", "--all", "-m", "round"]);
    repo.switch("main");
    let root = repo.path().to_path_buf();

    let threads: Vec<_> = ["Q1", "Q2"]
        .into_iter()
        .map(|id| {
            let root = root.clone();
            std::thread::spawn(move || {
                api::save_answer(&root, FOLDER, id, &["A".to_string()], "", "").map(|_| ())
            })
        })
        .collect();
    for thread in threads {
        thread.join().unwrap().unwrap();
    }

    let written =
        repo.read(".worktrees/2026-10-11-web-ui/specs/2026-10-11-web-ui/clarifications-01.md");
    assert_eq!(written.matches("**Answer:** A\n").count(), 2, "{written}");
}

/// I4: a refused approval that deleted an older review is committed again.
#[test]
fn try_again_commits_a_deleted_review_file() {
    let repo = repo();
    repo.switch(FOLDER);
    repo.write(
        "specs/2026-10-11-web-ui/spec-review.md",
        "---\nverdict: approved\ncommit: 0000000\n---\n\n# Review: Spec, Feature\n",
    );
    repo.git(&["add", "specs"]);
    repo.git(&["commit", "--quiet", "--no-verify", "-m", "old review"]);
    repo.switch("main");
    repo.set_hook("exit 1");
    let refused = api::approve(repo.path(), FOLDER, "spec.md", None, None, None).unwrap_err();
    assert_eq!(refused.code, "hook");
    repo.set_hook("exit 0");

    let committed = api::retry_commit(repo.path(), FOLDER, "spec.md").unwrap();

    assert_eq!(committed.subject, "spec(web-ui): approve");
    assert_eq!(
        repo.changed_in(FOLDER),
        ["specs/2026-10-11-web-ui/spec-review.md", SPEC]
    );
}

/// M2: raw files are the repository's tracked ones only.
#[test]
fn raw_files_are_tracked_files_only() {
    let repo = repo();

    assert!(api::read_raw(repo.path(), ".env").is_err());
    assert!(api::read_raw(repo.path(), ".git/config").is_err());
    assert_eq!(
        api::read_raw(repo.path(), "specs/README.md").unwrap(),
        "# Specs\n"
    );
    assert!(api::read_raw(Path::new(repo.path()), "specs/2026-10-11-web-ui/spec.md").is_ok());
}

/// C3: nested lines come as spans, without their markers.
#[test]
fn nested_priority_lines_come_as_spans() {
    let read = priorities::read(
        "# Priorities\n\n## Later\n\n- [Nice TUI](drafts/cli-tuis.md)\n  - see [notes](x.md)\n",
        None,
    );

    let nested = &read.sections[2].entries[0].nested_spans;
    assert_eq!(nested.len(), 1);
    let text: String = nested[0].iter().map(|s| s.text.as_str()).collect();
    assert_eq!(text, "see notes");
    assert!(nested[0].iter().any(|s| s.link.is_some()));
}

const BUG: &str = "2026-10-11-crash";
const REPORT: &str = "specs/bugs/2026-10-11-crash/report.md";

fn with_bug(repo: &TestRepo) {
    repo.switch_new(&format!("fix/{BUG}"));
    repo.write(REPORT, "# Report: Crash\n\nIt breaks.\n");
    repo.git(&["add", "specs"]);
    repo.git(&["commit", "--quiet", "--no-verify", "-m", "report"]);
    repo.switch("main");
}

/// Codex review: a draft path never leaves the drafts.
#[test]
fn draft_paths_stay_in_the_drafts() {
    let repo = repo();
    // With both folders there, `..` resolves through them.
    repo.write("specs/drafts/idea.md", "# Idea\n");
    repo.write("specs/backlog/later.md", "# Later\n");
    let readme = uraeda_core::files::document::hash("# Specs\n");

    for path in [
        "specs/drafts/../README.md",
        "specs/drafts/../../.env",
        "specs/backlog/../PRIORITIES.md",
    ] {
        assert!(api::read_text(repo.path(), path).is_err(), "{path}");
        assert!(api::read_draft(repo.path(), path).is_err(), "{path}");
        assert!(
            api::save_text(repo.path(), path, "x", &readme).is_err(),
            "{path}"
        );
    }
    assert_eq!(
        std::fs::read_to_string(repo.path().join("specs/README.md")).unwrap(),
        "# Specs\n"
    );
}

/// Codex review: starting a feature takes a draft, never another file.
#[test]
fn a_feature_starts_from_a_draft_only() {
    let repo = repo();
    let outside = repo.parent().join("victim.md");
    std::fs::write(&outside, "# Victim\n\n## What\n\nKeep me.\n").unwrap();

    for draft in [
        outside.to_str().unwrap(),
        "specs/drafts/../../../victim.md",
        "specs/README.md",
    ] {
        assert!(
            api::start_feature(repo.path(), draft, Some("victim")).is_err(),
            "{draft}"
        );
    }
    assert!(outside.exists());
    assert!(repo.path().join("specs/README.md").exists());
}

/// Codex review: a bug's report opens, saves, and commits in its editor.
#[test]
fn a_bug_report_is_edited_on_its_branch() {
    let repo = repo();
    with_bug(&repo);

    let read = api::read_text(repo.path(), REPORT).unwrap();
    assert_eq!(read.title, "Report: Crash");
    api::save_text(
        repo.path(),
        REPORT,
        "# Report: Crash\n\nIt breaks twice.\n",
        &read.hash,
    )
    .unwrap();
    api::commit_text(repo.path(), REPORT).unwrap();
    assert_eq!(
        repo.git(&["show", &format!("fix/{BUG}:{REPORT}")]),
        "# Report: Crash\n\nIt breaks twice.\n"
    );
}

/// Codex review: Discard drops staged edits too.
#[test]
fn discarding_the_priorities_drops_staged_edits() {
    let repo = repo();
    let read = api::read_priorities(repo.path()).unwrap();
    api::add_priority(repo.path(), "now", "An idea", &read.hash).unwrap();
    repo.git(&["add", "specs/PRIORITIES.md"]);

    let read = api::discard_priorities(repo.path()).unwrap();

    assert_eq!(read.changes, 0);
    assert_eq!(repo.git(&["status", "--porcelain", "--", "specs"]), "");
}

/// Codex review: a draft is made for the line the human saw, or not at all.
#[test]
fn drafting_is_refused_once_the_priorities_changed() {
    let repo = repo();
    let read = api::read_priorities(repo.path()).unwrap();
    let edited = api::add_priority(repo.path(), "now", "An idea", &read.hash).unwrap();

    let error = api::create_draft(repo.path(), "now-1", &read.hash).unwrap_err();
    assert_eq!(error.code, "conflict");
    api::create_draft(repo.path(), "now-1", &edited.hash).unwrap();
}
