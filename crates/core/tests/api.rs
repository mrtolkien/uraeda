mod common;

use std::path::Path;

use common::repo::TestRepo;
use common::texts::{clarifications, proposal, spec};
use uraeda_core::api;
use uraeda_core::files::priorities;
use uraeda_core::workspace::Kind;

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

/// nvim plugin R18: a round is submitted only when it is the latest, whichever tool submits it.
#[test]
fn only_the_latest_round_is_submitted() {
    let repo = repo();
    repo.add_on_branch(
        FOLDER,
        "specs/2026-10-11-web-ui/clarifications-02.md",
        &clarifications("awaiting-human", "One question.", &["A"]),
    );

    let error = api::submit_answers(repo.path(), FOLDER, Some("clarifications-01.md")).unwrap_err();

    assert_eq!(
        (error.code, error.message.as_str()),
        (
            "refused",
            "clarifications-01.md is not the latest round: clarifications-02.md is"
        )
    );
    let submitted = api::submit_answers(repo.path(), FOLDER, Some("clarifications-02.md")).unwrap();
    assert_eq!(submitted.status.as_deref(), Some("answered"));
}

/// Drafts and the priorities are the default branch's: another branch's copy stands for them only
/// while it holds the default branch's text, read from its checkout when one has it.
#[test]
fn drafts_are_acted_on_from_another_branch_only_with_the_default_branchs_text() {
    let repo = repo();
    let path = "specs/PRIORITIES.md";
    let text = "# Priorities\n\n## Now\n";
    api::on_default_branch(repo.path(), path, "Anything.\n").unwrap();

    repo.switch(FOLDER);
    api::on_default_branch(repo.path(), path, text).unwrap();
    let error = api::on_default_branch(repo.path(), path, "Edited.\n").unwrap_err();
    assert_eq!(
        error.message,
        "PRIORITIES.md here differs from main's: open it from a checkout of main."
    );

    repo.git(&["worktree", "add", "--quiet", ".worktrees/main", "main"]);
    let checkout = std::fs::canonicalize(repo.path().join(".worktrees/main")).unwrap();
    std::fs::write(checkout.join("specs/drafts.md"), "Unsaved draft.\n").unwrap();
    api::on_default_branch(repo.path(), "specs/drafts.md", "Unsaved draft.\n").unwrap();
    let error = api::on_default_branch(repo.path(), path, "Edited.\n").unwrap_err();
    assert_eq!(
        error.message,
        format!(
            "PRIORITIES.md here differs from main's: open it from main's checkout, {}.",
            checkout.display()
        )
    );
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

/// A refused approval that deleted the folder's last image, unlinked, is committed again: the
/// deletion, staged by the refused commit, is not added again.
#[test]
fn try_again_commits_a_deleted_image() {
    let repo = repo();
    let image = "specs/2026-10-11-web-ui/images/old.webp";
    repo.add_on_branch(FOLDER, image, "old");
    repo.set_hook("exit 1");
    let refused = api::approve(repo.path(), FOLDER, "spec.md", None, None, None).unwrap_err();
    assert_eq!(refused.code, "hook");
    repo.set_hook("exit 0");

    let committed = api::retry_commit(repo.path(), FOLDER, "spec.md").unwrap();

    assert_eq!(committed.subject, "spec(web-ui): approve");
    assert_eq!(repo.changed_in(FOLDER), [image, SPEC]);
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

const CHANGE: &str = "2026-10-11-crash";
const CHANGE_PROPOSAL: &str = "specs/changes/2026-10-11-crash/proposal.md";

fn with_change(repo: &TestRepo) {
    repo.switch_new(&format!("change/{CHANGE}"));
    repo.write(CHANGE_PROPOSAL, "# Crash\n\nIt breaks.\n");
    repo.git(&["add", "specs"]);
    repo.git(&["commit", "--quiet", "--no-verify", "-m", "proposal"]);
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
    with_change(&repo);
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

    let change = api::read_text(repo.path(), CHANGE_PROPOSAL).unwrap();
    assert_eq!(
        (change.kind.as_str(), change.folder.as_deref()),
        ("proposal", Some(CHANGE))
    );
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
            api::start_feature(repo.path(), draft, Some("victim"), Kind::Feature).is_err(),
            "{draft}"
        );
    }
    assert!(outside.exists());
    assert!(repo.path().join("specs/README.md").exists());
}

/// A typed change's images are checked before anything is written: one of the wrong type is
/// refused by its name, and the repository is left as it was.
#[test]
fn a_change_with_an_image_of_the_wrong_type_writes_nothing() {
    let repo = repo();
    let still = std::fs::read(common::fixture("images/still.gif")).unwrap();
    let drawing = std::fs::read(common::fixture("images/drawing.svg")).unwrap();
    let before = (
        repo.git(&["for-each-ref"]),
        repo.porcelain(),
        repo.subjects("main"),
    );

    let started = api::start_change(
        repo.path(),
        "Fix the crash",
        &[still, drawing],
        Some("crash"),
    );

    let Err(refused) = started else {
        panic!("the start was not refused")
    };
    assert_eq!(
        refused.message,
        "Only PNG, JPEG, GIF, and WebP images can be added: image-2 is not one."
    );
    let after = (
        repo.git(&["for-each-ref"]),
        repo.porcelain(),
        repo.subjects("main"),
    );
    assert_eq!(after, before);
    assert!(!repo.path().join(".worktrees").exists());
}

