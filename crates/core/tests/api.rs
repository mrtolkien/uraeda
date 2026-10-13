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
    repo.write("notes.txt", "untracked\n");

    for path in [".env", ".git/config", "notes.txt", "missing.md"] {
        let refused = api::read_raw(repo.path(), path).unwrap_err();
        assert_eq!(
            (refused.code, refused.message),
            ("refused", format!("{path}: no such file"))
        );
    }
    assert_eq!(
        api::read_raw(repo.path(), "specs/README.md").unwrap(),
        "# Specs\n"
    );
    assert!(api::read_raw(Path::new(repo.path()), "specs/2026-10-11-web-ui/spec.md").is_ok());
}

/// A committed symlink is never followed: it would serve any file the server can read.
#[cfg(unix)]
#[test]
fn raw_files_never_follow_a_symlink() {
    let repo = repo();
    // An absolute path, as a link to a file outside the repository would be.
    let outside = repo.path().join(".env");
    std::os::unix::fs::symlink(&outside, repo.path().join("specs/link.md")).unwrap();
    std::os::unix::fs::symlink("../.env", repo.path().join("specs/env.md")).unwrap();
    std::os::unix::fs::symlink(".", repo.path().join("specs/here")).unwrap();
    repo.git(&["add", "specs"]);
    repo.git(&["commit", "--quiet", "--no-verify", "-m", "links"]);
    repo.add_on_branch(FOLDER, "specs/2026-10-11-web-ui/mockups/a.html", "<p>a</p>");
    repo.switch(FOLDER);
    std::fs::remove_file(repo.path().join("specs/2026-10-11-web-ui/mockups/a.html")).unwrap();
    std::os::unix::fs::symlink(
        &outside,
        repo.path().join("specs/2026-10-11-web-ui/mockups/a.html"),
    )
    .unwrap();

    for path in [
        "specs/link.md",
        "specs/env.md",
        "specs/here/README.md",
        "specs/2026-10-11-web-ui/mockups/a.html",
    ] {
        let refused = api::read_raw(repo.path(), path).unwrap_err();
        assert_eq!(
            (refused.code, refused.message),
            ("refused", format!("{path}: no such file"))
        );
    }
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

/// Final review: an entry's lines come as written, for an Undo to write them back unchanged.
#[test]
fn priority_lines_come_as_written() {
    let read = priorities::read(
        "# Priorities\n\n## Later\n\n* Nix + Docker based\n  execution environments\n  - with a cache\n",
        None,
    );

    assert_eq!(
        read.sections[2].entries[0].lines,
        [
            "* Nix + Docker based",
            "  execution environments",
            "  - with a cache"
        ]
    );
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

/// The editor's facts about a text come from the core: its kind, its slug or folder, its discovery
/// effort, and its sections still empty.
#[test]
fn a_text_comes_with_what_its_editor_shows() {
    let repo = repo();
    with_bug(&repo);
    repo.write(
        "specs/backlog/later/proposal.md",
        "# Later\n\n## What\n\nSoon.\n\n## Why\n",
    );

    let postponed = api::read_text(repo.path(), "specs/backlog/later/proposal.md").unwrap();
    assert_eq!(
        (postponed.kind.as_str(), postponed.slug.as_deref()),
        ("draft", Some("later"))
    );
    assert_eq!(postponed.discovery.as_deref(), Some("high"));
    assert_eq!(postponed.discovery_levels, ["low", "medium", "high"]);
    assert!(!postponed.written);
    assert_eq!(postponed.empty_sections, ["Why"]);

    let proposal = api::read_text(repo.path(), "specs/2026-10-11-web-ui/proposal.md").unwrap();
    assert_eq!(
        (proposal.kind.as_str(), proposal.folder.as_deref()),
        ("proposal", Some(FOLDER))
    );
    assert_eq!(proposal.slug, None);

    let report = api::read_text(repo.path(), REPORT).unwrap();
    assert_eq!(
        (report.kind.as_str(), report.folder.as_deref()),
        ("report", Some(BUG))
    );
    assert_eq!(report.discovery, None);
    assert!(report.discovery_levels.is_empty());
}

#[test]
fn the_discovery_effort_is_set_over_the_version_read() {
    let repo = repo();
    let path = "specs/drafts/idea.md";
    repo.write(path, "# Idea\n\n## What\n\nA thing.\n");
    let read = api::read_text(repo.path(), path).unwrap();

    let set = api::set_discovery(repo.path(), path, "medium", &read.hash).unwrap();

    assert_eq!(
        set.text,
        "---\ndiscovery: medium\n---\n\n# Idea\n\n## What\n\nA thing.\n"
    );
    assert_eq!(set.discovery.as_deref(), Some("medium"));
    let stale = api::set_discovery(repo.path(), path, "low", &read.hash).unwrap_err();
    assert_eq!(stale.code, "conflict");
    let wrong = api::set_discovery(repo.path(), path, "deep", &set.hash).unwrap_err();
    assert_eq!(
        wrong.message,
        "discovery \"deep\" is not one of low, medium, high"
    );
    assert!(api::set_discovery(repo.path(), REPORT, "low", "").is_err());
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

/// C1: a feature lists its mockups, from its branch's tip, or from its working tree when checked
/// out.
#[test]
fn a_feature_lists_its_mockups() {
    let repo = repo();
    repo.add_on_branch(
        FOLDER,
        "specs/2026-10-11-web-ui/mockups/repeat.html",
        "<p>x</p>",
    );

    assert_eq!(
        api::read_feature(repo.path(), FOLDER).unwrap().mockups,
        vec!["repeat.html"]
    );

    repo.switch(FOLDER);
    repo.write("specs/2026-10-11-web-ui/mockups/a.html", "<p>a</p>");
    repo.write("specs/2026-10-11-web-ui/mockups/notes.txt", "notes");
    assert_eq!(
        api::read_feature(repo.path(), FOLDER).unwrap().mockups,
        vec!["a.html", "repeat.html"]
    );
}
