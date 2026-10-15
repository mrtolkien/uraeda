//! `ura note`: a note written to `specs/INBOX.md` on the default branch, and committed alone.

mod common;

use std::path::PathBuf;

use common::repo::run_git;
use common::*;

const INBOX: &str = "specs/INBOX.md";
const FEATURE: &str = "2026-10-15-add-scratchpad";
const DIRTY: &str = "INBOX.md had uncommitted changes: the note is written but not committed.\n";

/// A repository with the shared fixture's inbox committed on `main`, and a feature branch.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write(
        INBOX,
        &std::fs::read_to_string(fixture("repo/main/specs/INBOX.md")).unwrap(),
    );
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    );
    feature(&repo, FEATURE, &[("proposal.md", proposal())]);
    repo
}

/// The feature's worktree, next to the repository, whose `main` stays checked out.
fn feature_worktree(repo: &TestRepo) -> PathBuf {
    let worktree = repo.parent().join("add-scratchpad");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        worktree.to_str().unwrap(),
        FEATURE,
    ]);
    worktree
}

fn note(repo: &TestRepo, args: &[&str]) -> Output {
    let mut all = vec!["note"];
    all.extend(args);
    ura(repo, &all)
}

/// US1 5: from a feature's worktree, the note is committed on `main`, marked with the feature.
#[test]
fn a_note_from_a_feature_worktree_is_committed_on_main() {
    let repo = repo();
    let worktree = feature_worktree(&repo);
    let feature_head = repo.subjects(FEATURE);

    let output = ura_in(
        &worktree,
        &[
            "note",
            "Status hangs on a broken worktree",
            "--category",
            "CLI",
        ],
        &[],
    );

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(
        output.stderr,
        format!("wrote in {}\nadded to the inbox\n", repo.path().display())
    );
    assert_eq!(
        repo.subjects("main")[0],
        "chore: add \"Status hangs on a broken worktree\" to the inbox"
    );
    assert_eq!(repo.changed_in("main"), [INBOX]);
    assert!(repo.read(INBOX).ends_with(
        "- Make sure agents are resumable\n- [add-scratchpad] Status hangs on a broken worktree\n"
    ));
    assert_eq!(repo.subjects(FEATURE), feature_head);
    assert_eq!(run_git(&worktree, &["status", "--porcelain"]), "");
    assert_eq!(repo.porcelain(), "");
}

/// US5 1: an agent's note, about another feature, in a file that does not exist yet.
#[test]
fn an_agents_note_about_a_feature() {
    let repo = TestRepo::new();
    specs(&repo, "# Priorities\n\n## Now\n");
    feature(
        &repo,
        "2026-10-14-session-view",
        &[("proposal.md", proposal())],
    );

    let output = note(
        &repo,
        &[
            "Opening a session with 2,000 messages takes 4 s",
            "--agent",
            "--about",
            "session-view",
            "--category",
            "UI",
        ],
    );

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(
        repo.read(INBOX),
        "# Inbox\n\n## UI\n\n- [agent] [session-view] Opening a session with 2,000 messages takes 4 s\n"
    );
    assert_eq!(
        repo.subjects("main")[0],
        "chore: add \"Opening a session with 2,000 messages…\" to the inbox"
    );
    assert_eq!(repo.porcelain(), "");
}

/// A bug's worktree marks its notes with the bug's slug.
#[test]
fn a_note_from_a_bug_worktree_is_about_the_bug() {
    let repo = repo();
    feature(
        &repo,
        "fix/2026-10-14-broken-link",
        &[("bug.md", "# Broken link\n".to_string())],
    );
    let worktree = repo.parent().join("broken-link");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        worktree.to_str().unwrap(),
        "fix/2026-10-14-broken-link",
    ]);

    let output = ura_in(&worktree, &["note", "Links break on rename"], &[]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(
        repo.read(INBOX)
            .contains("- We need a home icon\n- [broken-link] Links break on rename\n\n## UI")
    );
}