/// The binding's kind: a feature when none is given, and nothing but a feature or a change.
#[test]
fn a_start_is_of_a_feature_or_a_change() {
    assert_eq!(api::start_kind(None).ok(), Some(Kind::Feature));
    assert_eq!(api::start_kind(Some("feature")).ok(), Some(Kind::Feature));
    assert_eq!(api::start_kind(Some("change")).ok(), Some(Kind::Change));
    assert_eq!(
        api::start_kind(Some("bug"))
            .err()
            .map(|error| error.message),
        Some("\"bug\" is not a kind: feature or change".to_string())
    );
}

/// R1: the slug a typed change is offered, from its title.
#[test]
fn a_typed_title_proposes_its_slug() {
    assert_eq!(
        api::propose_slug("Centre the x in failure circles"),
        "centre-x"
    );
}

/// Review focus 4: a change's proposal opens, saves, and commits on its branch.
#[test]
fn a_change_proposal_is_edited_on_its_branch() {
    let repo = repo();
    with_change(&repo);

    let read = api::read_text(repo.path(), CHANGE_PROPOSAL).unwrap();
    assert_eq!(read.title, "Crash");
    api::save_text(
        repo.path(),
        CHANGE_PROPOSAL,
        "# Crash\n\nIt breaks twice.\n",
        &read.hash,
    )
    .unwrap();
    let committed = api::commit_text(repo.path(), CHANGE_PROPOSAL).unwrap();
    assert_eq!(committed.subject, "chore(crash): edit the proposal");
    assert_eq!(
        repo.git(&["show", &format!("change/{CHANGE}:{CHANGE_PROPOSAL}")]),
        "# Crash\n\nIt breaks twice.\n"
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

/// A feature's files come in workflow order: each round's discovery before its questions.
#[test]
fn a_feature_lists_its_files_in_workflow_order() {
    let repo = repo();
    for name in ["discovery-02.md", "clarifications-02.md", "discovery-01.md"] {
        repo.add_on_branch(FOLDER, &format!("specs/{FOLDER}/{name}"), "# Discovery\n");
    }
    repo.add_on_branch(
        FOLDER,
        &format!("specs/{FOLDER}/spec-review.md"),
        "# Review\n",
    );

    let names: Vec<String> = api::read_feature(repo.path(), FOLDER)
        .unwrap()
        .files
        .into_iter()
        .map(|file| file.name)
        .collect();

    assert_eq!(
        names,
        [
            "proposal.md",
            "discovery-01.md",
            "clarifications-01.md",
            "discovery-02.md",
            "clarifications-02.md",
            "spec.md",
            "spec-review.md"
        ]
    );
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

/// A refused approval staged the review's new image; once the review no longer links it, trying
/// again deletes it and commits without it.
#[test]
fn try_again_drops_an_image_staged_then_unlinked() {
    let repo = repo();
    let review = "specs/2026-10-11-web-ui/spec-review.md";
    let worktree = ".worktrees/2026-10-11-web-ui";
    api::add_comment(
        repo.path(),
        FOLDER,
        "spec.md",
        None,
        "![shot](images/shot.webp)",
    )
    .unwrap();
    repo.write(
        &format!("{worktree}/specs/2026-10-11-web-ui/images/shot.webp"),
        "shot",
    );
    repo.set_hook("exit 1");
    let refused = api::approve(repo.path(), FOLDER, "spec.md", None, None, None).unwrap_err();
    assert_eq!(refused.code, "hook");
    repo.set_hook("exit 0");
    let path = format!("{worktree}/{review}");
    let text = repo
        .read(&path)
        .replace("![shot](images/shot.webp)", "Fine.");
    repo.write(&path, &text);

    api::retry_commit(repo.path(), FOLDER, "spec.md").unwrap();

    assert_eq!(repo.changed_in(FOLDER), [review, SPEC]);
    assert!(!repo.exists(&format!("{worktree}/specs/2026-10-11-web-ui/images")));
}

/// Trying again checks the staged files before deleting any image.
#[test]
fn try_again_refuses_other_staged_files_before_deleting_images() {
    let repo = repo();
    let worktree = ".worktrees/2026-10-11-web-ui";
    repo.set_hook("exit 1");
    let refused = api::approve(repo.path(), FOLDER, "spec.md", None, None, None).unwrap_err();
    assert_eq!(refused.code, "hook");
    repo.set_hook("exit 0");
    let image = format!("{worktree}/specs/2026-10-11-web-ui/images/old.webp");
    repo.write(&image, "old");
    repo.write(&format!("{worktree}/specs/README.md"), "# Changed\n");
    common::repo::run_git(&repo.path().join(worktree), &["add", "specs/README.md"]);

    let error = api::retry_commit(repo.path(), FOLDER, "spec.md").unwrap_err();

    assert!(
        error.message.contains("other files are staged"),
        "{}",
        error.message
    );
    assert!(repo.exists(&image));
}
