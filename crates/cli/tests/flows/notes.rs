//! `ura note`: a note is written to `specs/INBOX.md` on the default branch, from any checkout, and
//! committed alone, never with someone's other work.

use crate::common::repo::run_git;
use crate::common::*;

const INBOX: &str = "specs/INBOX.md";
const FEATURE: &str = "2026-10-15-add-scratchpad";

/// The shared fixture's inbox committed on `main`, and a feature branch.
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

fn note(repo: &TestRepo, args: &[&str]) -> Output {
    let mut all = vec!["note"];
    all.extend(args);
    ura(repo, &all)
}

#[test]
fn a_note_from_a_feature_worktree_is_committed_on_main_marked_with_its_feature() {
    let repo = repo();
    let worktree = repo.parent().join("add-scratchpad");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        worktree.to_str().unwrap(),
        FEATURE,
    ]);
    let feature_before = repo.subjects(FEATURE);

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
        repo.changed_in("main"),
        [INBOX],
        "main commits the inbox alone"
    );
    assert!(
        repo.read(INBOX)
            .contains("[add-scratchpad] Status hangs on a broken worktree")
    );
    assert_eq!(
        repo.subjects(FEATURE),
        feature_before,
        "the feature's branch is untouched"
    );
    assert_eq!(run_git(&worktree, &["status", "--porcelain"]), "");
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn from_a_checkout_without_main_the_note_is_committed_in_a_worktree_of_main() {
    let repo = repo();
    repo.switch(FEATURE);

    let output = note(&repo, &["Status hangs on a broken worktree"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(
        repo.read(".worktrees/main/specs/INBOX.md")
            .contains("Status hangs")
    );
    assert_eq!(
        run_git(
            &repo.path().join(".worktrees/main"),
            &["status", "--porcelain"]
        ),
        ""
    );
    assert_eq!(
        repo.current_branch(),
        FEATURE,
        "the human's checkout is not switched"
    );
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn an_agents_note_about_a_feature_creates_the_inbox() {
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
            "Opening a session takes 4 s",
            "--agent",
            "--about",
            "session-view",
            "--category",
            "UI",
        ],
    );

    assert_eq!(output.code, 0, "{}", output.stderr);
    let inbox = repo.read(INBOX);
    assert!(
        inbox.contains("## UI")
            && inbox.contains("[agent] [session-view] Opening a session takes 4 s"),
        "{inbox}"
    );
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn a_note_that_is_not_allowed_writes_nothing_and_makes_no_worktree() {
    let repo = repo();
    repo.write("specs/drafts/idea.md", "# Idea\n");
    repo.commit("chore: draft an idea");
    repo.switch(FEATURE);

    let blank = [note(&repo, &[""]), note(&repo, &["   "])];
    let unknown = note(&repo, &["A note", "--about", "nothing-here"]);
    let a_draft = note(&repo, &["A note", "--about", "idea"]);

    assert!(blank.iter().all(|output| output.code == 1));
    assert_eq!((unknown.code, a_draft.code), (1, 1));
    assert!(
        !repo.exists(".worktrees/main"),
        "a refused note leaves no worktree"
    );
    assert_eq!(repo.porcelain(), "");
    let bare = TestRepo::new();
    assert_eq!(
        note(&bare, &["A note"]).code,
        1,
        "no specs/ folder: refused"
    );
}

#[test]
fn only_the_inbox_is_committed_and_other_work_stays_where_it_was() {
    let repo = repo();
    repo.write("README.md", "# Changed\n");
    repo.write("other.md", "staged\n");
    repo.git(&["add", "other.md"]);

    let output = note(&repo, &["Hints flicker on save", "--category", "Editor"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(repo.changed_in("HEAD"), [INBOX]);
    let status = repo.porcelain();
    assert!(
        status.contains(" M README.md") && status.contains("A  other.md"),
        "{status}"
    );
}

#[test]
fn an_inbox_with_uncommitted_work_gets_the_note_but_no_commit() {
    let repo = repo();
    repo.write(
        INBOX,
        &repo
            .read(INBOX)
            .replace("home icon", "home icon in the sidebar"),
    );
    repo.write("other.md", "staged\n");
    repo.git(&["add", "other.md"]);
    let before = repo.subjects("main");

    let output = note(&repo, &["Hints flicker on save"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(
        repo.subjects("main"),
        before,
        "someone's edit is never committed with the note"
    );
    let inbox = repo.read(INBOX);
    assert!(inbox.contains("home icon in the sidebar") && inbox.contains("Hints flicker on save"));
}

#[test]
fn no_commit_writes_the_note_and_leaves_it_to_the_human() {
    let repo = repo();
    let before = repo.subjects("main");

    let output = note(&repo, &["Hints flicker on save", "--no-commit"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(repo.subjects("main"), before);
    assert_eq!(repo.porcelain(), " M specs/INBOX.md\n");
}