#[test]
fn an_about_that_matches_nothing_is_refused() {
    let repo = repo();

    let output = note(&repo, &["A note", "--about", "nothing-here"]);

    assert_eq!(
        output.stderr,
        "ura: --about names a feature or a bug: none is named nothing-here\n"
    );
    assert_eq!(output.code, 1);
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn a_blank_note_is_refused() {
    let repo = repo();

    for text in ["", "   "] {
        let output = note(&repo, &[text]);

        assert_eq!(output.stderr, "ura: A note needs text.\n");
        assert_eq!(output.code, 1);
    }
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn outside_specs_it_is_refused() {
    let repo = TestRepo::new();
    let folder = tempfile::TempDir::new().unwrap();

    for dir in [repo.path(), folder.path()] {
        let output = ura_in(dir, &["note", "A note"], &[]);

        assert_eq!(output.stderr, "ura: No specs/ folder here.\n");
        assert_eq!(output.code, 1);
    }
}

/// Someone's uncommitted work in `INBOX.md` is never committed with the note.
#[test]
fn an_uncommitted_inbox_is_written_but_not_committed() {
    let repo = repo();
    let edited = repo
        .read(INBOX)
        .replace("home icon", "home icon in the sidebar");
    repo.write(INBOX, &edited);
    let before = repo.subjects("main");

    let output = note(&repo, &["Hints flicker on save"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(output.stderr, DIRTY);
    assert_eq!(repo.subjects("main"), before);
    let written = repo.read(INBOX);
    assert!(
        written.contains("- We need a home icon in the sidebar\n- Hints flicker on save\n"),
        "{written}"
    );
}

/// Other changed files stay out of the note's commit.
#[test]
fn only_the_inbox_is_committed() {
    let repo = repo();
    repo.write("README.md", "# Changed\n");
    repo.write("specs/PRIORITIES.md", "# Priorities\n\n## Now\n\n- New\n");

    let output = note(&repo, &["Hints flicker on save", "--category", "Editor"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(repo.changed_in("HEAD"), [INBOX]);
    assert_eq!(repo.porcelain(), " M README.md\n M specs/PRIORITIES.md\n");
    assert!(
        repo.read(INBOX)
            .ends_with("\n## Editor\n\n- Hints flicker on save\n")
    );
}

#[test]
fn no_commit_writes_without_committing() {
    let repo = repo();
    let before = repo.subjects("main");

    let output = note(&repo, &["Hints flicker on save", "--no-commit"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(output.stderr, "added to the inbox, not committed\n");
    assert_eq!(repo.subjects("main"), before);
    assert_eq!(repo.porcelain(), " M specs/INBOX.md\n");
}

/// Review focus 5: with `main` checked out nowhere, the note is committed in `.worktrees/main`.
#[test]
fn without_a_main_checkout_it_commits_in_a_worktree() {
    let repo = repo();
    repo.switch(FEATURE);

    let output = note(&repo, &["Status hangs on a broken worktree"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(
        output.stderr,
        "wrote in .worktrees/main\nadded to the inbox\n"
    );
    let main = repo.path().join(".worktrees/main");
    assert!(
        std::fs::read_to_string(main.join(INBOX))
            .unwrap()
            .contains("- [add-scratchpad] Status hangs on a broken worktree\n")
    );
    assert_eq!(run_git(&main, &["status", "--porcelain"]), "");
    assert_eq!(
        repo.subjects("main")[0],
        "chore: add \"Status hangs on a broken worktree\" to the inbox"
    );
    assert_eq!(repo.current_branch(), FEATURE);
    assert_eq!(repo.porcelain(), "");
}

/// Other staged files would ride along with the commit: refused before writing.
#[test]
fn other_staged_files_are_refused_before_writing() {
    let repo = repo();
    repo.write("README.md", "# Changed\n");
    repo.git(&["add", "README.md"]);

    let output = note(&repo, &["Hints flicker on save"]);

    assert_eq!(output.code, 1);
    assert!(output.stderr.contains("README.md"), "{}", output.stderr);
    assert!(!repo.read(INBOX).contains("Hints flicker"));
}

/// A refused note leaves nothing behind: no `.worktrees/main` created for it.
#[test]
fn a_blank_note_creates_no_worktree() {
    let repo = repo();
    repo.switch(FEATURE);

    let output = note(&repo, &["  "]);

    assert_eq!(output.stderr, "ura: A note needs text.\n");
    assert_eq!(output.code, 1);
    assert!(!repo.exists(".worktrees/main"));
}

/// `--about` names a feature or a bug, never a draft.
#[test]
fn an_about_naming_a_draft_is_refused() {
    let repo = repo();
    repo.write("specs/drafts/idea.md", "# Idea\n");
    repo.commit("chore: draft an idea");

    let output = note(&repo, &["A note", "--about", "idea"]);

    assert_eq!(
        output.stderr,
        "ura: --about names a feature or a bug: none is named idea\n"
    );
    assert_eq!(output.code, 1);
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn an_about_naming_a_bug_writes_its_slug() {
    let repo = repo();
    feature(
        &repo,
        "fix/2026-10-14-broken-link",
        &[("bug.md", "# Broken link\n".to_string())],
    );

    let output = note(&repo, &["Links break on rename", "--about", "broken-link"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(
        repo.read(INBOX)
            .contains("- [broken-link] Links break on rename\n")
    );
}

/// Staged files only matter to a commit: with `INBOX.md` already changed, the note is written.
#[test]
fn staged_files_do_not_refuse_a_note_that_is_not_committed() {
    let repo = repo();
    repo.write("README.md", "# Changed\n");
    repo.git(&["add", "README.md"]);
    let edited = repo
        .read(INBOX)
        .replace("home icon", "home icon in the sidebar");
    repo.write(INBOX, &edited);

    let output = note(&repo, &["Hints flicker on save"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(output.stderr, DIRTY);
    assert!(repo.read(INBOX).contains("- Hints flicker on save\n"));
}
